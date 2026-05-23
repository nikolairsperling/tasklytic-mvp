import { NextResponse } from "next/server";
import { z } from "zod";
import { getErrorMessage, isRecordNotFoundError } from "@/lib/api";
import { campaignEmailVariantInputSchema, campaignStepInputSchema } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const campaignPatchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  sendingStatus: z.enum(["draft", "scheduled", "active", "paused", "completed"]).optional(),
  targetGroupId: z.string().trim().nullable().optional().transform((value) => value || null),
  offerId: z.string().trim().min(1, "Bitte Angebot auswählen").optional(),
  selectedProspectId: z.string().trim().nullable().optional().transform((value) => value || null),
  trackingEnabled: z.boolean().optional(),
  estimatedDealValue: z.coerce.number().int().nonnegative().nullable().optional(),
  estimatedCostPerLead: z.coerce.number().int().nonnegative().nullable().optional(),
  notes: z.string().nullable().optional(),
  scheduledStartAt: z
    .union([z.string().datetime(), z.literal(""), z.null()])
    .transform((value) => (value ? new Date(value) : null))
    .optional(),
  timezone: z.string().optional(),
  sendWindowStart: z.string().nullable().optional(),
  sendWindowEnd: z.string().nullable().optional(),
  weekdaysOnly: z.boolean().optional(),
  manualGoApproved: z.boolean().optional(),
  steps: z.array(campaignStepInputSchema).min(1).optional(),
  emailVariants: z.array(campaignEmailVariantInputSchema).min(2).optional()
});

export async function GET(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        emailVariants: { orderBy: { label: "asc" } },
        enrollments: {
          include: {
            prospect: true
          },
          orderBy: { createdAt: "desc" }
        },
        sendLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            prospect: {
              select: { companyName: true }
            },
            step: {
              select: { stepNumber: true }
            }
          }
        }
      }
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht geladen werden.") },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  try {
    const { id } = await params;
    const payload = campaignPatchSchema.parse(await request.json());
    const { steps, emailVariants, ...campaignData } = payload;
    console.info("CAMPAIGN_UPDATE", {
      campaignId: id,
      offerId: campaignData.offerId ?? undefined,
      targetGroupId: campaignData.targetGroupId ?? undefined,
      selectedProspectId: campaignData.selectedProspectId ?? undefined,
      hasSteps: Boolean(steps?.length)
    });
    const campaign = await prisma.$transaction(async (tx) => {
      const updated =
        Object.keys(campaignData).length > 0
          ? await tx.campaign.update({
              where: { id },
              data: campaignData
            })
          : await tx.campaign.findUnique({ where: { id } });

      if (!updated) {
        return null;
      }

      if (steps?.length) {
        const normalizedSteps = steps.map((step, index) => {
          const stepNumber = step.stepNumber ?? index + 1;
          const body = step.body ?? step.bodyText ?? "";
          return {
            position: stepNumber - 1,
            stepNumber,
            delayDays: step.delayDays,
            subject: step.subject,
            bodyText: body,
            body,
            isActive: step.isActive ?? true,
            bodyHtml: step.bodyHtml
          };
        });

        await tx.campaignStep.deleteMany({
          where: {
            campaignId: id,
            stepNumber: { notIn: normalizedSteps.map((step) => step.stepNumber) }
          }
        });

        for (const step of normalizedSteps) {
          await tx.campaignStep.upsert({
            where: {
              campaignId_stepNumber: {
                campaignId: id,
                stepNumber: step.stepNumber
              }
            },
            update: {
              position: step.position,
              delayDays: step.delayDays,
              subject: step.subject,
              bodyText: step.bodyText,
              body: step.body,
              isActive: step.isActive,
              bodyHtml: step.bodyHtml
            },
            create: {
              campaignId: id,
              position: step.position,
              stepNumber: step.stepNumber,
              delayDays: step.delayDays,
              subject: step.subject,
              bodyText: step.bodyText,
              body: step.body,
              isActive: step.isActive,
              bodyHtml: step.bodyHtml
            }
          });
        }
      }

      if (emailVariants?.length) {
        const activeCount = emailVariants.filter((variant) => variant.isActive !== false).length;
        if (activeCount < 2) {
          throw new Error("Für A/B-Testing sind mindestens zwei aktive Varianten erforderlich.");
        }
        for (const variant of emailVariants) {
          if (!/{{\s*landingPageUrl\s*}}|{{\s*landingpageUrl\s*}}/.test(variant.bodyText)) {
            throw new Error("Mail 1 muss in jeder Variante {{landingPageUrl}} enthalten.");
          }
        }
        await tx.campaignEmailVariant.deleteMany({
          where: {
            campaignId: id,
            label: { notIn: emailVariants.map((variant) => variant.label) }
          }
        });

        for (const [index, variant] of emailVariants.entries()) {
          await tx.campaignEmailVariant.upsert({
            where: {
              campaignId_label: {
                campaignId: id,
                label: variant.label
              }
            },
            update: {
              subject: variant.subject,
              bodyText: variant.bodyText,
              weight: variant.weight ?? (emailVariants.length === 2 ? 50 : index === 0 ? 34 : 33),
              landingpageUrl: variant.landingpageUrl,
              isActive: variant.isActive ?? true
            },
            create: {
              campaignId: id,
              label: variant.label,
              subject: variant.subject,
              bodyText: variant.bodyText,
              weight: variant.weight ?? (emailVariants.length === 2 ? 50 : index === 0 ? 34 : 33),
              landingpageUrl: variant.landingpageUrl,
              isActive: variant.isActive ?? true
            }
          });
        }
      }

      return tx.campaign.findUnique({
        where: { id: updated.id },
        include: {
          steps: { orderBy: { stepNumber: "asc" } },
          emailVariants: { orderBy: { label: "asc" } },
          enrollments: {
            include: {
              prospect: true
            },
            orderBy: { createdAt: "desc" }
          },
          sendLogs: {
            orderBy: { createdAt: "desc" },
            include: {
              prospect: {
                select: { companyName: true }
              },
              step: {
                select: { stepNumber: true }
              }
            }
          }
        }
      });
    });

    if (!campaign) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(campaign);
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht aktualisiert werden.") },
      { status: 400 }
    );
  }
}

export async function DELETE(_: Request, { params }: RouteProps) {
  try {
    const { id } = await params;

    await prisma.campaign.delete({
      where: { id }
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Kampagne nicht gefunden" }, { status: 404 });
    }

    return NextResponse.json(
      { error: getErrorMessage(error, "Kampagne konnte nicht gelöscht werden.") },
      { status: 500 }
    );
  }
}
