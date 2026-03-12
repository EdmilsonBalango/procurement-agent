import { FastifyInstance } from 'fastify';
import {
  listNotificationsByUser,
  onNotificationCreated,
  updateNotification,
} from '../lib/db.js';
import { getAllowedCorsOrigin } from '../lib/cors.js';
import { requireAuth } from '../lib/require-auth.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: requireAuth }, async (request) => {
    return listNotificationsByUser(request.user?.id ?? '');
  });

  app.get('/notifications/stream', { preHandler: requireAuth }, async (request, reply) => {
    const userId = request.user?.id ?? '';
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    };
    const origin = getAllowedCorsOrigin(request.headers.origin);
    if (origin) {
      responseHeaders['Access-Control-Allow-Origin'] = origin;
      responseHeaders['Access-Control-Allow-Credentials'] = 'true';
    }

    reply.raw.writeHead(200, responseHeaders);
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
