import Link from "next/link";
import React from "react";
import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";

const cards = [
  {
    title: "Systemstatus / Fehlerdiagnose",
    description: "Fehlerprotokoll, Request-IDs, technische Details und kontrollierte Tests aller Hauptfunktionen.",
    href: "/admin/settings/system-status",
    badge: "Diagnose"
  },
  {
    title: "E-Mail",
    description: "SMTP, IMAP, Verbindungstests und Mailbox-Bereitschaft verwalten.",
    href: "/admin/settings/email",
    badge: "E-Mail"
  },
  {
    title: "E-Mail Signatur",
    description: "HTML- und Plaintext-Signatur sicher hinterlegen und serverseitig an Versandmails anhängen.",
    href: "/admin/settings/email-signature",
    badge: "Mail"
  },
  {
    title: "ClickUp",
    description: "ClickUp API Token und Ziel-Liste sicher speichern und testen.",
    href: "/admin/settings/clickup",
    badge: "ClickUp"
  },
  {
    title: "OpenAI",
    description: "OpenAI API Key sicher speichern und Verbindung testen.",
    href: "/admin/settings/openai",
    badge: "OpenAI"
  },
  {
    title: "HeyGen",
    description: "Provider-Konfiguration für personalisierte Videos vorbereiten.",
    href: "/admin/settings/heygen",
    badge: "Video"
  },
  {
    title: "Allgemeine App Einstellungen",
    description: "Öffentliche App-URL, Admin-Theme und Hinweise zu Domain, Server-Adresse und HTTPS.",
    href: "/admin/settings/app",
    badge: "App"
  },
  {
    title: "Benachrichtigungen",
    description: "Push aktivieren, Test senden und operative Push-Ereignisse konfigurieren.",
    href: "/admin/settings/notifications",
    badge: "Push"
  },
  {
    title: "Design",
    description: "Globale Design-Grundlagen und Theme-Fähigkeit des Adminbereichs.",
    href: "/admin/settings/design",
    badge: "Design"
  },
  {
    title: "Branding",
    description: "App-Name, Logo, Icon und Primär-/Sekundärfarbe für Login und Adminbereich.",
    href: "/admin/settings/branding",
    badge: "Brand"
  },
  {
    title: "Integrationen",
    description: "Slack Webhook und ClickUp API Token sicher vorbereiten und testen.",
    href: "/admin/settings/integrations",
    badge: "Integrationen"
  },
  {
    title: "Tracking",
    description: "Open- und Click-Tracking bewusst konfigurieren.",
    href: "/admin/settings/tracking",
    badge: "Tracking"
  },
  {
    title: "Voice-KI",
    description: "Testmodus, Stimme, Gesprächsskript, Testanrufe und Freigabe für KI-Telefonate.",
    href: "/admin/settings/voice-ai",
    badge: "Voice"
  },
  {
    title: "Calling",
    description: "Telefonnummer und Anrufmodus für direkte Rückrufe speichern.",
    href: "/admin/settings/calling",
    badge: "Call"
  },
  {
    title: "Rechtliches",
    description: "Impressum, Datenschutz, Cookies und Löschanfragen.",
    href: "/admin/settings/legal",
    badge: "Legal"
  },
  {
    title: "Buchungskalender",
    description: "Externe Calendly-, Tidycal- oder Custom-Buchungsseiten.",
    href: "/admin/settings/booking",
    badge: "Booking"
  },
  {
    title: "Versandregeln",
    description: "Manueller Versand, maximal 20 Mails pro Batch, keine Cron-Ausführung.",
    href: "/admin/campaigns",
    badge: "Regeln"
  }
];

export default function SettingsPage() {
  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden pb-[calc(128px+env(safe-area-inset-bottom))] md:pb-0">
      <PageHeader
        title="Einstellungen"
        description="SaaS-Adminbereich für technische Konfiguration und Versandgrundlagen."
      />

      <div className="grid w-full min-w-0 max-w-full gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="block min-w-0 max-w-full">
            <AdminCard className="h-full transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="break-words text-lg font-semibold text-ink">{card.title}</h2>
                  <p className="mt-2 break-words text-sm leading-6 text-slate-500">{card.description}</p>
                </div>
                <StatusBadge tone="brand">{card.badge}</StatusBadge>
              </div>
            </AdminCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
