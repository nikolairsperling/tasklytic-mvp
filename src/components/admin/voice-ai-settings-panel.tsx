"use client";

import { useMemo, useState, useTransition } from "react";
import type { CallingSettingsPayload } from "@/lib/app-settings";
import type { VoiceAiScenario } from "@/lib/voice-ai-tests";

type VoiceAiVoice = "neutral" | "männlich" | "weiblich";

type ProspectOption = { id: string; companyName: string };
type TestCall = {
  id: string;
  voice: string;
  scenario: string;
  status: string;
  transcript: string;
  summary: string;
  detectedObjections: string[];
  conversationQuality: string;
  appointmentIntent: string;
  recommendedImprovement: string;
  createdAt: string | Date;
  prospect?: { companyName: string } | null;
};

type VoiceAiState = {
  successfulCount: number;
  requiredSuccessfulCount: number;
  canActivate: boolean;
  recentCalls: TestCall[];
};

const scenarioOptions: Array<{ value: VoiceAiScenario; label: string }> = [
  { value: "interessiert", label: "interessiert" },
  { value: "keine_zeit", label: "keine Zeit" },
  { value: "kein_interesse", label: "kein Interesse" },
  { value: "falscher_ansprechpartner", label: "falscher Ansprechpartner" },
  { value: "rueckruf_spaeter", label: "Rückruf später" },
  { value: "terminwunsch", label: "Terminwunsch" }
];

