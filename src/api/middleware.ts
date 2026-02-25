import { createHmac } from 'crypto';
import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

const ALGORITHM = 'sha256';

interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString();
}

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + 30 * 86400 }));
  const signature = createHmac(ALGORITHM, config.dashboard.jwtSecret)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string): JwtPayload | null {
  try {
    const [header, body, signature] = token.split('.');
    const expected = createHmac(ALGORITHM, config.dashboard.jwtSecret)
      .update(`${header}.${body}`)
      .digest('base64url');
    if (signature !== expected) return null;

    const payload = JSON.parse(base64urlDecode(body)) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const auth = request.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }

  const payload = verifyJwt(auth.slice(7));
  if (!payload) {
    return reply.code(401).send({ error: 'Invalid or expired token' });
  }

  (request as any).tenantId = payload.tenantId;
  (request as any).userId = payload.userId;
  (request as any).role = payload.role;
}
