import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { getSession, createSession, Session } from './session.js';
import { sendWhatsAppMessage } from '../whatsapp/sender.js';
import { credentialsFromTenant } from '../whatsapp/index.js';
import { handleGreeting } from './flows/greeting.js';
import { startBooking, handleServiceSelection, handleDateSelection, handleTimeSelection, handleConfirmation } from './flows/booking.js';
import { startCancel, handleCancelSelection } from './flows/cancel.js';
import { handleMyAppointments } from './flows/my-appointments.js';
import { detectIntent } from './ai-fallback.js';
import { normalizePhone } from '../utils/phone.js';

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
  // If we're in a flow, route to the appropriate handler
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

  // IDLE state - detect intent via pattern matching
  const intent = detectPatternIntent(text);

  switch (intent) {
    case 'greeting':
      return handleGreeting(session);
    case 'book':
      return startBooking(session);
    case 'cancel':
      return startCancel(session);
    case 'list':
      return handleMyAppointments(session);
  }

  // Pattern matching failed - try AI
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId));

  const services = await db.select().from(schema.services)
    .where(eq(schema.services.tenantId, session.tenantId));

  const businessContext = `עסק: ${tenant?.name}. שירותים: ${services.map(s => s.name).join(', ')}`;

  const aiResult = await detectIntent(text, businessContext);

  switch (aiResult.intent) {
    case 'greeting':
      return handleGreeting(session);
    case 'book':
      return startBooking(session);
    case 'cancel':
      return startCancel(session);
    case 'list':
      return handleMyAppointments(session);
  }

  // Completely unknown
  return `לא הבנתי 😅
אפשר לנסות:
1️⃣ קביעת תור
2️⃣ ביטול תור
3️⃣ התורים שלי`;
}

type Intent = 'greeting' | 'book' | 'cancel' | 'list' | null;

function detectPatternIntent(text: string): Intent {
  const lower = text.toLowerCase();

  // Greeting
  if (/^(היי|הי|שלום|בוקר טוב|ערב טוב|hello|hi|hey|מה נשמע|מה קורה)$/i.test(text.trim())) {
    return 'greeting';
  }

  // Booking
  if (/תור|לקבוע|להזמין|booking|book|1️⃣|^1$/.test(text)) {
    return 'book';
  }

  // Cancel
  if (/ביטול|לבטל|לשנות|cancel|2️⃣|^2$/.test(text)) {
    return 'cancel';
  }

  // List appointments
  if (/תורים שלי|התורים|הזמנות|appointments|3️⃣|^3$/.test(text)) {
    return 'list';
  }

  return null;
}
