import cron from 'node-cron';
import { db, schema } from '../db/index.js';
import { eq, and, gte, lte } from 'drizzle-orm';
import { sendWhatsAppMessage } from '../whatsapp/sender.js';
import { credentialsFromTenant } from '../whatsapp/index.js';
import { dayjs, formatDateHebrew } from '../utils/date.js';

/**
 * Start the reminder cron job.
 * Runs every 15 minutes, checks for appointments in the next hour
 * that haven't had a reminder sent yet.
 */
export function startReminderJob() {
  cron.schedule('*/15 * * * *', () => {
    sendReminders().catch(err => console.error('Reminder job error:', err));
  });

  console.log('Reminder job started (every 15 minutes)');
}

async function sendReminders() {
  const now = dayjs();
  const oneHourFromNow = now.add(1, 'hour');

  // Find appointments in the next hour that haven't been reminded
  const upcoming = await db.select({
    appointmentId: schema.appointments.id,
    startTime: schema.appointments.startTime,
    serviceName: schema.services.name,
    customerPhone: schema.customers.phone,
    tenantId: schema.appointments.tenantId,
    tenantName: schema.tenants.name,
    whatsappProvider: schema.tenants.whatsappProvider,
    whatsappPhoneNumberId: schema.tenants.whatsappPhoneNumberId,
    whatsappAccessToken: schema.tenants.whatsappAccessToken,
    dialog360ApiKey: schema.tenants.dialog360ApiKey,
  })
    .from(schema.appointments)
    .innerJoin(schema.services, eq(schema.appointments.serviceId, schema.services.id))
    .innerJoin(schema.customers, eq(schema.appointments.customerId, schema.customers.id))
    .innerJoin(schema.tenants, eq(schema.appointments.tenantId, schema.tenants.id))
    .where(and(
      eq(schema.appointments.status, 'confirmed'),
      eq(schema.appointments.reminderSent, false),
      gte(schema.appointments.startTime, now.format('YYYY-MM-DDTHH:mm:ss')),
      lte(schema.appointments.startTime, oneHourFromNow.format('YYYY-MM-DDTHH:mm:ss')),
    ));

  for (const appt of upcoming) {
    const startDate = dayjs(appt.startTime);
    const message = `⏰ תזכורת מ-*${appt.tenantName}*:\n\nיש לך תור ל-${appt.serviceName} ${formatDateHebrew(startDate)} בשעה ${startDate.format('HH:mm')}.\n\nנתראה! 😊`;

    try {
      const { provider, credentials } = credentialsFromTenant(appt);
      await sendWhatsAppMessage({
        provider,
        credentials,
        to: appt.customerPhone,
        text: message,
      });

      // Mark as reminded
      await db.update(schema.appointments)
        .set({ reminderSent: true })
        .where(eq(schema.appointments.id, appt.appointmentId));

      console.log(`Reminder sent to ${appt.customerPhone} for appointment ${appt.appointmentId}`);
    } catch (err) {
      console.error(`Failed to send reminder to ${appt.customerPhone}:`, err);
    }
  }
}
