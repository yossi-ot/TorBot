import { FastifyInstance } from 'fastify';
import { authMiddleware } from './middleware.js';
import { registerAuthRoutes } from './auth.js';
import { registerAppointmentRoutes } from './appointments.js';
import { registerServiceRoutes } from './services.js';
import { registerWorkingHoursRoutes } from './working-hours.js';
import { registerBlockedSlotRoutes } from './blocked-slots.js';
import { registerStatsRoutes } from './stats.js';

export function registerApiRoutes(app: FastifyInstance) {
  // Auth routes (no JWT required)
  registerAuthRoutes(app);

  // Protect all other /api/ routes with JWT
  app.addHook('onRequest', async (request, reply) => {
    if (request.url === '/api/auth/login') return;
    if (!request.url.startsWith('/api/')) return;
    await authMiddleware(request, reply);
  });

  registerAppointmentRoutes(app);
  registerServiceRoutes(app);
  registerWorkingHoursRoutes(app);
  registerBlockedSlotRoutes(app);
  registerStatsRoutes(app);
}
