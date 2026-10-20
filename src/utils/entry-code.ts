import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

/** Short, human-shareable code used in a tenant's WhatsApp entry link. */
export async function generateEntryCode(label: string): Promise<string> {
  const prefix = label
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 8)
    .toUpperCase() || 'BIZ';

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${prefix}${Math.floor(1000 + Math.random() * 9000)}`;
    const [existing] = await db.select({ id: schema.tenants.id }).from(schema.tenants)
      .where(eq(schema.tenants.entryCode, code));
    if (!existing) return code;
  }
  // Astronomically unlikely, but fall back to something guaranteed unique.
  return `${prefix}${Date.now()}`;
}
