import cron from 'node-cron';
import { db, schema } from '../db/index.js';
import { and, isNotNull, ne } from 'drizzle-orm';

/**
 * Start the token expiry check cron job.
 * Runs daily at 9:00 AM, checks for WhatsApp tokens nearing expiration.
 * Meta long-lived tokens are valid for 60 days and cannot be auto-refreshed.
 */
export function startTokenCheckJob() {
  cron.schedule('0 9 * * *', () => {
    checkTokenExpiry().catch(err => console.error('Token check job error:', err));
  });

  console.log('Token check job started (daily at 9:00)');
}

async function checkTokenExpiry() {
  const now = new Date();

  // Find all tenants with active WhatsApp connections
  const tenants = await db.select({
    id: schema.tenants.id,
    name: schema.tenants.name,
    tokenExpiresAt: schema.tenants.tokenExpiresAt,
  })
    .from(schema.tenants)
    .where(and(
      isNotNull(schema.tenants.tokenExpiresAt),
      ne(schema.tenants.whatsappAccessToken, ''),
    ));

  for (const tenant of tenants) {
    if (!tenant.tokenExpiresAt) continue;

    const expiresAt = new Date(tenant.tokenExpiresAt);
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) {
      console.warn(`[Token Expired] Tenant "${tenant.name}" (${tenant.id}) - token expired ${Math.abs(daysLeft)} days ago`);
    } else if (daysLeft <= 7) {
      console.warn(`[Token Expiring] Tenant "${tenant.name}" (${tenant.id}) - ${daysLeft} days remaining`);
    }
  }
}
