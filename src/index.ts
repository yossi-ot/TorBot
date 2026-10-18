import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { registerWebhookRoutes } from './whatsapp/webhook.js';
import { registerCalendarRoutes } from './calendar/ical.js';
import { startReminderJob } from './notifications/reminders.js';
import { startTokenCheckJob } from './notifications/token-check.js';
import { registerTestRoutes } from './test-chat.js';
import { registerApiRoutes } from './api/index.js';
import { registerLegalRoutes } from './legal.js';
import { registerLandingRoute } from './landing.js';
import { registerEntryLinkRoute } from './entry-link.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = Fastify({ logger: true });

// API routes (must be before static serving)
registerApiRoutes(app);

// WhatsApp + Calendar + Test + Legal routes
registerWebhookRoutes(app);
registerCalendarRoutes(app);
registerTestRoutes(app);
registerLegalRoutes(app);
registerLandingRoute(app);
registerEntryLinkRoute(app);

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

// Health check (root '/' now serves the branded landing page via registerLandingRoute)
app.get('/healthz', async () => {
  return { status: 'ok', name: 'TorBot', version: '1.0.0' };
});

// Server time check — used to verify timezone configuration after deploy.
app.get('/_time', async () => {
  const now = new Date();
  return {
    iso: now.toISOString(),
    local: now.toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' }),
    serverLocal: now.toString(),
    tz_env: process.env.TZ || '(not set)',
    offset_minutes: now.getTimezoneOffset(),
  };
});

// Start server
async function start() {
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`TorBot running on port ${config.port}`);

    // Start cron jobs
    startReminderJob();
    startTokenCheckJob();
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
