import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { registerWebhookRoutes } from './whatsapp/webhook.js';
import { registerCalendarRoutes } from './calendar/ical.js';
import { startReminderJob } from './notifications/reminders.js';
import { registerTestRoutes } from './test-chat.js';
import { registerApiRoutes } from './api/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ logger: true });

// API routes (must be before static serving)
registerApiRoutes(app);

// WhatsApp + Calendar + Test routes
registerWebhookRoutes(app);
registerCalendarRoutes(app);
registerTestRoutes(app);

// Serve dashboard static files with SPA fallback
app.register(fastifyStatic, {
  root: join(__dirname, '..', 'dashboard', 'dist'),
  prefix: '/dashboard/',
  wildcard: false,
});

// SPA fallback for dashboard routes (client-side routing)
app.get('/dashboard/*', async (request, reply) => {
  return reply.sendFile('index.html', join(__dirname, '..', 'dashboard', 'dist'));
});

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
