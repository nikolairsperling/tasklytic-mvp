import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const createFromLeadsSchema = z.object({
  prospectIds: z.array(z.string().min(1)).optional().default([]),
  leadListId: z.string().trim().optional(),
  targetGroupId: z.string().trim().min(1, "Bitte Zielgruppe auswählen"),
  offerId: z.string().trim().min(1, "Bitte Angebot auswählen"),
  templateId: z.string().trim().optional(),
  name: z.string().trim().min(1)
});

export async function POST(request: Request) {
  try {
    const payload = createFromLeadsSchema.parse(await request.json());
    const listMembers = payload.leadListId
      ? await prisma.leadListMember.findMany({ where: { leadListId: payload.leadListId }, select: { prospectId: true } })
      : [];
    const inputProspectIds = [...payload.prospectIds, ...listMembers.map((member) => member.prospectId)];
    if (inputProspectIds.length === 0) {
      return NextResponse.json({ error: "Bitte Leads oder Leadliste auswählen" }, { status: 400 });
    }
    const uniqueProspectIds = [...new Set(inputProspectIds)];
    const [targetGroup, offer, template, prospects] = await prisma.$transaction([
      prisma.targetGroup.findUnique({ where: { id: payload.targetGroupId }, select: { id: true } }),
      prisma.offer.findFirst({ where: { id: payload.offerId, workspaceId: "default" }, select: { id: true } }),
      payload.templateId
        ? prisma.emailTemplate.findUnique({ where: { id: payload.templateId }, select: { id: true, subject: true, body: true } })
        : prisma.emailTemplate.findFirst({ where: { id: "__missing__" }, select: { id: true, subject: true, body: true } }),
      prisma.prospect.findMany({
        where: { id: { in: uniqueProspectIds } },
        select: {
          id: true,
          decisionMakerEmail: true,
          companyEmail: true,
          slug: true,
          landingpageUrl: true,
          landingpageReviewStatus: true,
          companyStatus: true
        }
      })
    ]);

    if (!targetGroup) {
      return NextResponse.json({ error: "Bitte Zielgruppe auswählen" }, { status: 400 });
    }
    if (!offer) {
      return NextResponse.json({ error: "Bitte Angebot auswählen" }, { status: 400 });
    }

    const foundIds = new Set(prospects.map((prospect) => prospect.id));
    const duplicateCount = inputProspectIds.length - uniqueProspectIds.length;
    const missingCount = uniqueProspectIds.filter((id) => !foundIds.has(id)).length;
    const eligibleProspects = prospects.filter((prospect) =>
      Boolean((prospect.decisionMakerEmail || prospect.companyEmail) && (prospect.landingpageUrl || prospect.slug) && prospect.companyStatus !== "inactive" && prospect.companyStatus !== "unreachable")
    );
    const skipped = duplicateCount + missingCount + (prospects.length - eligibleProspects.length);
    const steps = buildCampaignSteps(template);

    const campaign = await prisma.campaign.create({
      data: {
        name: payload.name,
        status: "draft",
        targetGroupId: payload.targetGroupId,
        offerId: payload.offerId,
        trackingEnabled: false,
        steps: { create: steps },
        emailVariants: {
          create: [
            { label: "A", subject: steps[0].subject, bodyText: steps[0].bodyText, weight: 50 },
            { label: "B", subject: "Kurzer Blick auf {{companyName}}", bodyText: "Hallo {{firstName}},\n\nich habe dir eine kurze persönliche Seite vorbereitet.\n\nDort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.\n\nHier ansehen:\n{{landingPageUrl}}\n\nViele Grüße\nNikolai", weight: 50 }
          ]
        }
      },
      select: { id: true, offerId: true, targetGroupId: true, emailVariants: { select: { id: true, label: true }, orderBy: { label: "asc" } } }
    });

    const created = eligibleProspects.length > 0
      ? await prisma.campaignEnrollment.createMany({
          data: eligibleProspects.map((prospect, index) => ({
            campaignId: campaign.id,
            prospectId: prospect.id,
            currentStep: 1,
            emailVariantId: campaign.emailVariants[index % campaign.emailVariants.length]?.id,
            emailVariantLabel: campaign.emailVariants[index % campaign.emailVariants.length]?.label,
            status: "active"
          })),
          skipDuplicates: true
        })
      : { count: 0 };

    console.info("CAMPAIGN_CREATE", {
      campaignId: campaign.id,
      offerId: campaign.offerId,
      targetGroupId: campaign.targetGroupId
    });

    return NextResponse.json({
      campaignId: campaign.id,
      added: created.count,
      skipped: skipped + (eligibleProspects.length - created.count),
      failed: 0
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht erstellt werden.") },
      { status: 400 }
    );
  }
}

function buildCampaignSteps(template: { subject: string; body: string } | null) {
  const first = template
    ? { subject: template.subject, bodyText: template.body }
    : {
        subject: "Kurzer Blick auf {{companyName}}",
        bodyText: "Hallo {{firstName}},\n\nich habe Ihnen eine kurze persönliche Seite vorbereitet.\n\nDort zeige ich, wo bei Aufträgen, Abstimmung oder Übergaben möglicherweise unnötig Zeit verloren geht.\n\nHier ansehen:\n{{landingPageUrl}}\n\nViele Grüße\nNikolai"
      };
  return [
    { position: 0, stepNumber: 1, delayDays: 0, subject: first.subject, bodyText: first.bodyText, body: first.bodyText, isActive: true },
    { position: 1, stepNumber: 2, delayDays: 3, subject: "Nochmal kurz zu {{companyName}}", bodyText: "Hallo {{decisionMakerName}},\n\nich wollte meine kurze Nachricht nochmal nach oben holen. Passt ein kurzer Austausch?", body: "Hallo {{decisionMakerName}},\n\nich wollte meine kurze Nachricht nochmal nach oben holen. Passt ein kurzer Austausch?", isActive: true }
  ];
}
