import { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { signJwt } from './middleware.js';

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (request, reply) => {
    const { password } = request.body as { password: string };

    if (password !== config.dashboard.password) {
      return reply.code(401).send({ error: 'סיסמה שגויה' });
    }

    const token = signJwt({ tenantId: 'demo-salon' });
    return { token };
  });
}
