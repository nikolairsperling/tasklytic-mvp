import { AdminCard, PageHeader, StatusBadge } from "@/components/admin/ui";
import { InboxActions } from "@/components/admin/inbox-actions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type InboxPageProps = {
  searchParams?: Promise<{ filter?: string }>;
};

export default async function InboxPage({ searchParams }: InboxPageProps) {
  const params = (await searchParams) ?? {};
  const repliesOnly = params.filter === "replies";
  const emails = await prisma.inboundEmail.findMany({
    where: repliesOnly ? { category: { not: "auto_reply" } } : {},
    orderBy: { receivedAt: "desc" },
    include: {
      matchedProspect: { select: { companyName: true } },
      matchedCampaign: { select: { name: true } }
    },
    take: 100
  });

  return (
    <div>
      <PageHeader
        title="Inbox"
        description="Manuell synchronisierte Antworten aus dem IMAP-Postfach. Keine permanente Mailbox-Schleife."
        action={<InboxActions />}
      />
      <AdminCard>
        <div className="space-y-3 md:hidden">
          {emails.length === 0 ? (
            <p className="text-sm text-slate-500">Keine E-Mails vorhanden.</p>
          ) : emails.map((email) => (
            <article key={email.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{email.fromName ?? email.fromEmail}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{email.fromEmail}</p>
                </div>
                <StatusBadge tone={email.status === "unread" ? "brand" : "neutral"}>{email.status}</StatusBadge>
              </div>
              <p className="mt-3 break-words text-sm font-medium text-slate-700">{email.subject}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge tone={toneForCategory(email.category)}>{email.category}</StatusBadge>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Confidence {email.confidence}%</span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{email.aiSummary ?? "Keine Zusammenfassung"}</p>
              <div className="mt-3 grid gap-1 text-xs text-slate-400">
                <span>{email.receivedAt.toLocaleString("de-DE")}</span>
                <span>Prospect: {email.matchedProspect?.companyName ?? "nicht zugeordnet"}</span>
                <span>Kampagne: {email.matchedCampaign?.name ?? "keine"}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.16em] text-slate-400">
              <tr>
                <th className="py-3">Empfangen</th>
                <th>Von</th>
                <th>Betreff</th>
                <th>Kategorie</th>
                <th>Status</th>
                <th>Prospect</th>
                <th>Kampagne</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {emails.map((email) => (
                <tr key={email.id}>
                  <td className="py-3 text-slate-400">{email.receivedAt.toLocaleString("de-DE")}</td>
                  <td>
                    <div className="font-medium text-ink">{email.fromName ?? email.fromEmail}</div>
                    <div className="text-xs text-slate-500">{email.fromEmail}</div>
                  </td>
                  <td>{email.subject}</td>
                  <td>
                    <div className="space-y-1">
                      <StatusBadge tone={toneForCategory(email.category)}>{email.category}</StatusBadge>
                      <div className="text-xs text-slate-500">{email.aiSummary ?? "Keine Zusammenfassung"}</div>
                      <div className="text-xs text-slate-400">Confidence {email.confidence}%</div>
                    </div>
                  </td>
                  <td><StatusBadge tone={email.status === "unread" ? "brand" : "neutral"}>{email.status}</StatusBadge></td>
                  <td>{email.matchedProspect?.companyName ?? "nicht zugeordnet"}</td>
                  <td>{email.matchedCampaign?.name ?? "keine"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}

function toneForCategory(category: string) {
  if (category === "positive") return "green";
  if (category === "negative") return "red";
  if (category === "question") return "amber";
  if (category === "auto_reply") return "neutral";
  return "neutral";
}
