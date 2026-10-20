import { db, schema } from '../db/index.js';
import { eq, and } from 'drizzle-orm';
import { getSession, createSession, Session, updateSession } from './session.js';
import { sendWhatsAppMessage } from '../whatsapp/sender.js';
import { credentialsFromTenant, getSharedNumberOwner } from '../whatsapp/index.js';
import { handleGreeting } from './flows/greeting.js';
import { startBooking, startBookingWithEntities, handleServiceSelection, handleDateSelection, handleTimeSelection, handleConfirmation } from './flows/booking.js';
import { startCancel, handleCancelSelection } from './flows/cancel.js';
import { handleMyAppointments } from './flows/my-appointments.js';
import { normalizeMessage, quickIntent } from './ai-fallback.js';
import { runAgent } from './agent.js';
import { normalizePhone } from '../utils/phone.js';
import { dayjs } from '../utils/date.js';
import { config } from '../config.js';
import { withCostTracking, bucketCostAgorot } from './cost-tracker.js';
import { resolveSharedTenant } from './shared-routing.js';

interface IncomingMessage {
  phoneNumberId: string;
  from: string;
  text: string;
  contactName: string;
  /** WhatsApp message id — needed for typing indicator + read receipts */
  messageId?: string;
}

async function findTenant(phoneNumberId: string) {
  const [tenant] = await db.select().from(schema.tenants)
    .where(eq(schema.tenants.whatsappPhoneNumberId, phoneNumberId));
  return tenant;
}

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

