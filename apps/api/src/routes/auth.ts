import { FastifyInstance } from 'fastify';
import {
  deleteSessionById,
  findSessionById,
  findUserByEmail,
  findUserById,
} from '../lib/db.js';
import { createSession, SESSION_COOKIE, verifyPassword } from '../lib/auth.js';
import { shouldUseSecureCookie } from '../lib/cookies.js';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    async (request, reply) => {
      const body = (request.body ?? {}) as Partial<{ email: string; password: string }>;
      const { email, password } = body;
      if (!email || !password) {
        return reply.status(400).send({ message: 'Email and password are required' });
      }
      const user = await findUserByEmail(email);
      if (!user) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const session = await createSession({
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });
      const secureCookie = shouldUseSecureCookie(request);

      reply.setCookie(SESSION_COOKIE, session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie,
      });

      return reply.send({ success: true });
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await deleteSessionById(sessionId);
    }
    const secureCookie = shouldUseSecureCookie(request);
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie,
    });
    return reply.send({ success: true });
  });

  app.get('/auth/me', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    const session = await findSessionById(sessionId);

    if (!session) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    const user = await findUserById(session.userId);
    if (!user) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    return reply.send({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  });
}
