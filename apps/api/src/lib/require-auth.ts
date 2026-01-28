import { FastifyReply, FastifyRequest } from 'fastify';
import { getSessionUser } from './auth.js';

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) {
    return reply.status(401).send({ message: 'Not authenticated' });
  }
  request.user = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) {
    return reply.status(401).send({ message: 'Not authenticated' });
  }
  if (user.role !== 'ADMIN') {
    return reply.status(403).send({ message: 'Forbidden' });
  }
  request.user = user;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; email: string; role: string; name: string };
  }
}
