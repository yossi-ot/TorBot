import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { signJwt, verifyJwt } from './middleware.js';
import { createTenantWithOwner } from '../db/provision-tenant.js';

export function registerAuthRoutes(app: FastifyInstance) {
  // Login with email + password
  app.post('/api/auth/login', async (request, reply) => {
    const { email, password } = request.body as { email: string; password: string };

    if (!email || !password) {
      return reply.code(400).send({ error: 'נדרש אימייל וסיסמה' });
    }

    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()));

    if (!user) {
      return reply.code(401).send({ error: 'אימייל או סיסמה שגויים' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return reply.code(401).send({ error: 'אימייל או סיסמה שגויים' });
    }

    const token = signJwt({ userId: user.id, tenantId: user.tenantId ?? '', role: user.role });
    return { token };
  });

  // Register new business
  app.post('/api/auth/register', async (request, reply) => {
    const { email, password, businessName, phone } = request.body as {
      email: string;
      password: string;
      businessName: string;
      phone: string;
    };

    if (!email || !password || !businessName || !phone) {
      return reply.code(400).send({ error: 'כל השדות נדרשים' });
    }

    // Check if email already exists
    const [existing] = await db.select().from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()));

    if (existing) {
      return reply.code(409).send({ error: 'אימייל כבר קיים במערכת' });
    }

    const { tenantId, userId } = await createTenantWithOwner({ businessName, phone, email, password });

    const token = signJwt({ userId, tenantId, role: 'owner' });
    return { token, tenantId };
  });

  // Refresh token - returns a new JWT if current one is still valid
  app.post('/api/auth/refresh', async (request, reply) => {
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const payload = verifyJwt(auth.slice(7));
    if (!payload) {
      return reply.code(401).send({ error: 'Invalid or expired token' });
    }

    // Verify user still exists
    const [user] = await db.select().from(schema.users)
      .where(eq(schema.users.id, payload.userId));

    if (!user) {
      return reply.code(401).send({ error: 'User not found' });
    }

    const token = signJwt({ userId: user.id, tenantId: user.tenantId ?? '', role: user.role });
    return { token };
  });
}
