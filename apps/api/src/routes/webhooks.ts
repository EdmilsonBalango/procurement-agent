import { FastifyInstance } from 'fastify';

export async function webhookRoutes(app: FastifyInstance) {
  app.post(
    '/webhooks/receive',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = request.headers['x-webhook-secret'];
        const providedValue = Array.isArray(provided) ? provided[0] : provided;
        if (providedValue !== secret) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }

      app.log.info({ event: 'webhook.received', payload: request.body });

      return { ok: true };
    },
  );
}
