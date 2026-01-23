import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { loginSchema, mfaVerifySchema } from '@procurement/shared';
import { prisma } from '../lib/prisma';
import { createSession, SESSION_COOKIE, verifyPassword } from '../lib/auth';
import { isMfaRequired } from '../lib/rules';

const MFA_EXP_MINUTES = Number(process.env.MFA_TTL_MINUTES ?? 10);

export async function authRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.post(
    '/auth/login',
    {
      schema: {
        body: loginSchema,
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const requiresMfa = isMfaRequired(user.lastMfaAt);

      if (requiresMfa) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = dayjs().add(MFA_EXP_MINUTES, 'minute').toDate();
        await prisma.mfaChallenge.create({
          data: {
            userId: user.id,
            codeHash,
            expiresAt,
          },
        });

        await prisma.outboundEmailLog.create({
          data: {
            type: 'MFA_CODE',
            to: [user.email],
            cc: [],
            subject: 'Your MFA code',
            body: `Your one-time code is ${code}.`,
            attachmentFileIds: [],
            createdBy: user.id,
          },
        });

        if (process.env.NODE_ENV === 'development') {
          console.log(`[MFA] code for ${user.email}: ${code}`);
        }

        return reply.send({ requiresMfa: true });
      }

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

  server.post(
    '/auth/mfa/verify',
    {
      schema: {
        body: mfaVerifySchema,
      },
    },
    async (request, reply) => {
      const { email, code } = request.body;
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const challenge = await prisma.mfaChallenge.findFirst({
        where: {
          userId: user.id,
          consumedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!challenge) {
        return reply.status(400).send({ message: 'Challenge expired' });
      }

      if (challenge.attempts >= 5) {
        return reply.status(429).send({ message: 'Too many attempts' });
      }

      const matches = await bcrypt.compare(code, challenge.codeHash);
      await prisma.mfaChallenge.update({
        where: { id: challenge.id },
        data: {
          attempts: { increment: 1 },
          consumedAt: matches ? new Date() : null,
        },
      });

      if (!matches) {
        return reply.status(401).send({ message: 'Invalid code' });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { lastMfaAt: new Date() },
      });

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

  server.post('/auth/logout', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (sessionId) {
      await prisma.session.deleteMany({ where: { id: sessionId } });
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.send({ success: true });
  });

  server.get('/auth/me', async (request, reply) => {
    const sessionId = request.cookies[SESSION_COOKIE];
    if (!sessionId) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      return reply.status(401).send({ message: 'Not authenticated' });
    }

    return reply.send({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
      lastMfaAt: session.user.lastMfaAt,
    });
  });

  server.get('/auth/mfa/dev-code', async (request, reply) => {
    if (process.env.NODE_ENV !== 'development') {
      return reply.status(404).send({ message: 'Not found' });
    }
    const { email } = request.query as { email?: string };
    if (!email) {
      return reply.status(400).send({ message: 'Email required' });
    }

    const log = await prisma.outboundEmailLog.findFirst({
      where: { type: 'MFA_CODE', to: { has: email } },
      orderBy: { createdAt: 'desc' },
    });

    if (!log) {
      return reply.status(404).send({ message: 'No code found' });
    }

    const codeMatch = log.body.match(/(\d{6})/);
    return reply.send({ code: codeMatch?.[1] ?? null });
  });
}
