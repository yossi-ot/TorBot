import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { desc, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

/** Only the demo-salon owner acts as platform super-admin (same rule as admin.ts). */
function isSuperAdmin(request: any): boolean {
  return request.tenantId === 'demo-salon' && request.role === 'owner';
}

export function registerLeadRoutes(app: FastifyInstance) {
  // PUBLIC: capture a lead from the landing page (exempted from auth in api/index.ts)
  app.post('/api/leads', async (request, reply) => {
    const body = (request.body || {}) as Record<string, unknown>;
    const name = String(body.name || '').trim();
    const businessName = String(body.businessName || '').trim();
    const phone = String(body.phone || '').trim();

    if (!name || !businessName || !phone) {
      return reply.code(400).send({ error: 'נא למלא שם, שם עסק ומספר וואטסאפ' });
    }

    await db.insert(schema.leads).values({ id: uuid(), name, businessName, phone, source: 'landing' });
    return { ok: true };
  });

  // SUPER-ADMIN: list all leads (newest first)
  app.get('/api/leads', async (request, reply) => {
    if (!isSuperAdmin(request)) return reply.code(403).send({ error: 'אין הרשאה' });
    return db.select().from(schema.leads).orderBy(desc(schema.leads.createdAt));
  });

  // SUPER-ADMIN: update a lead's status
  app.patch('/api/leads/:id', async (request, reply) => {
    if (!isSuperAdmin(request)) return reply.code(403).send({ error: 'אין הרשאה' });
    const { id } = request.params as { id: string };
    const { status } = (request.body || {}) as { status?: string };
    const allowed = ['new', 'contacted', 'converted', 'rejected'];
    if (!status || !allowed.includes(status)) {
      return reply.code(400).send({ error: 'סטטוס לא תקין' });
    }
    await db.update(schema.leads).set({ status }).where(eq(schema.leads.id, id));
    return { ok: true };
  });
}
