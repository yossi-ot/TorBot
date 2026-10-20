import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { sendWhatsAppMessage } from '../whatsapp/sender.js';
import { credentialsFromTenant } from '../whatsapp/index.js';

// How long a customer stays "with" the business they last talked to before
// we ask again, when they're linked to more than one.
const RECENT_CONTEXT_MS = 2 * 60 * 60 * 1000; // 2 hours
const PENDING_SELECTION_TTL_MS = 10 * 60 * 1000; // 10 minutes

type Tenant = typeof schema.tenants.$inferSelect;

async function linkCustomerToTenant(customerPhone: string, tenantId: string) {
  const now = new Date().toISOString();
  const [existing] = await db.select().from(schema.customerTenantLinks)
    .where(and(
      eq(schema.customerTenantLinks.customerPhone, customerPhone),
      eq(schema.customerTenantLinks.tenantId, tenantId),
    ));

  if (existing) {
    await db.update(schema.customerTenantLinks)
      .set({ lastActiveAt: now })
      .where(and(
        eq(schema.customerTenantLinks.customerPhone, customerPhone),
        eq(schema.customerTenantLinks.tenantId, tenantId),
      ));
  } else {
    await db.insert(schema.customerTenantLinks).values({ customerPhone, tenantId, createdAt: now, lastActiveAt: now });
  }
}

async function clearPendingSelection(customerPhone: string) {
  await db.delete(schema.pendingTenantSelections).where(eq(schema.pendingTenantSelections.customerPhone, customerPhone));
}

async function askWhichBusiness(customerPhone: string, tenants: Tenant[]) {
  await db.insert(schema.pendingTenantSelections).values({
    customerPhone,
    tenantIds: JSON.stringify(tenants.map(t => t.id)),
    createdAt: new Date().toISOString(),
  }).onConflictDoUpdate({
    target: schema.pendingTenantSelections.customerPhone,
    set: { tenantIds: JSON.stringify(tenants.map(t => t.id)), createdAt: new Date().toISOString() },
  });

  const list = tenants.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
  // Any of the candidate tenants shares the same platform number/credentials.
  await sendWhatsAppMessage({
    ...(await credentialsFromTenant(tenants[0])),
    to: customerPhone,
    text: `לאיזה עסק הפנייה שלך?\n${list}\n\nהשיבו במספר המתאים.`,
  });
}

/**
 * Resolves which tenant a message on the shared platform number belongs to.
 * `defaultTenant` (the shared-number owner) is used when the customer has no
 * code and no history at all - today that keeps every "cold" message on the
 * number landing on the owner, exactly like before this number was shared.
 * Returns undefined only when there's genuinely no default and no match
 * (or we just asked the customer to disambiguate).
 */
export async function resolveSharedTenant(
  customerPhone: string,
  text: string,
  defaultTenant?: Tenant,
): Promise<Tenant | undefined> {
  const trimmed = text.trim();

  // 1. Are we waiting on a "which business?" reply from this customer?
  const [pending] = await db.select().from(schema.pendingTenantSelections)
    .where(eq(schema.pendingTenantSelections.customerPhone, customerPhone));
  if (pending) {
    const fresh = Date.now() - new Date(pending.createdAt).getTime() < PENDING_SELECTION_TTL_MS;
    const ids: string[] = JSON.parse(pending.tenantIds);
    const choice = parseInt(trimmed, 10);
    if (fresh && choice >= 1 && choice <= ids.length) {
      await clearPendingSelection(customerPhone);
      await linkCustomerToTenant(customerPhone, ids[choice - 1]);
      const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, ids[choice - 1]));
      return tenant;
    }
    // Stale prompt or an unrelated reply - drop it and resolve normally below.
    await clearPendingSelection(customerPhone);
  }

  // 2. Does the message carry an entry code (fresh click on a business's link)?
  if (trimmed) {
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.entryCode, trimmed));
    if (tenant) {
      await linkCustomerToTenant(customerPhone, tenant.id);
      return tenant;
    }
  }

  // 3. Fall back to businesses this customer has already talked to before.
  const links = await db.select().from(schema.customerTenantLinks)
    .where(eq(schema.customerTenantLinks.customerPhone, customerPhone));
  if (links.length === 0) {
    if (defaultTenant) await linkCustomerToTenant(customerPhone, defaultTenant.id);
    return defaultTenant;
  }

  if (links.length === 1) {
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, links[0].tenantId));
    return tenant;
  }

  const sortedByRecency = [...links].sort(
    (a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime(),
  );
  const mostRecent = sortedByRecency[0];
  if (Date.now() - new Date(mostRecent.lastActiveAt).getTime() < RECENT_CONTEXT_MS) {
    const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, mostRecent.tenantId));
    if (tenant) await linkCustomerToTenant(customerPhone, tenant.id);
    return tenant;
  }

  // Genuinely ambiguous - ask, and stop here for this turn.
  const tenants = await db.select().from(schema.tenants)
    .where(inArray(schema.tenants.id, sortedByRecency.map(l => l.tenantId)));
  const ordered = sortedByRecency
    .map(l => tenants.find(t => t.id === l.tenantId))
    .filter((t): t is Tenant => !!t);
  await askWhichBusiness(customerPhone, ordered);
  return undefined;
}
