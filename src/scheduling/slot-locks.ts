import { db, schema } from '../db/index.js';
import { eq, and, lt, gte, lte, ne } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

const LOCK_DURATION_MINUTES = 5;

export interface SlotLock {
  id: string;
  tenantId: string;
  serviceId: string;
  customerPhone: string;
  startTime: string;
  endTime: string;
  expiresAt: string;
}

/**
 * Reserve a slot for a customer. Idempotent for the same customer:
 * if they already hold the lock we just refresh the expiry. If anyone
 * else holds it (and the lock is still active), returns null.
 */
export async function lockSlot(
  tenantId: string,
  serviceId: string,
  customerPhone: string,
  startTime: string,
  endTime: string,
): Promise<SlotLock | null> {
  await cleanupExpired();

  // Existing lock by ANY active customer for this exact slot
  const [existing] = await db.select().from(schema.slotLocks)
    .where(and(
      eq(schema.slotLocks.tenantId, tenantId),
      eq(schema.slotLocks.serviceId, serviceId),
      eq(schema.slotLocks.startTime, startTime),
    ));

  if (existing) {
    if (existing.customerPhone === customerPhone) {
      // Refresh expiry for same customer
      const newExpiry = new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000).toISOString();
      await db.update(schema.slotLocks)
        .set({ expiresAt: newExpiry })
        .where(eq(schema.slotLocks.id, existing.id));
      return { ...existing, expiresAt: newExpiry };
    }
    // Held by someone else
    return null;
  }

  const id = uuid();
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60_000).toISOString();
  await db.insert(schema.slotLocks).values({
    id, tenantId, serviceId, customerPhone, startTime, endTime, expiresAt,
  });
  return { id, tenantId, serviceId, customerPhone, startTime, endTime, expiresAt };
}

/** Release any locks this customer holds for this tenant. Called on booking, change, or restart. */
export async function releaseLocksForCustomer(
  tenantId: string,
  customerPhone: string,
): Promise<void> {
  await db.delete(schema.slotLocks).where(and(
    eq(schema.slotLocks.tenantId, tenantId),
    eq(schema.slotLocks.customerPhone, customerPhone),
  ));
}

/** Release a specific lock by id. */
export async function releaseLock(lockId: string): Promise<void> {
  await db.delete(schema.slotLocks).where(eq(schema.slotLocks.id, lockId));
}

/** Get active locks for a given date that are NOT held by the given customer. */
export async function getActiveLocksOnDate(
  tenantId: string,
  date: string,
  excludeCustomerPhone: string,
): Promise<{ startTime: string; endTime: string }[]> {
  await cleanupExpired();
  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59`;
  return db.select({
    startTime: schema.slotLocks.startTime,
    endTime: schema.slotLocks.endTime,
  }).from(schema.slotLocks).where(and(
    eq(schema.slotLocks.tenantId, tenantId),
    gte(schema.slotLocks.startTime, dayStart),
    lte(schema.slotLocks.startTime, dayEnd),
    ne(schema.slotLocks.customerPhone, excludeCustomerPhone),
  ));
}

async function cleanupExpired(): Promise<void> {
  await db.delete(schema.slotLocks).where(
    lt(schema.slotLocks.expiresAt, new Date().toISOString()),
  );
}
