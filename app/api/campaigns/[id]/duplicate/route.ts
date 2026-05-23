import { NextResponse } from "next/server";
import { getErrorMessage } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const source = await prisma.campaign.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        emailVariants: { orderBy: { label: "asc" } },
        enrollments: { orderBy: { createdAt: "asc" } }
      }
    });

    if (!source) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    const campaign = await prisma.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          name: `${source.name} Kopie`,
          status: "draft",
          targetGroupId: source.targetGroupId,
          offerId: source.offerId,
          selectedProspectId: source.selectedProspectId,
          trackingEnabled: source.trackingEnabled,
          estimatedDealValue: source.estimatedDealValue,
          estimatedCostPerLead: source.estimatedCostPerLead,
          notes: source.notes,
          scheduledStartAt: source.scheduledStartAt,
          timezone: source.timezone,
          sendWindowStart: source.sendWindowStart,
          sendWindowEnd: source.sendWindowEnd,
          weekdaysOnly: source.weekdaysOnly,
          manualGoApproved: false,
          sendingStatus: "draft",
          steps: {
            create: source.steps.map((step) => ({
              position: step.position,
              stepNumber: step.stepNumber,
              delayDays: step.delayDays,
              subject: step.subject,
              bodyText: step.bodyText,
              body: step.body,
              isActive: step.isActive,
              bodyHtml: step.bodyHtml
            }))
          },
          emailVariants: {
            create: source.emailVariants.map((variant) => ({
              label: variant.label,
              subject: variant.subject,
              bodyText: variant.bodyText,
              weight: variant.weight,
              landingpageUrl: variant.landingpageUrl,
              isActive: variant.isActive
            }))
          }
        },
        include: { emailVariants: { orderBy: { label: "asc" } } }
      });

      if (source.enrollments.length > 0) {
        const variantsByLabel = new Map(created.emailVariants.map((variant) => [variant.label, variant]));
        await tx.campaignEnrollment.createMany({
          data: source.enrollments.map((enrollment) => {
            const variant = enrollment.emailVariantLabel ? variantsByLabel.get(enrollment.emailVariantLabel) : null;
            return {
              campaignId: created.id,
              prospectId: enrollment.prospectId,
              status: "active",
              currentStep: 0,
              nextSendAt: created.scheduledStartAt ?? new Date(),
              emailVariantId: variant?.id,
              emailVariantLabel: variant?.label ?? enrollment.emailVariantLabel
            };
          }),
          skipDuplicates: true
        });
      }

      return created;
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht dupliziert werden.") },
      { status: 500 }
    );
  }
}
