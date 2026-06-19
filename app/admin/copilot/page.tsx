import { AdminCard, PageHeader } from "@/components/admin/ui";
import { CopilotChat } from "@/components/admin/copilot-chat";
import { getSafeIntegrationSettings } from "@/lib/integrations";

export const dynamic = "force-dynamic";

export default async function CopilotPage() {
  const integrations = await getSafeIntegrationSettings();
  const openAiReady = integrations.openai.enabled && integrations.openai.keySet;

  return (
    <div>
      <PageHeader
        title="Copilot"
        description="KI-Assistent fuer deine Leads, Kampagnen und Kennzahlen. Beantwortet Fragen auf Basis deiner aktuellen Tasklytic-Daten."
      />
      {openAiReady ? (
        <AdminCard>
          <CopilotChat />
        </AdminCard>
      ) : (
        <AdminCard>
          <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Der Copilot benoetigt einen OpenAI API Key. Hinterlege ihn unter{" "}
            <a className="font-medium underline" href="/admin/settings">
              Einstellungen &rsaquo; Integrationen
            </a>
            , um den Assistenten zu aktivieren.
          </div>
        </AdminCard>
      )}
    </div>
  );
}
