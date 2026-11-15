import bcrypt from 'bcrypt';
import { v4 as uuid } from 'uuid';
import { db, schema } from './index.js';
import { generateEntryCode } from '../utils/entry-code.js';

export interface ProvisionTenantInput {
  businessName: string;
  phone: string;
  email: string;
  password: string;
}

export interface ProvisionTenantResult {
  tenantId: string;
  userId: string;
  entryCode: string;
}

/**
 * Creates a tenant + its owner user, on the shared platform number by
 * default. Shared by self-service registration and admin-created
 * businesses so both paths stay in sync.
 */
export async function createTenantWithOwner(input: ProvisionTenantInput): Promise<ProvisionTenantResult> {
  const tenantId = uuid();
  const userId = uuid();
  const passwordHash = await bcrypt.hash(input.password, 10);
  const entryCode = await generateEntryCode(input.businessName);

  await db.insert(schema.tenants).values({
    id: tenantId,
    name: input.businessName,
    phone: input.phone,
    whatsappPhoneNumberId: '',
    whatsappAccessToken: '',
    entryCode,
    timezone: 'Asia/Jerusalem',
    cancellationPolicy: 'ביטול עד 2 שעות לפני התור',
    icalToken: uuid(),
  });

  await db.insert(schema.users).values({
    id: userId,
    email: input.email.toLowerCase(),
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

  return { tenantId, userId, entryCode };
}
