import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { signJwt, verifyJwt } from './middleware.js';
import { generateEntryCode } from '../utils/entry-code.js';

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

    const token = signJwt({ userId: user.id, tenantId: user.tenantId, role: user.role });
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

    const tenantId = uuid();
    const userId = uuid();
    const passwordHash = await bcrypt.hash(password, 10);
    const entryCode = await generateEntryCode(businessName);

    // Create tenant - on the shared platform number by default. Businesses
    // with their own approved WhatsApp number still connect it from Settings.
    await db.insert(schema.tenants).values({
      id: tenantId,
      name: businessName,
      phone,
      whatsappPhoneNumberId: '',
      whatsappAccessToken: '',
      entryCode,
      timezone: 'Asia/Jerusalem',
      cancellationPolicy: 'ביטול עד 2 שעות לפני התור',
      icalToken: uuid(),
    });

    // Create user
    await db.insert(schema.users).values({
      id: userId,
      email: email.toLowerCase(),
      passwordHash,
      tenantId,
      role: 'owner',
    });

    // Default working hours (Sun-Thu 09:00-18:00, Fri 09:00-13:00)
    const defaultHours = [
      { day: 0, start: '09:00', end: '18:00' },
      { day: 1, start: '09:00', end: '18:00' },
      { day: 2, start: '09:00', end: '18:00' },
      { day: 3, start: '09:00', end: '18:00' },
      { day: 4, start: '09:00', end: '18:00' },
      { day: 5, start: '09:00', end: '13:00' },
    ];

    for (const h of defaultHours) {
      await db.insert(schema.workingHours).values({
        id: uuid(),
        tenantId,
        staffId: null,
        dayOfWeek: h.day,
        startTime: h.start,
        endTime: h.end,
      });
    }

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

    const token = signJwt({ userId: user.id, tenantId: user.tenantId, role: user.role });
    return { token };
  });
}
