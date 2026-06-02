import { FastifyInstance } from 'fastify';
import { authMiddleware } from './middleware.js';
import { registerAuthRoutes } from './auth.js';
import { registerAppointmentRoutes } from './appointments.js';
import { registerServiceRoutes } from './services.js';
import { registerWorkingHoursRoutes } from './working-hours.js';
import { registerBlockedSlotRoutes } from './blocked-slots.js';
import { registerStatsRoutes } from './stats.js';
import { registerAdminRoutes } from './admin.js';
import { registerSettingsRoutes } from './settings.js';
import { registerWhatsAppConnectRoutes } from './whatsapp-connect.js';
import { registerLeadRoutes } from './leads.js';

export function registerApiRoutes(app: FastifyInstance) {
  // Auth routes (no JWT required)
  registerAuthRoutes(app);

  // Protect all other /api/ routes with JWT
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/auth/login' || request.url === '/api/auth/register') return;
    // Public lead capture from the landing page (POST only; GET/PATCH stay protected)
    if (request.method === 'POST' && request.url === '/api/leads') return;
    if (!request.url.startsWith('/api/')) return;
    await authMiddleware(request, reply);
  });

  registerAppointmentRoutes(app);
  registerServiceRoutes(app);
  registerWorkingHoursRoutes(app);
  registerBlockedSlotRoutes(app);
  registerStatsRoutes(app);
  registerAdminRoutes(app);
  registerSettingsRoutes(app);
  registerWhatsAppConnectRoutes(app);
  registerLeadRoutes(app);
}
