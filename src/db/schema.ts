import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  whatsappPhoneNumberId: text('whatsapp_phone_number_id').notNull(),
  whatsappAccessToken: text('whatsapp_access_token').notNull(),
  timezone: text('timezone').notNull().default('Asia/Jerusalem'),
  address: text('address'),
  aiSystemPrompt: text('ai_system_prompt'),
  cancellationPolicy: text('cancellation_policy'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const services = sqliteTable('services', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: real('price').notNull(),
  currency: text('currency').notNull().default('ILS'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const staffMembers = sqliteTable('staff_members', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  name: text('name').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const staffServices = sqliteTable('staff_services', {
  staffId: text('staff_id').notNull().references(() => staffMembers.id),
  serviceId: text('service_id').notNull().references(() => services.id),
});

export const workingHours = sqliteTable('working_hours', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday ... 6=Saturday
  startTime: text('start_time').notNull(), // "09:00"
  endTime: text('end_time').notNull(), // "18:00"
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
});

export const blockedSlots = sqliteTable('blocked_slots', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  startDatetime: text('start_datetime').notNull(),
  endDatetime: text('end_datetime').notNull(),
  reason: text('reason'),
});

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  phone: text('phone').notNull(),
  name: text('name'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const appointments = sqliteTable('appointments', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  customerId: text('customer_id').notNull().references(() => customers.id),
  serviceId: text('service_id').notNull().references(() => services.id),
  staffId: text('staff_id').references(() => staffMembers.id),
  startTime: text('start_time').notNull(), // ISO datetime
  endTime: text('end_time').notNull(),     // ISO datetime
  status: text('status').notNull().default('confirmed'), // confirmed | cancelled | completed | no_show
  source: text('source').notNull().default('whatsapp_bot'),
  reminderSent: integer('reminder_sent', { mode: 'boolean' }).notNull().default(false),
  cancelledAt: text('cancelled_at'),
  cancellationReason: text('cancellation_reason'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});
