import { PrismaClient } from "@prisma/client";
import {
  getDatabaseUrl,
  isClearlyTestDatabase,
  maskDatabaseUrl
} from "./env-database-utils.mjs";

const databaseUrl = process.env.PERSISTENCE_TEST_DATABASE_URL || process.env.TEST_DATABASE_URL || getDatabaseUrl();
const allowNonTestDatabase = process.env.ALLOW_NON_TEST_DATABASE === "1";
const verifyOnly = process.argv.includes("--verify-only");

if (!databaseUrl) {
  console.error("DATABASE_URL fehlt.");
  process.exit(1);
}

if (!allowNonTestDatabase && !isClearlyTestDatabase(databaseUrl)) {
  console.error("Persistence smoke test abgebrochen: DATABASE_URL ist keine klar erkennbare Test-Datenbank.");
  console.error(`Aktuelle Datenbank: ${maskDatabaseUrl(databaseUrl)}`);
  console.error("Nutze z. B. tasklytic_test oder setze ALLOW_NON_TEST_DATABASE=1 bewusst fuer eine manuelle Pruefung.");
  process.exit(1);
}

process.env.DATABASE_URL = databaseUrl;

const ids = {
  offer: "persistence-smoke-offer",
  prospect: "persistence-smoke-prospect",
  leadList: "persistence-smoke-lead-list",
  leadListMember: "persistence-smoke-lead-list-member",
  campaign: "persistence-smoke-campaign",
  bookingCalendar: "persistence-smoke-booking-calendar",
  messageTemplate: "persistence-smoke-message-template",
  letterTemplate: "persistence-smoke-letter-template",
  landingpageTemplate: "persistence-smoke-landingpage-template"
};

