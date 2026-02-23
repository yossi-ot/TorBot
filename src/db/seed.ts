import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

console.log('Seeding database...');

// Create tables manually (since we're not using migrations for MVP)
const sqlite = (db as any).session?.client;
if (sqlite) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      whatsapp_phone_number_id TEXT NOT NULL,
      whatsapp_access_token TEXT NOT NULL,
      timezone TEXT NOT NULL DEFAULT 'Asia/Jerusalem',
      address TEXT,
      ai_system_prompt TEXT,
      cancellation_policy TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ILS',
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS staff_members (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS staff_services (
      staff_id TEXT NOT NULL REFERENCES staff_members(id),
      service_id TEXT NOT NULL REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS working_hours (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      staff_id TEXT REFERENCES staff_members(id),
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS blocked_slots (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      staff_id TEXT REFERENCES staff_members(id),
      start_datetime TEXT NOT NULL,
      end_datetime TEXT NOT NULL,
      reason TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      phone TEXT NOT NULL,
      name TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      service_id TEXT NOT NULL REFERENCES services(id),
      staff_id TEXT REFERENCES staff_members(id),
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      source TEXT NOT NULL DEFAULT 'whatsapp_bot',
      reminder_sent INTEGER NOT NULL DEFAULT 0,
      cancelled_at TEXT,
      cancellation_reason TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

// Demo tenant: מספרת שרה
const tenantId = 'demo-salon';

// Check if already seeded
const existing = db.select().from(schema.tenants)
  .where(eq(schema.tenants.id, tenantId))
  .get();

if (existing) {
  // Update with latest tokens from .env
  db.update(schema.tenants).set({
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || existing.whatsappPhoneNumberId,
    whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || existing.whatsappAccessToken,
  }).where(eq(schema.tenants.id, tenantId)).run();
  console.log('Database already seeded. Updated tokens from .env.');
  process.exit(0);
}

db.insert(schema.tenants).values({
  id: tenantId,
  name: 'מספרת שרה',
  phone: '0501234567',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'test_phone_id',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'test_access_token',
  timezone: 'Asia/Jerusalem',
  address: 'דיזנגוף 99, תל אביב',
  cancellationPolicy: 'ביטול עד 2 שעות לפני התור',
}).run();

// Services
const services = [
  { id: uuid(), tenantId, name: 'תספורת גברים', durationMinutes: 30, price: 80, sortOrder: 1 },
  { id: uuid(), tenantId, name: 'תספורת + זקן', durationMinutes: 45, price: 120, sortOrder: 2 },
  { id: uuid(), tenantId, name: 'צבע', durationMinutes: 60, price: 200, sortOrder: 3 },
  { id: uuid(), tenantId, name: 'תספורת נשים', durationMinutes: 45, price: 150, sortOrder: 4 },
];

for (const service of services) {
  db.insert(schema.services).values(service).run();
}

// Working hours: Sunday-Thursday 09:00-18:00, Friday 09:00-13:00
const days = [
  { day: 0, start: '09:00', end: '18:00' }, // Sunday
  { day: 1, start: '09:00', end: '18:00' }, // Monday
  { day: 2, start: '09:00', end: '18:00' }, // Tuesday
  { day: 3, start: '09:00', end: '18:00' }, // Wednesday
  { day: 4, start: '09:00', end: '18:00' }, // Thursday
  { day: 5, start: '09:00', end: '13:00' }, // Friday
  // Saturday - closed (no entry)
];

for (const d of days) {
  db.insert(schema.workingHours).values({
    id: uuid(),
    tenantId,
    staffId: null,
    dayOfWeek: d.day,
    startTime: d.start,
    endTime: d.end,
  }).run();
}

console.log('Database seeded successfully!');
console.log('Tenant: מספרת שרה (demo-salon)');
console.log(`Services: ${services.map(s => s.name).join(', ')}`);
console.log('Working hours: Sun-Thu 09:00-18:00, Fri 09:00-13:00');
process.exit(0);
