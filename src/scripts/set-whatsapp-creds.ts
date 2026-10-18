import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

// One-off manual credential loader for a WhatsApp number obtained outside
// Embedded Signup (e.g. via a System User permanent token). Reads everything
// from env vars so the secret token is never typed into chat or committed.
//
// Usage (run on the live machine via `flyctl ssh console`):
//   TENANT_ID=demo-salon WABA_ID=... PHONE_NUMBER_ID=... ACCESS_TOKEN=... npx tsx src/scripts/set-whatsapp-creds.ts

async function main() {
  const tenantId = process.env.TENANT_ID;
  const wabaId = process.env.WABA_ID;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const accessToken = process.env.ACCESS_TOKEN;

  if (!tenantId || !wabaId || !phoneNumberId || !accessToken) {
    console.error('Missing required env var(s). Need TENANT_ID, WABA_ID, PHONE_NUMBER_ID, ACCESS_TOKEN.');
    process.exit(1);
  }

  const [existing] = await db.select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId));

  if (!existing) {
    console.error(`No tenant found with id "${tenantId}"`);
    process.exit(1);
  }

  await db.update(schema.tenants)
    .set({
      whatsappProvider: 'meta',
      wabaId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappAccessToken: accessToken,
      tokenExpiresAt: null, // System User token set to "Never" expire
      dialog360ApiKey: null,
    })
    .where(eq(schema.tenants.id, tenantId));

  console.log(`Updated tenant "${tenantId}" with WABA ${wabaId} / phone ${phoneNumberId}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
