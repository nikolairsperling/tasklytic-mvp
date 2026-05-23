"use client";

import { useState } from "react";
import { calculateSavings } from "@/lib/savings";

export function SavingsCalculator() {
  const [dispatchers, setDispatchers] = useState(2);
  const [manualHoursPerWeek, setManualHoursPerWeek] = useState(30);
  const [hourlyRate, setHourlyRate] = useState(55);

  const result = calculateSavings({
    dispatchers,
    manualHoursPerWeek,
    hourlyRate
  });

  return (
    <div className="rounded-3xl bg-white p-6 shadow-panel">
      <div className="grid gap-4 md:grid-cols-3">
        <NumberField
          label="Disponenten in Vollzeit"
          value={dispatchers}
          onChange={setDispatchers}
        />
        <NumberField
          label="Manuelle Stunden pro Woche und Person"
          value={manualHoursPerWeek}
          onChange={setManualHoursPerWeek}
        />
        <NumberField
          label="Stundenkosten inkl. Nebenkosten"
          value={hourlyRate}
          onChange={setHourlyRate}
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Jahreseinsparung"
          value={`${result.yearlySavings.toLocaleString("de-DE")} EUR`}
        />
        <MetricCard
          label="Jahresstunden"
          value={result.yearlyHours.toLocaleString("de-DE")}
        />
        <MetricCard label="Geschätzte Vollzeitäquivalente" value={result.fte.toFixed(2)} />
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
      />
    </label>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}
