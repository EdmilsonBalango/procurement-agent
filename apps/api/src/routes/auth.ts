import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import {
  createMfaChallenge,
  createOutboundEmailLog,
  deleteSessionById,
  findLatestValidMfaChallenge,
  findSessionById,
  findUserByEmail,
  findUserById,
  getLatestMfaLog,
  updateMfaChallenge,
  updateUser,
} from '../lib/db.js';
import { createSession, SESSION_COOKIE, verifyPassword } from '../lib/auth.js';
import { isMfaRequired } from '../lib/rules.js';

const MFA_EXP_MINUTES = Number(process.env.MFA_TTL_MINUTES ?? 10);

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

      // const requiresMfa = isMfaRequired(user.lastMfaAt);

      // if (requiresMfa) {
      //   const code = String(Math.floor(100000 + Math.random() * 900000));
      //   const codeHash = await bcrypt.hash(code, 10);
      //   const expiresAt = dayjs().add(MFA_EXP_MINUTES, 'minute').toDate();
      //   createMfaChallenge({ userId: user.id, codeHash, expiresAt });

      //   createOutboundEmailLog({
      //     type: 'MFA_CODE',
      //     to: JSON.stringify([user.email]),
      //     cc: JSON.stringify([]),
      //     subject: 'Your MFA code',
      //     body: `Your one-time code is ${code}.`,
      //     attachmentFileIds: JSON.stringify([]),
      //     createdBy: user.id,
      //   });

      //   if (process.env.NODE_ENV === 'development') {
      //     console.log(`[MFA] code for ${user.email}: ${code}`);
      //   }

      //   return reply.send({ requiresMfa: true });
      // }

      const session = await createSession({
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.setCookie(SESSION_COOKIE, session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });

      return reply.send({ requiresMfa: false });
    },
  );

  app.post(
    '/auth/mfa/verify',
    async (request, reply) => {
      const { email, code } = request.body as { email: string; code: string };
      const user = await findUserByEmail(email);
      if (!user) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const challenge = await findLatestValidMfaChallenge(user.id);

      if (!challenge) {
        return reply.status(400).send({ message: 'Challenge expired' });
      }

      if (challenge.attempts >= 5) {
        return reply.status(429).send({ message: 'Too many attempts' });
      }

      const matches = await bcrypt.compare(code, challenge.codeHash);
      await updateMfaChallenge(challenge.id, {
        attempts: challenge.attempts + 1,
        consumedAt: matches ? new Date() : null,
      });

      if (!matches) {
        return reply.status(401).send({ message: 'Invalid code' });
      }

      await updateUser(user.id, { lastMfaAt: new Date() });

      const session = await createSession({
        userId: user.id,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      });

      reply.setCookie(SESSION_COOKIE, session.id, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
      });

      return reply.send({ success: true });
    },
  );

  app.post('/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await deleteSessionById(sessionId);
    }
    reply.clearCookie(SESSION_COOKIE, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
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
      lastMfaAt: user.lastMfaAt,
    });
  });

  app.get('/auth/mfa/dev-code', async (request, reply) => {
    if (process.env.NODE_ENV !== 'development') {
      return reply.status(404).send({ message: 'Not found' });
    }
    const { email } = request.query as { email?: string };
    if (!email) {
      return reply.status(400).send({ message: 'Email required' });
    }

    const log = await getLatestMfaLog();

    if (!log) {
      return reply.status(404).send({ message: 'No code found' });
    }

    const codeMatch = log.body.match(/(\d{6})/);
    return reply.send({ code: codeMatch?.[1] ?? null });
  });
}