export async function handleIncomingMessage(msg: IncomingMessage): Promise<void> {
  const sharedOwner = await getSharedNumberOwner();
  const isSharedNumberMessage = !!sharedOwner && msg.phoneNumberId === sharedOwner.whatsappPhoneNumberId;

  let tenant: typeof schema.tenants.$inferSelect | undefined;

  if (isSharedNumberMessage) {
    // The owner's own number is shared platform-wide - resolve by entry
    // code / customer history instead of a straight phone_number_id match,
    // falling back to the owner itself for anyone with no code or history.
    tenant = await resolveSharedTenant(normalizePhone(msg.from), msg.text.trim(), sharedOwner);
  } else {
    tenant =
      (await findTenant(msg.phoneNumberId)) ??
      (await autoAssignDialog360Tenant(msg.phoneNumberId));
  }

  if (!tenant) {
    console.warn(`No tenant found for phone_number_id: ${msg.phoneNumberId}, from: ${msg.from}`);
    return;
  }

  const phone = normalizePhone(msg.from);
  let session = await getSession(tenant.id, phone);
  if (!session) {
    session = await createSession(tenant.id, phone, msg.contactName);
  }

  const { provider, credentials } = await credentialsFromTenant(tenant);

  // Fire a context-aware placeholder immediately so the customer never sees
  // silence — 360dialog doesn't relay WhatsApp's native typing indicator.
  // The text describes what the bot is about to do (no AI cost).
  const placeholderText = pickPlaceholder(session, msg.text.trim());
  const placeholderPromise: Promise<unknown> = placeholderText
    ? sendWhatsAppMessage({ provider, credentials, to: msg.from, text: placeholderText })
        .catch(err => { console.warn('Placeholder send failed:', err); })
    : Promise.resolve();

  let response: string;
  let bucketSnapshot = { inputTokens: 0, outputTokens: 0, calls: 0 };
  try {
    const tracked = await withCostTracking(() => routeMessage(session, tenant, msg.text.trim()));
    response = tracked.result;
    bucketSnapshot = tracked.bucket;
  } catch (err) {
    console.error('routeMessage error:', err);
    response = 'משהו השתבש. תרצה לנסות שוב?';
  }
  // Make sure the placeholder lands before the real response.
  await placeholderPromise;

  const cost = bucketCostAgorot(bucketSnapshot);
  console.log(`[router] ${session.customerPhone} • ${bucketSnapshot.calls} AI calls • ${bucketSnapshot.inputTokens}in/${bucketSnapshot.outputTokens}out → ${cost}אג'`);

  if (process.env.SHOW_AI_COSTS === '1') {
    if (bucketSnapshot.calls === 0) {
      response += `\n— — —\n💰 0 אגורות (ללא AI)`;
    } else {
      response += `\n— — —\n💰 ${cost} אגורות (${bucketSnapshot.calls} AI calls · ${bucketSnapshot.inputTokens} in / ${bucketSnapshot.outputTokens} out)`;
    }
  }

  try {
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

export async function handleTestMessage(tenantId: string, phone: string, text: string, contactName: string): Promise<string> {
  let session = await getSession(tenantId, phone);
  if (!session) session = await createSession(tenantId, phone, contactName);
  const [tenant] = await db.select().from(schema.tenants).where(eq(schema.tenants.id, tenantId));
  return routeMessage(session, tenant!, text.trim());
}

async function routeMessage(session: Session, tenant: typeof schema.tenants.$inferSelect, text: string): Promise<string> {
  // Numbered choices always go through the fast path (free, instant).
  if (session.state === 'IDLE') {
    const numeric = detectNumericChoice(text);
    if (numeric === 'book') return startBooking(session);
    if (numeric === 'cancel') return startCancel(session);
    if (numeric === 'list') return handleMyAppointments(session);
  }

  // Conversational agent is opt-in via env (USE_AI_AGENT=1). Default is the
  // cheaper state-machine + normalizer hybrid.
  if (process.env.USE_AI_AGENT === '1' && config.anthropic.apiKey) {
    try {
      const result = await runAgent({
        ctx: {
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantTimezone: tenant.timezone,
          cancellationPolicy: tenant.cancellationPolicy,
          address: tenant.address,
          customerPhone: session.customerPhone,
          customerName: session.customerName,
        },
        state: {
          selectedServiceName: session.selectedServiceName,
          selectedDate: session.selectedDate,
          selectedTime: session.selectedTime,
          lastBotMessage: session.lastBotMessage,
          recentUserMessages: session.recentUserMessages,
        },
        userMessage: text,
      });

      const nextRecent = [...(session.recentUserMessages || []), text].slice(-4);

      await updateSession(session, {
        state: 'IDLE',
        selectedServiceName: result.stateUpdates.selectedServiceName,
        selectedDate: result.stateUpdates.selectedDate,
        selectedTime: result.stateUpdates.selectedTime,
        lastBotMessage: result.stateUpdates.lastBotMessage,
        recentUserMessages: nextRecent,
      });

      return result.reply;
    } catch (err: any) {
      if (err.message === 'AGENT_NO_API_KEY') {
        // expected — fall through to state machine
      } else {
        console.error('Agent error, falling back to state machine:', err);
      }
    }
  }

  // Fallback path: legacy deterministic state machine
  return routeWithStateMachine(session, text);
}

async function routeWithStateMachine(session: Session, text: string): Promise<string> {
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
      return `אפשר לכתוב: קביעת תור, ביטול, או "התורים שלי".`;
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

/** Pick a short placeholder bubble based on what the bot is about to do.
 *  Returns null for cases where a placeholder would be silly (greetings). */
function pickPlaceholder(session: Session, text: string): string | null {
  switch (session.state) {
    case 'SELECT_SERVICE':  return 'רגע, בודק שירותים...';
    case 'SELECT_DATE':     return 'רגע, בודק תאריכים פנויים...';
    case 'SELECT_TIME':     return 'רגע, בודק שעות פנויות...';
    case 'CONFIRM_BOOKING': return 'רגע, מאשר את התור...';
    case 'CANCEL_SELECT':   return 'רגע, מבטל את התור...';
  }
  const intent = quickIntent(text);
  if (intent === 'book')     return 'רגע, בודק זמינות...';
  if (intent === 'cancel')   return 'רגע, מאתר את התורים שלך...';
  if (intent === 'list')     return 'רגע, מביא את התורים שלך...';
  if (intent === 'greeting') return null;
  return 'רגע, בודק...';
}
