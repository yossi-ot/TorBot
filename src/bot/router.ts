import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getSession, createSession, Session } from './session.js';
import { sendWhatsAppMessage } from '../whatsapp/sender.js';
import { credentialsFromTenant } from '../whatsapp/index.js';
import { handleGreeting } from './flows/greeting.js';
import { startBooking, startBookingWithEntities, handleServiceSelection, handleDateSelection, handleTimeSelection, handleConfirmation } from './flows/booking.js';
import { startCancel, handleCancelSelection } from './flows/cancel.js';
import { handleMyAppointments } from './flows/my-appointments.js';
import { normalizeMessage } from './ai-fallback.js';
import { normalizePhone } from '../utils/phone.js';
import { dayjs } from '../utils/date.js';

interface IncomingMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  contactName: string;
}

/** Find tenant by WhatsApp phone number ID */
async function findTenant(phoneNumberId: string) {
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.whatsappPhoneNumberId, phoneNumberId));
  return tenant;
}

/**
 * Auto-assign phone_number_id to a freshly-onboarded 360dialog tenant that
 * doesn't have one yet. Only safe when exactly one such tenant exists.
 */
async function autoAssignDialog360Tenant(phoneNumberId: string) {
  const pendings = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.whatsappProvider, 'dialog360'));
  const candidates = pendings.filter(t => !t.whatsappPhoneNumberId || t.whatsappPhoneNumberId.length === 0);
  if (candidates.length !== 1) return undefined;
  const [t] = candidates;
  await db.update(schema.tenants)
    .set({ whatsappPhoneNumberId: phoneNumberId })
    .where(eq(schema.tenants.id, t.id));
  console.log(`Auto-assigned phone_number_id=${phoneNumberId} to tenant ${t.id}`);
  return { ...t, whatsappPhoneNumberId: phoneNumberId };
}

/** Main message handler */
export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const tenant =
    (await findTenant(msg.phoneNumberId)) ??
    (await autoAssignDialog360Tenant(msg.phoneNumberId));
  if (!tenant) {
    console.warn(`No tenant found for phone_number_id: ${msg.phoneNumberId}`);
    return;
  }

  const phone = normalizePhone(msg.from);
  let session = await getSession(tenant.id, phone);
  if (!session) {
    session = await createSession(tenant.id, phone, msg.contactName);
  }

  const response = await routeMessage(session, msg.text.trim());

  try {
    const { provider, credentials } = credentialsFromTenant(tenant);
    await sendWhatsAppMessage({
      provider,
      credentials,
      to: msg.from,
      text: response,
    });
  } catch (err) {
    console.error(`Failed to send reply to ${msg.from}:`, err);
  }
}

/** Direct message handler for testing - returns the response text */
export async function handleTestMessage(tenantId: string, phone: string, text: string, contactName: string): Promise<string> {
  let session = await getSession(tenantId, phone);
  if (!session) {
    session = await createSession(tenantId, phone, contactName);
  }
  return routeMessage(session, text.trim());
}

async function routeMessage(session: Session, text: string): Promise<string> {
  // In an active flow: dedicated handlers parse the input deterministically (no AI needed).
  switch (session.state) {
    case 'SELECT_SERVICE':
      return handleServiceSelection(session, text);
    case 'SELECT_DATE':
      return handleDateSelection(session, text);
    case 'SELECT_TIME':
      return handleTimeSelection(session, text);
    case 'CONFIRM_BOOKING':
      return handleConfirmation(session, text);
    case 'CANCEL_SELECT':
      return handleCancelSelection(session, text);
  }

  // IDLE state — fast path for keypad-style replies (no AI cost / latency).
  const numeric = detectNumericChoice(text);
  if (numeric === 'book') return startBooking(session);
  if (numeric === 'cancel') return startCancel(session);
  if (numeric === 'list') return handleMyAppointments(session);

  // Everything else: use the AI normalizer to extract intent + entities.
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId));
  const services = await db.select().from(schema.services)
    .where(and(
      eq(schema.services.tenantId, session.tenantId),
      eq(schema.services.isActive, true),
    ));

  const tz = tenant?.timezone || 'Asia/Jerusalem';
  const n = await normalizeMessage(text, {
    businessName: tenant?.name || '',
    serviceNames: services.map(s => s.name),
    todayIso: dayjs().tz(tz).format('YYYY-MM-DD'),
  });

  switch (n.intent) {
    case 'greeting':
      return handleGreeting(session);
    case 'book':
      return startBookingWithEntities(session, n);
    case 'cancel':
      return startCancel(session);
    case 'list':
      return handleMyAppointments(session);
    default:
      return `לא הבנתי 😅
אפשר לנסות:
1️⃣ קביעת תור
2️⃣ ביטול תור
3️⃣ התורים שלי`;
  }
}

type NumericChoice = 'book' | 'cancel' | 'list' | null;

function detectNumericChoice(text: string): NumericChoice {
  const t = text.trim();
  if (/^1️⃣?$/.test(t)) return 'book';
  if (/^2️⃣?$/.test(t)) return 'cancel';
  if (/^3️⃣?$/.test(t)) return 'list';
  return null;
}
