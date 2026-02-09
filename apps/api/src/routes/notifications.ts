import { FastifyInstance } from 'fastify';
import {
  listNotificationsByUser,
  onNotificationCreated,
  updateNotification,
} from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: requireAuth }, async (request) => {
    return listNotificationsByUser(request.user?.id ?? '');
  });

  app.get('/notifications/stream', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user?.id ?? '';
    const origin = request.headers.origin ?? 'http://localhost:3000';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
    });
    reply.hijack();
    reply.raw.flushHeaders?.();

    const existing = (await listNotificationsByUser(userId)).map((note) => note.id);
    reply.raw.write(`event: init\ndata: ${JSON.stringify(existing)}\n\n`);

    const keepAlive = setInterval(() => {
      reply.raw.write(': keep-alive\n\n');
    }, 25000);

    const unsubscribe = onNotificationCreated((note) => {
      if (note.userId !== userId) {
        return;
      }
      reply.raw.write(`event: notification\ndata: ${JSON.stringify(note)}\n\n`);
    });

    request.raw.on('close', () => {
      clearInterval(keepAlive);
      unsubscribe();
    });
  });

  app.patch('/notifications/:id/read', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const updated = await updateNotification(id, { isRead: true });
    if (!updated) {
      return reply.status(404).send({ message: 'Not found' });
    }
    return updated;
  });
}