export function VoiceAiSettingsPanel({
  settings,
  prospects,
  initialState
}: {
  settings: CallingSettingsPayload;
  prospects: ProspectOption[];
  initialState: VoiceAiState;
}) {
  const [provider, setProvider] = useState(settings.voiceAiProvider ?? "test");
  const [defaultVoice, setDefaultVoice] = useState<VoiceAiVoice>(settings.voiceAiDefaultVoice ?? "neutral");
  const [testPhoneNumber, setTestPhoneNumber] = useState(settings.ownPhoneNumber ?? "");
  const [voice, setVoice] = useState<VoiceAiVoice>(settings.voiceAiDefaultVoice ?? "neutral");
  const [scenario, setScenario] = useState<VoiceAiScenario>("interessiert");
  const [prospectId, setProspectId] = useState("");
  const [enabled, setEnabled] = useState(settings.voiceAiEnabled);
  const [state, setState] = useState(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [scriptOpen, setScriptOpen] = useState(true);
  const [isPending, startTransition] = useTransition();
  const script = useMemo(() => buildScript(scenario), [scenario]);

  function saveProvider() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/settings/calling", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...settings,
            voiceAiProvider: provider,
            voiceAiDefaultVoice: defaultVoice,
            voiceAiEnabled: enabled
          })
        });
        if (!response.ok) throw new Error("Voice-KI Einstellungen konnten nicht gespeichert werden.");
        setMessage("Voice-KI Einstellungen gespeichert.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Voice-KI Einstellungen konnten nicht gespeichert werden.");
      }
    });
  }

  function startTestCall() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/settings/voice-ai/test-calls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ testPhoneNumber, voice, scenario, prospectId: prospectId || null })
        });
        const body = (await response.json().catch(() => null)) as Partial<VoiceAiState> & { error?: string } | null;
        if (!response.ok || !body) throw new Error(body?.error ?? "Testanruf konnte nicht gestartet werden.");
        setState({
          successfulCount: body.successfulCount ?? state.successfulCount,
          requiredSuccessfulCount: body.requiredSuccessfulCount ?? state.requiredSuccessfulCount,
          canActivate: body.canActivate ?? state.canActivate,
          recentCalls: body.recentCalls ?? state.recentCalls
        });
        setMessage("Testanruf gespeichert. Kein Leadstatus wurde geändert.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Testanruf konnte nicht gestartet werden.");
      }
    });
  }

  function activateVoiceAi() {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/settings/voice-ai/activate", { method: "POST" });
        const body = (await response.json().catch(() => null)) as Partial<VoiceAiState> & { settings?: CallingSettingsPayload; error?: string } | null;
        if (!response.ok || !body) throw new Error(body?.error ?? "Voice-KI konnte nicht aktiviert werden.");
        setEnabled(Boolean(body.settings?.voiceAiEnabled));
        setMessage("Voice-KI für Leads aktiviert. Live-Calls bleiben manuell freigabepflichtig.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Voice-KI konnte nicht aktiviert werden.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {message ? <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</div> : null}

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Anbieter konfigurieren</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value)}>
            <option value="test">Test-Simulator</option>
            <option value="twilio">Twilio</option>
            <option value="sip">SIP</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Stimme auswählen</span>
          <select value={defaultVoice} onChange={(event) => setDefaultVoice(event.target.value as VoiceAiVoice)}>
            <option value="neutral">neutral</option>
            <option value="männlich">männlich</option>
            <option value="weiblich">weiblich</option>
          </select>
        </label>
        <div className="flex items-end justify-end">
          <button type="button" onClick={saveProvider} disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
            Speichern
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Gesprächsskript testen</h2>
            <p className="mt-1 text-sm text-slate-500">Testmodus speichert nur Testdaten und verändert keine Leads.</p>
          </div>
          <button type="button" onClick={() => setScriptOpen((current) => !current)} className="btn-secondary min-h-10 rounded-xl px-3 py-2 text-sm font-semibold">
            {scriptOpen ? "Testskript ausblenden" : "Testskript ansehen"}
          </button>
        </div>
        {scriptOpen ? <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">{script.map((line) => <li key={line}>{line}</li>)}</ol> : null}
      </section>

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Test-Telefonnummer</span>
          <input value={testPhoneNumber} onChange={(event) => setTestPhoneNumber(event.target.value)} placeholder="+49 30 123456" />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Stimme</span>
          <select value={voice} onChange={(event) => setVoice(event.target.value as VoiceAiVoice)}>
            <option value="neutral">neutral</option>
            <option value="männlich">männlich</option>
            <option value="weiblich">weiblich</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Szenario</span>
          <select value={scenario} onChange={(event) => setScenario(event.target.value as VoiceAiScenario)}>
            {scenarioOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium text-slate-600">Test-Lead</span>
          <select value={prospectId} onChange={(event) => setProspectId(event.target.value)}>
            <option value="">Demo-Lead nutzen</option>
            {prospects.map((prospect) => <option key={prospect.id} value={prospect.id}>{prospect.companyName}</option>)}
          </select>
        </label>
        <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Sicherheitsmodus: keine Kampagne, kein Leadstatus, keine Follow-ups.</p>
          <button type="button" onClick={startTestCall} disabled={isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold">
            {isPending ? "Läuft..." : "Testanruf starten"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Freigabe</h2>
            <p className="mt-1 text-sm text-slate-500">{state.successfulCount}/{state.requiredSuccessfulCount} erfolgreiche Testcalls.</p>
          </div>
          <button type="button" onClick={activateVoiceAi} disabled={enabled || !state.canActivate || isPending} className="btn-primary min-h-11 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">
            {enabled ? "Voice-KI aktiv" : "Voice-KI für Leads aktivieren"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-ink">Testprotokoll</h2>
        <div className="mt-4 grid gap-3">
          {state.recentCalls.length === 0 ? <p className="text-sm text-slate-500">Noch keine Testanrufe vorhanden.</p> : null}
          {state.recentCalls.map((call) => (
            <article key={call.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold text-ink">{call.prospect?.companyName ?? "Demo-Lead"} · {call.scenario}</p>
                <span className="text-xs font-semibold text-slate-500">{formatDate(call.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm text-slate-700">{call.summary}</p>
              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <Info label="Einwände" value={call.detectedObjections.join(", ") || "keine"} />
                <Info label="Gesprächsqualität" value={call.conversationQuality} />
                <Info label="Terminabsicht" value={call.appointmentIntent} />
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">Transkript und Verbesserung</summary>
                <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">{call.transcript}</pre>
                <p className="mt-2 text-sm text-slate-600">{call.recommendedImprovement}</p>
              </details>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white p-3"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</p><p className="mt-1 font-medium text-slate-700">{value}</p></div>;
}

function buildScript(scenario: VoiceAiScenario) {
  const scenarioLine = scenarioOptions.find((option) => option.value === scenario)?.label ?? scenario;
  return [
    "Guten Tag, hier ist der KI-Telefonagent von Tasklytic.",
    "Ich wollte nur kurz prüfen, ob das Thema Prozessentlastung bei Ihnen grundsätzlich relevant ist.",
    `Testszenario: ${scenarioLine}.`,
    "Bei Interesse wird an Nikolai eskaliert, bei Ablehnung freundlich beendet.",
    "Der Agent behauptet nie, ein Mensch zu sein."
  ];
}

function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
