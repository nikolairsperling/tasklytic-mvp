import { AdminBackButton } from "@/components/admin/admin-back-button";
import { VoiceAiSettingsPanel } from "@/components/admin/voice-ai-settings-panel";
import { AdminCard, PageHeader } from "@/components/admin/ui";
import { readCallingSettings } from "@/lib/app-settings";
import { prisma } from "@/lib/prisma";
import { getVoiceAiTestModeState } from "@/lib/voice-ai-tests";

export const dynamic = "force-dynamic";

export default async function VoiceAiSettingsPage() {
  const [settings, prospects, state] = await Promise.all([
    readCallingSettings(),
    prisma.prospect.findMany({
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { id: true, companyName: true }
    }),
    getVoiceAiTestModeState()
  ]);
  const clientState = {
    ...state,
    recentCalls: state.recentCalls.map((call) => ({
      ...call,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString()
    }))
  };

  return (
    <div>
      <PageHeader
        title="Voice-KI"
        description="Voice-KI intern testen, Testanrufe protokollieren und Live-Betrieb erst nach Freigabe aktivieren."
        backButton={<AdminBackButton href="/admin/settings" />}
      />
      <AdminCard>
        <VoiceAiSettingsPanel settings={settings} prospects={prospects} initialState={clientState} />
      </AdminCard>
    </div>
  );
}
