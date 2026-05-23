"use client";

import { useEffect, useRef } from "react";
import type { ProspectEventType } from "@/lib/prospect-events";

type ProspectActivityTrackerProps = {
  slug: string;
  page: "landingpage" | "booking";
};

type TrackMeta = Record<string, string | number | boolean | null>;

export function ProspectActivityTracker({ slug, page }: ProspectActivityTrackerProps) {
  const watchedTimer = useRef<number | null>(null);
  const hasTrackedVideoWatched = useRef(false);

  useEffect(() => {
    if (!trackingAllowed()) {
      function handleConsent(event: Event) {
        if (event instanceof CustomEvent && event.detail === "accepted") {
          trackProspectEvent(slug, page === "booking" ? "booking_opened" : "page_view", { page });
        }
      }

      window.addEventListener("tasklytic-cookie-consent", handleConsent);
      return () => window.removeEventListener("tasklytic-cookie-consent", handleConsent);
    }
    trackProspectEvent(slug, page === "booking" ? "booking_opened" : "page_view", { page });

    return () => {
      if (watchedTimer.current) {
        window.clearTimeout(watchedTimer.current);
      }
    };
  }, [page, slug]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!trackingAllowed()) {
        return;
      }
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-track-event]") : null;
      if (!target) {
        return;
      }

      const type = target.dataset.trackEvent as ProspectEventType | undefined;
      if (!type) {
        return;
      }

      trackProspectEvent(slug, type, {
        page,
        label: target.dataset.trackLabel ?? target.textContent?.trim().slice(0, 120) ?? null,
        href: target instanceof HTMLAnchorElement ? target.href : null
      });

      if (type === "cta_clicked" && target.dataset.trackBooking === "true") {
        trackProspectEvent(slug, "booking_opened", {
          page,
          source: "cta_click",
          href: target instanceof HTMLAnchorElement ? target.href : null
        });
      }

      if (type === "video_started" && !hasTrackedVideoWatched.current) {
        if (watchedTimer.current) {
          window.clearTimeout(watchedTimer.current);
        }
        watchedTimer.current = window.setTimeout(() => {
          hasTrackedVideoWatched.current = true;
          trackProspectEvent(slug, "video_watched", { page, thresholdSeconds: 20 });
        }, 20_000);
      }
    }

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, [page, slug]);

  return null;
}

function trackProspectEvent(slug: string, type: ProspectEventType, meta?: TrackMeta) {
  if (!trackingAllowed()) {
    return;
  }
  if (!slug) {
    return;
  }

  const body = JSON.stringify({ slug, type, meta });
  const url = "/api/events/track";

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true
  }).catch(() => {
    // Tracking must never block the landingpage experience.
  });
}

function trackingAllowed() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("tasklytic-cookie-consent") === "accepted";
}
