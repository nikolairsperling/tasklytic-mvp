"use client";

import { useEffect, useState } from "react";
import { DEFAULT_CALLING_SETTINGS, type CallingSettingsPayload } from "@/lib/app-settings";

export function useCallingSettings() {
  const [settings, setSettings] = useState<CallingSettingsPayload>(DEFAULT_CALLING_SETTINGS);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/calling", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: Partial<CallingSettingsPayload>) => {
        if (active && data) {
          setSettings((current) => ({
            ...current,
            ...data
          }));
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return settings;
}
