import { pgTable, text, integer, real, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  whatsappProvider: text('whatsapp_provider').notNull().default('meta'),
  whatsappPhoneNumberId: text('whatsapp_phone_number_id').notNull(),
  whatsappAccessToken: text('whatsapp_access_token').notNull(),
  wabaId: text('waba_id'),
  tokenExpiresAt: text('token_expires_at'),
  dialog360ApiKey: text('dialog360_api_key'),
  timezone: text('timezone').notNull().default('Asia/Jerusalem'),
  address: text('address'),
  aiSystemPrompt: text('ai_system_prompt'),
  cancellationPolicy: text('cancellation_policy'),
  icalToken: text('ical_token'),
  // Tenants on the shared platform number (no WABA of their own) are matched
  // to incoming customers via this code instead of whatsappPhoneNumberId.
  entryCode: text('entry_code').unique(),
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

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),                // tenantId:phone
  tenantId: text('tenant_id').notNull(),
  customerPhone: text('customer_phone').notNull(),
  customerName: text('customer_name').notNull(),
  state: text('state').notNull().default('IDLE'),
  data: text('data').notNull().default('{}'), // JSON - selectedServiceId, date, time etc.
  lastActivity: text('last_activity').notNull(),
});

/**
 * Short-lived holds on a (service, datetime) pair while a customer is
 * mid-conversation. Prevents two customers from both being told a slot
 * is available and racing each other to confirm.
 */
export const slotLocks = pgTable('slot_locks', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  serviceId: text('service_id').notNull(),
  customerPhone: text('customer_phone').notNull(),
  startTime: text('start_time').notNull(),     // YYYY-MM-DDTHH:mm:ss
  endTime: text('end_time').notNull(),
  expiresAt: text('expires_at').notNull(),     // ISO timestamp, +5 min
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

/** Inbound signups from the public landing page (not tied to a tenant). */
export const leads = pgTable('leads', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  businessName: text('business_name').notNull(),
  phone: text('phone').notNull(),
  status: text('status').notNull().default('new'), // new | contacted | converted | rejected
  source: text('source').notNull().default('landing'),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

/**
 * Binds a customer's phone number to a tenant on the shared platform number.
 * Many-to-many: a customer can message several businesses through the same
 * shared number, each via its own entry-code link.
 */
export const customerTenantLinks = pgTable('customer_tenant_links', {
  customerPhone: text('customer_phone').notNull(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  lastActiveAt: text('last_active_at').notNull().$defaultFn(() => new Date().toISOString()),
}, (table) => ({
  pk: primaryKey({ columns: [table.customerPhone, table.tenantId] }),
}));

/**
 * Short-lived "which business did you mean?" prompt state for a customer
 * linked to more than one shared-number tenant. Cleared on reply or expiry.
 */
export const pendingTenantSelections = pgTable('pending_tenant_selections', {
  customerPhone: text('customer_phone').primaryKey(),
  tenantIds: text('tenant_ids').notNull(), // JSON array, in the order presented
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
