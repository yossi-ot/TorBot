import { pgTable, text, integer, real, boolean } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  whatsappPhoneNumberId: text('whatsapp_phone_number_id').notNull(),
  whatsappAccessToken: text('whatsapp_access_token').notNull(),
  wabaId: text('waba_id'),
  timezone: text('timezone').notNull().default('Asia/Jerusalem'),
  address: text('address'),
  aiSystemPrompt: text('ai_system_prompt'),
  cancellationPolicy: text('cancellation_policy'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  role: text('role').notNull().default('owner'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: real('price').notNull(),
  currency: text('currency').notNull().default('ILS'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const staffMembers = pgTable('staff_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const staffServices = pgTable('staff_services', {
  staffId: text('staff_id').notNull().references(() => staffMembers.id),
  serviceId: text('service_id').notNull().references(() => services.id),
});

export const workingHours = pgTable('working_hours', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  dayOfWeek: integer('day_of_week').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isActive: boolean('is_active').notNull().default(true),
});

export const blockedSlots = pgTable('blocked_slots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  startDatetime: text('start_datetime').notNull(),
  endDatetime: text('end_datetime').notNull(),
  reason: text('reason'),
});

export const customers = pgTable('customers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  phone: text('phone').notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  customerId: text('customer_id').notNull().references(() => customers.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').notNull().default('confirmed'),
  source: text('source').notNull().default('whatsapp_bot'),
  reminderSent: boolean('reminder_sent').notNull().default(false),
  cancelledAt: text('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