async function seed(client) {
  await client.offer.upsert({
    where: { id: ids.offer },
    update: {
      name: "Persistenz Smoke Angebot",
      serviceDescription: "Persistenztest Service",
      targetAudienceDescription: "Persistenztest Zielgruppe",
      coreProblems: ["Datenverlust nach Neustart"],
      solutions: ["Persistente PostgreSQL Speicherung"],
      valueProposition: "Daten bleiben nach Neustart vorhanden.",
      toneOfVoice: "professionell"
    },
    create: {
      id: ids.offer,
      name: "Persistenz Smoke Angebot",
      serviceDescription: "Persistenztest Service",
      targetAudienceDescription: "Persistenztest Zielgruppe",
      coreProblems: ["Datenverlust nach Neustart"],
      solutions: ["Persistente PostgreSQL Speicherung"],
      valueProposition: "Daten bleiben nach Neustart vorhanden.",
      toneOfVoice: "professionell",
      isDefault: false
    }
  });

  await client.prospect.upsert({
    where: { id: ids.prospect },
    update: { companyName: "Persistenz Smoke Lead", city: "Berlin" },
    create: { id: ids.prospect, companyName: "Persistenz Smoke Lead", city: "Berlin" }
  });

  await client.leadList.upsert({
    where: { id: ids.leadList },
    update: { name: "Persistenz Smoke Leadliste" },
    create: { id: ids.leadList, name: "Persistenz Smoke Leadliste" }
  });

  await client.leadListMember.upsert({
    where: { id: ids.leadListMember },
    update: {},
    create: { id: ids.leadListMember, leadListId: ids.leadList, prospectId: ids.prospect }
  });

  await client.integrationSettings.upsert({
    where: { type: "openai" },
    update: { enabled: true, configJson: { smoke: true }, encryptedSecret: "encrypted-smoke-value" },
    create: { type: "openai", enabled: true, configJson: { smoke: true }, encryptedSecret: "encrypted-smoke-value" }
  });

  await client.smtpSettings.upsert({
    where: { id: "default" },
    update: {
      host: "smtp.smoke.test",
      port: 587,
      secure: false,
      user: "smoke@example.com",
      encryptedPassword: "encrypted-smoke-password",
      fromEmail: "smoke@example.com",
      fromName: "Smoke Test"
    },
    create: {
      id: "default",
      host: "smtp.smoke.test",
      port: 587,
      secure: false,
      user: "smoke@example.com",
      encryptedPassword: "encrypted-smoke-password",
      fromEmail: "smoke@example.com",
      fromName: "Smoke Test"
    }
  });

  await client.bookingCalendar.upsert({
    where: { id: ids.bookingCalendar },
    update: { displayName: "Persistenz Smoke Kalender", bookingUrl: "https://example.com/book" },
    create: { id: ids.bookingCalendar, provider: "custom", displayName: "Persistenz Smoke Kalender", bookingUrl: "https://example.com/book" }
  });

  await client.messageTemplate.upsert({
    where: { id: ids.messageTemplate },
    update: { name: "Persistenz Smoke Nachricht", bodyText: "Hallo {{Empfaenger_Vorname}}, {{Terminlink}}" },
    create: { id: ids.messageTemplate, name: "Persistenz Smoke Nachricht", channel: "email", category: "Erstkontakt", status: "active", bodyText: "Hallo {{Empfaenger_Vorname}}, {{Terminlink}}" }
  });

  await client.letterTemplate.upsert({
    where: { id: ids.letterTemplate },
    update: { name: "Persistenz Smoke Brief", googleDocsText: "{{Empfaenger_Vorname}} {{QRCode}}" },
    create: {
      id: ids.letterTemplate,
      name: "Persistenz Smoke Brief",
      googleDocsText: "{{Empfaenger_Vorname}} {{QRCode}}",
      imageAltTexts: ["{{QRCode}}"],
      detectedRecipientVariables: ["{{Empfaenger_Vorname}}"],
      detectedPersonalizationVariables: ["{{QRCode}}"],
      pageCount: 1,
      isChecked: true,
      lastCheckStatus: "passed"
    }
  });

  await client.landingpageTemplate.upsert({
    where: { id: ids.landingpageTemplate },
    update: { name: "Persistenz Smoke Landingpage", heroHeadline: "Persistenz Smoke" },
    create: {
      id: ids.landingpageTemplate,
      name: "Persistenz Smoke Landingpage",
      heroHeadline: "Persistenz Smoke",
      beforeItems: [],
      afterItems: [],
      faqJson: []
    }
  });

  await client.campaign.upsert({
    where: { id: ids.campaign },
    update: { name: "Persistenz Smoke Kampagne", offerId: ids.offer },
    create: { id: ids.campaign, name: "Persistenz Smoke Kampagne", offerId: ids.offer }
  });
}

async function verify(client) {
  const checks = {
    offer: await client.offer.findUnique({ where: { id: ids.offer } }),
    prospect: await client.prospect.findUnique({ where: { id: ids.prospect } }),
    leadListMember: await client.leadListMember.findUnique({ where: { id: ids.leadListMember } }),
    integrationSettings: await client.integrationSettings.findUnique({ where: { type: "openai" } }),
    smtpSettings: await client.smtpSettings.findUnique({ where: { id: "default" } }),
    bookingCalendar: await client.bookingCalendar.findUnique({ where: { id: ids.bookingCalendar } }),
    messageTemplate: await client.messageTemplate.findUnique({ where: { id: ids.messageTemplate } }),
    letterTemplate: await client.letterTemplate.findUnique({ where: { id: ids.letterTemplate } }),
    landingpageTemplate: await client.landingpageTemplate.findUnique({ where: { id: ids.landingpageTemplate } }),
    campaign: await client.campaign.findUnique({ where: { id: ids.campaign } })
  };

  const missing = Object.entries(checks).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Persistenzpruefung fehlgeschlagen. Fehlend: ${missing.join(", ")}`);
  }
}

let client = new PrismaClient();
if (!verifyOnly) {
  await seed(client);
}
await client.$disconnect();

client = new PrismaClient();
await verify(client);
await client.$disconnect();

console.log(verifyOnly ? "Persistence smoke verification passed." : "Persistence smoke test passed after Prisma reconnect.");
