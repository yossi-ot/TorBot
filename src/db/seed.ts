import 'dotenv/config';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcrypt';
import * as schema from './schema.js';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/torbot';

async function seed() {
  console.log('Seeding database...');

  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });

  const tenantId = 'demo-salon';

  // Check if already seeded
  const [existing] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, tenantId));

  if (existing) {
    if (process.env.WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_ACCESS_TOKEN) {
      await db.update(schema.tenants).set({
        whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || existing.whatsappPhoneNumberId,
        whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || existing.whatsappAccessToken,
      }).where(eq(schema.tenants.id, tenantId));
    }
    console.log('Database already seeded. Updated tokens from .env.');
    await pool.end();
    process.exit(0);
  }

  // Create demo tenant
  await db.insert(schema.tenants).values({
    id: tenantId,
    name: 'מספרת שרה',
    phone: '0501234567',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'test_phone_id',
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'test_access_token',
    timezone: 'Asia/Jerusalem',
    address: 'דיזנגוף 99, תל אביב',
    cancellationPolicy: 'ביטול עד 2 שעות לפני התור',
  });

  // Create demo user
  const passwordHash = await bcrypt.hash('admin123', 10);
  await db.insert(schema.users).values({
    id: uuid(),
    email: 'demo@torbot.co.il',
    passwordHash,
    tenantId,
    role: 'owner',
  });

  // Services
  const services = [
    { id: uuid(), tenantId, name: 'תספורת גברים', durationMinutes: 30, price: 80, sortOrder: 1 },
    { id: uuid(), tenantId, name: 'תספורת + זקן', durationMinutes: 45, price: 120, sortOrder: 2 },
    { id: uuid(), tenantId, name: 'צבע', durationMinutes: 60, price: 200, sortOrder: 3 },
    { id: uuid(), tenantId, name: 'תספורת נשים', durationMinutes: 45, price: 150, sortOrder: 4 },
  ];

  for (const service of services) {
    await db.insert(schema.services).values(service);
  }

  // Working hours: Sunday-Thursday 09:00-18:00, Friday 09:00-13:00
  const days = [
    { day: 0, start: '09:00', end: '18:00' },
    { day: 1, start: '09:00', end: '18:00' },
    { day: 2, start: '09:00', end: '18:00' },
    { day: 3, start: '09:00', end: '18:00' },
    { day: 4, start: '09:00', end: '18:00' },
    { day: 5, start: '09:00', end: '13:00' },
  ];

  for (const d of days) {
    await db.insert(schema.workingHours).values({
      id: uuid(),
      tenantId,
      staffId: null,
      dayOfWeek: d.day,
      startTime: d.start,
      endTime: d.end,
    });
  }

  console.log('Database seeded successfully!');
  console.log('Tenant: מספרת שרה (demo-salon)');
  console.log('User: demo@torbot.co.il / admin123');
  console.log(`Services: ${services.map(s => s.name).join(', ')}`);

  await pool.end();
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
