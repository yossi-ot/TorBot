import Fastify from 'fastify';
import { config } from './config.js';
import { registerWebhookRoutes } from './whatsapp/webhook.js';
import { registerCalendarRoutes } from './calendar/ical.js';
import { startReminderJob } from './notifications/reminders.js';
import { registerTestRoutes } from './test-chat.js';

const app = Fastify({ logger: true });

// Routes
registerWebhookRoutes(app);
registerCalendarRoutes(app);
registerTestRoutes(app);

// Health check
app.get('/', async () => {
  return { status: 'ok', name: 'TorBot', version: '1.0.0' };
});

// Start server
async function start() {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`TorBot running on port ${config.port}`);

    // Start reminder cron job
    startReminderJob();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
