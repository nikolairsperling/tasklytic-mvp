import type { Prospect } from "@prisma/client";

export function buildIntro(prospect: Prospect): string {
  return `${prospect.companyName} in ${prospect.city} zeigt mehrere Anhaltspunkte, dass operative Prozesse in Disposition und Dokumentation ein relevanter Hebel für Effizienzgewinne sein können.`;
}

export function buildSignals(prospect: Prospect): string[] {
  const signals: string[] = [];

  if (prospect.openDispatcherJob) {
    signals.push(
      "Ihre offene Disponenten-Stelle zeigt, dass operative Entlastung aktuell ein reales Thema ist."
    );
  }

  if ((prospect.locationsCount ?? 0) > 1) {
    signals.push(
      "Mehrere Standorte erhöhen den Abstimmungsaufwand zwischen Disposition, Fahrern und Abrechnung."
    );
  }

  if ((prospect.vehicleCount ?? 0) > 25) {
    signals.push(
      "Ein Fuhrpark dieser Größenordnung erzeugt täglich viele Belege, Tourendaten und Fahrernachweise."
    );
  }

  if (prospect.websiteMaturitySignal && /schwach|veraltet|alt|dated/i.test(prospect.websiteMaturitySignal)) {
    signals.push(
      "Die öffentliche Website wirkt funktional, aber nicht auf Prozessklarheit und digitale Selbstbedienung optimiert."
    );
  }

  for (const optionalText of [
    prospect.jobSignalText,
    prospect.fleetSignalText,
    prospect.locationSignalText,
    prospect.contactStructureSignalText
  ]) {
    if (optionalText) {
      signals.push(optionalText);
    }
  }

  if (signals.length === 0) {
    signals.push(
      "Aus den sichtbaren Unternehmensdaten ergibt sich Potenzial für strukturiertere Abläufe rund um Disposition, Nachweise und Rückfragen."
    );
  }

  return signals;
}
