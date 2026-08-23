#!/usr/bin/env bash
#
# setup-omniroute.sh — Install OmniRoute and configure an OpenAI-primary,
# cost-optimized fallback chain with tuned resilience.
#
# Run on YOUR OWN machine (not an ephemeral container) so the config persists.
# Usage:  bash setup-omniroute.sh
#
set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# Config — edit these to taste
# ─────────────────────────────────────────────────────────────────────────────
BASE_URL="http://localhost:20128"
COMBO_NAME="cheap-first"
COMBO_STRATEGY="cost-optimized"   # or "priority" for strict order

# Providers to configure keys for. First is primary; rest are fallbacks.
# Valid IDs: openai anthropic google openrouter groq mistral
PROVIDERS=(openai groq mistral)

# Resilience tuning (fast-failover profile). See `omniroute resilience config show`.
RES_THRESHOLD=3          # consecutive failures before failover (default 12)
RES_RESET_TIMEOUT_MS=15000   # ms before retrying a tripped provider (default 30000)
RES_BASE_COOLDOWN_MS=2000    # ms base backoff between retries (default 3000)

export OMNIROUTE_BASE_URL="$BASE_URL"

log()  { printf '\n\033[1;36m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }

# ─────────────────────────────────────────────────────────────────────────────
# 1. Install (with retry — the package is large and downloads can drop)
# ─────────────────────────────────────────────────────────────────────────────
if command -v omniroute >/dev/null 2>&1; then
  log "omniroute already installed ($(omniroute -v 2>/dev/null | tail -1))"
else
  log "Installing omniroute globally (large package; retrying on network errors)…"
  for attempt in 1 2 3 4; do
    if npm install -g omniroute --fetch-timeout=600000 --fetch-retries=5; then
      break
    fi
    wait=$((2 ** attempt))
    warn "install attempt $attempt failed — retrying in ${wait}s"
    sleep "$wait"
    [ "$attempt" -eq 4 ] && { warn "install failed after 4 attempts"; exit 1; }
  done
fi

# ─────────────────────────────────────────────────────────────────────────────
# 2. Start the server (if not already up) and wait until ready
# ─────────────────────────────────────────────────────────────────────────────
if curl -s -o /dev/null --max-time 5 "$BASE_URL/v1/models"; then
  log "Server already running at $BASE_URL"
else
  log "Starting omniroute server in the background…"
  nohup omniroute serve >/tmp/omniroute-serve.log 2>&1 &
  disown || true
fi

log "Waiting for the server to become ready…"
curl -s -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused \
  --retry-all-errors --max-time 90 "$BASE_URL/v1/models"
log "Server is up: $BASE_URL  (API: $BASE_URL/v1)"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Add provider API keys (secure prompt — nothing hits shell history)
# ─────────────────────────────────────────────────────────────────────────────
for p in "${PROVIDERS[@]}"; do
  if omniroute keys list 2>/dev/null | grep -qiw "$p"; then
    log "Key for '$p' already configured — skipping"
    continue
  fi
  printf '\n\033[1;36m▶ Enter API key for %s\033[0m (blank to skip): ' "$p"
  read -rs KEY; echo
  if [ -z "${KEY:-}" ]; then
    warn "Skipped '$p' (no key)."
    continue
  fi
  printf '%s' "$KEY" | omniroute keys add "$p" --stdin
  unset KEY
  log "Added key for '$p'"
done

echo; log "Configured keys:"; omniroute keys list || true

# ─────────────────────────────────────────────────────────────────────────────
# 4. Sync pricing (required for the cost-optimized strategy to rank by price)
# ─────────────────────────────────────────────────────────────────────────────
if [ "$COMBO_STRATEGY" = "cost-optimized" ]; then
  log "Syncing model pricing (needed for cost-optimized routing)…"
  omniroute pricing sync || warn "pricing sync failed — cost ranking may be incomplete"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 5. Create the routing combo (fallback chain)
# ─────────────────────────────────────────────────────────────────────────────
if omniroute combo list 2>/dev/null | grep -qw "$COMBO_NAME"; then
  log "Combo '$COMBO_NAME' already exists — skipping create"
else
  log "Creating combo '$COMBO_NAME' (strategy: $COMBO_STRATEGY)…"
  omniroute combo create "$COMBO_NAME" --strategy "$COMBO_STRATEGY"
fi

# ─────────────────────────────────────────────────────────────────────────────
# 6. MANUAL STEP — add the ordered model members in the dashboard
#    (the CLI creates the combo shell; membership is set in the UI)
# ─────────────────────────────────────────────────────────────────────────────
cat <<EOF

────────────────────────────────────────────────────────────────────────────
 MANUAL STEP: add models to the combo
────────────────────────────────────────────────────────────────────────────
 1. Open the dashboard:            $BASE_URL   (or run: omniroute dashboard)
 2. Go to  Combos → $COMBO_NAME
 3. Add the models you want in the chain, e.g.:
        openai/gpt-4o-mini
        groq/llama-3.3-70b-versatile
        mistral/mistral-large-latest
    (Use exact IDs from:  omniroute models <provider>)
 4. Save.
────────────────────────────────────────────────────────────────────────────
EOF
read -rp "Press Enter once you've added the models in the dashboard… " _

# ─────────────────────────────────────────────────────────────────────────────
# 7. Activate the combo
# ─────────────────────────────────────────────────────────────────────────────
log "Activating combo '$COMBO_NAME'…"
omniroute combo switch "$COMBO_NAME"
omniroute combo list

# ─────────────────────────────────────────────────────────────────────────────
# 8. Tune resilience (fast failover)
# ─────────────────────────────────────────────────────────────────────────────
log "Tuning resilience (threshold=$RES_THRESHOLD, reset=${RES_RESET_TIMEOUT_MS}ms, cooldown=${RES_BASE_COOLDOWN_MS}ms)…"
omniroute resilience config set \
  --threshold "$RES_THRESHOLD" \
  --reset-timeout "$RES_RESET_TIMEOUT_MS" \
  --base-cooldown "$RES_BASE_COOLDOWN_MS"

# ─────────────────────────────────────────────────────────────────────────────
# 9. Verify
# ─────────────────────────────────────────────────────────────────────────────
log "Dry-run routing simulation (shows selection + fallback tree + cost range):"
omniroute simulate "Write a one-sentence hello." --combo "$COMBO_NAME" --explain || \
  warn "simulate needs the server running and at least one model in the combo"

log "Resilience status:"
omniroute resilience status || true

cat <<EOF

✅ Done.

Use it — point any OpenAI-compatible tool at the router:
    export OPENAI_BASE_URL=$BASE_URL/v1
    export OPENAI_API_KEY=<your OmniRoute key from: omniroute keys list>
    # send model "auto" to route through the active combo

Handy commands:
    omniroute status                 # overall dashboard
    omniroute cost --group-by model  # spend per model
    omniroute resilience breakers    # live breaker state
    omniroute resilience reset       # clear breakers after fixing a provider
    omniroute combo list             # combos + which is active
EOF
