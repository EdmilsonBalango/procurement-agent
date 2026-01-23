import { FastifyRequest } from 'fastify';
import bcrypt from 'bcryptjs';
import dayjs from 'dayjs';
import { prisma } from './prisma';

export const SESSION_COOKIE = 'procurement_session';

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function createSession({
  userId,
  ip,
  userAgent,
}: {
  userId: string;
  ip?: string;
  userAgent?: string;
}) {
  const ttlHours = Number(process.env.SESSION_TTL_HOURS ?? 168);
  const expiresAt = dayjs().add(ttlHours, 'hour').toDate();
  return prisma.session.create({
    data: {
      userId,
      ip,
      userAgent,
      expiresAt,
    },
  });
}

export async function getSessionUser(request: FastifyRequest) {
  const sessionId = request.cookies[SESSION_COOKIE];
  if (!sessionId) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (dayjs(session.expiresAt).isBefore(dayjs())) {
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.user;
}
