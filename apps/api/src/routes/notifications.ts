import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/require-auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: requireAuth }, async (request) => {
    return prisma.notification.findMany({
      where: { userId: request.user?.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.patch('/notifications/:id/read', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  });
}
