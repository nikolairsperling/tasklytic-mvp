import { prisma } from "@/lib/prisma";

export async function getAssetCounts() {
  const [
    accounts,
    sequences,
    emailTemplates,
    letterTemplates,
    videos,
    logos,
    messages,
    landingpages,
    images,
    booking
  ] = await Promise.all([
    prisma.connectedAccount.count(),
    prisma.campaign.count(),
    prisma.emailTemplate.count(),
    prisma.letterTemplate.count(),
    prisma.videoAsset.count(),
    prisma.assetFile.count({ where: { type: "logo" } }),
    prisma.messageTemplate.count(),
    prisma.landingpageTemplate.count(),
    prisma.imageAsset.count(),
    prisma.bookingCalendar.count()
  ]);

  return { accounts, sequences, emailTemplates, letterTemplates, videos, logos, messages, landingpages, images, booking };
}

export const assetCards = [
  { key: "accounts", href: "/admin/assets/accounts", title: "Verbundene Accounts", description: "SMTP, Mailbox, Slack, ClickUp und Custom Accounts." },
  { key: "sequences", href: "/admin/assets/sequences", title: "Kampagnen-Sequenzen", description: "Vorhandene Kampagnen als wiederverwendbare Sequenzen." },
  { key: "letterTemplates", href: "/admin/assets/briefvorlagen", title: "Briefvorlagen", description: "Google-Docs-Vorlagen für personalisierte Print-Kampagnen." },
  { key: "emailTemplates", href: "/admin/assets/email-templates", title: "E-Mail Vorlagen", description: "Betreff und Mailtexte für Outreach." },
  { key: "videos", href: "/admin/assets/videos", title: "Videos", description: "Persönliche Videos und Erklärvideos." },
  { key: "logos", href: "/admin/assets/logos", title: "Logos", description: "Markenlogos für Landingpages und Signaturen." },
  { key: "messages", href: "/admin/assets/messages", title: "Nachrichtenvorlagen", description: "Kurze wiederverwendbare Textbausteine." },
  { key: "landingpages", href: "/admin/landingpages/templates", title: "Landingpage Vorlagen", description: "Sales-Landingpage-Templates und Designs." },
  { key: "images", href: "/admin/assets/images", title: "Bilder", description: "Logos, Thumbnails und visuelle Assets." },
  { key: "booking", href: "/admin/assets/booking", title: "Buchungskalender", description: "Externe Calendly-, Tidycal- oder Custom-Links." }
] as const;
