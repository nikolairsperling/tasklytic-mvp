import { EmailSignatureSettings } from "@/components/admin/email-signature-settings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EmailSignaturePage() {
  const signature = await prisma.emailSignature.findFirst({ where: { isDefault: true }, orderBy: { updatedAt: "desc" } });
  return <EmailSignatureSettings signature={signature} />;
}
