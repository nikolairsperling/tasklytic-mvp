export type AdminNavItem = {
  href: string;
  label: string;
  key:
    | "overview"
    | "copilot"
    | "leads"
    | "leadScout"
    | "leadLists"
    | "import"
    | "prospects"
    | "followUps"
    | "targetGroups"
    | "workflow"
    | "impact"
    | "landingpages"
    | "campaigns"
    | "inbox"
    | "analytics"
    | "setup"
    | "offer"
    | "hotLeads"
    | "contacts"
    | "exclusions"
    | "deletions"
    | "assets"
    | "settings";
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const adminNavGroups: AdminNavGroup[] = [
  {
    label: "ÜBERSICHT",
    items: [
      { href: "/admin/dashboard", label: "Übersicht", key: "overview" },
      { href: "/admin/copilot", label: "Copilot", key: "copilot" }
    ]
  },
  {
    label: "LEADS",
    items: [
      { href: "/admin/leads", label: "Alle Leads", key: "leads" },
      { href: "/admin/lead-lists", label: "Leadlisten", key: "leadLists" },
      { href: "/admin/lead-scout", label: "Leads finden", key: "leadScout" },
      { href: "/admin/import", label: "Import", key: "import" },
      { href: "/admin/prospects", label: "Prospects", key: "prospects" },
      { href: "/admin/follow-ups", label: "Wiedervorlagen", key: "followUps" },
      { href: "/admin/target-groups", label: "Zielgruppen", key: "targetGroups" }
    ]
  },
  {
    label: "VERARBEITUNG",
    items: [
      { href: "/admin/workflows/lead-to-outreach", label: "Workflow", key: "workflow" },
      { href: "/admin/impact", label: "Impact Studio", key: "impact" }
    ]
  },
  {
    label: "CONVERSION",
    items: [
      { href: "/admin/landingpages", label: "Landingpages", key: "landingpages" },
      { href: "/admin/campaigns", label: "Kampagnen", key: "campaigns" },
      { href: "/admin/inbox", label: "Inbox", key: "inbox" }
    ]
  },
  {
    label: "ANALYSE",
    items: [
      { href: "/admin/analytics", label: "Analytics", key: "analytics" }
    ]
  },
  {
    label: "SETUP",
    items: [
      { href: "/admin/setup/offers", label: "Angebote", key: "offer" },
      { href: "/admin/assets", label: "Assets", key: "assets" },
      { href: "/admin/settings", label: "Einstellungen", key: "settings" }
    ]
  }
];

export const adminRouteItems: AdminNavItem[] = [
  { href: "/admin", label: "Übersicht", key: "overview" },
  { href: "/admin/dashboard", label: "Übersicht", key: "overview" },
  { href: "/admin/copilot", label: "Copilot", key: "copilot" },
  ...adminNavGroups.flatMap((group) => group.items),
  { href: "/admin/setup", label: "Setup Center", key: "setup" },
  { href: "/admin/setup/offers", label: "Angebote", key: "offer" },
  { href: "/admin/hot-leads", label: "Hot Leads", key: "hotLeads" },
  { href: "/admin/contacts", label: "Alle Kontakte", key: "contacts" },
  { href: "/admin/exclusions", label: "Ausschlüsse", key: "exclusions" },
  { href: "/admin/deletion-requests", label: "Löschanträge", key: "deletions" },
  { href: "/admin/assets", label: "Assets", key: "assets" },
  { href: "/admin/settings", label: "Einstellungen", key: "settings" },
  { href: "/admin/settings/system-status", label: "Systemstatus", key: "settings" },
  { href: "/admin/settings/branding", label: "Branding", key: "settings" }
];

export function flattenAdminNav() {
  return adminNavGroups.flatMap((group) => group.items);
}

export function getActiveAdminItem(pathname: string): AdminNavItem {
  const cleanPathname = pathname.split("?")[0];
  return (
    adminRouteItems
      .filter((item) => cleanPathname === item.href || cleanPathname.startsWith(`${item.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0] ?? adminNavGroups[0].items[0]
  );
}
