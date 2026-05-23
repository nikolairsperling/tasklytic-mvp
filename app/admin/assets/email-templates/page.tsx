import { AssetListManager } from "@/components/admin/asset-list-manager";

export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <AssetListManager
      title="E-Mail Vorlagen"
      description="Wiederverwendbare E-Mail-Betreffzeilen und Texte."
      endpoint="/api/assets/email-templates"
      items={[]}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "subject", label: "Betreff", required: true },
        { name: "body", label: "Text", textarea: true, required: true },
        { name: "category", label: "Kategorie" }
      ]}
      enableEmailTemplateAi
    />
  );
}
