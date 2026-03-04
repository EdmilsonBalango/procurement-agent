import { FastifyInstance } from 'fastify';
import { requireAuth } from '../lib/require-auth.js';
import { EmailWebhookPayload, forwardEmailToWebhook } from '../lib/email-webhook.js';

export async function emailRoutes(app: FastifyInstance) {
  const bodySchema = {
    type: 'object',
    required: ['type', 'html', 'messageID'],
    properties: {
      type: {
        type: 'string',
        enum: ['PR_ASSIGNMENT_NOTIFICATION', 'QUOTES_FOR_REVIEW', 'REQUEST_QUOTES', 'REQUEST_INVOICE'],
      },
      html: { type: 'string', minLength: 1 },
      messageID: { type: 'string', minLength: 1 },
      to: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      suppliers: {
        type: 'array',
        items: { type: 'string', minLength: 1 },
      },
      subject: { type: 'string', minLength: 1 },
      quoteFiles: {
        type: 'array',
        items: {
          type: 'object',
          required: ['quoteId', 'fileId', 'filename', 'mimeType', 'contentBase64'],
          properties: {
            quoteId: { type: 'string', minLength: 1 },
            fileId: { type: 'string', minLength: 1 },
            filename: { type: 'string', minLength: 1 },
            mimeType: { type: 'string', minLength: 1 },
            contentBase64: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
      },
      poFiles: {
        type: 'array',
        items: {
          type: 'object',
          required: ['fileId', 'filename', 'mimeType', 'contentBase64'],
          properties: {
            fileId: { type: 'string', minLength: 1 },
            filename: { type: 'string', minLength: 1 },
            mimeType: { type: 'string', minLength: 1 },
            contentBase64: { type: 'string', minLength: 1 },
          },
          additionalProperties: false,
        },
      },
    },
    additionalProperties: false,
  } as const;

  app.post(
    '/emails/send',
    {
      preHandler: requireAuth,
      schema: { body: bodySchema },
    },
    async (request, reply) => {
      const body = request.body as EmailWebhookPayload;
      const forwarded = await forwardEmailToWebhook(body);

      if (!forwarded.ok) {
        return reply.status(502).send({
          message: 'Failed to forward send email request to webhook',
          webhookStatus: forwarded.status,
          webhookBody: forwarded.body,
        });
      }

      return reply.status(202).send({
        status: 'queued',
        route: 'send',
        webhookStatus: forwarded.status,
        webhookBody: forwarded.body,
      });
    },
  );

  app.post(
    '/emails/reply',
    {
      preHandler: requireAuth,
      schema: { body: bodySchema },
    },
    async (request, reply) => {
      const body = request.body as EmailWebhookPayload;
      const forwarded = await forwardEmailToWebhook(body);

      if (!forwarded.ok) {
        return reply.status(502).send({
          message: 'Failed to forward reply email request to webhook',
          webhookStatus: forwarded.status,
          webhookBody: forwarded.body,
        });
      }

      return reply.status(202).send({
        status: 'queued',
        route: 'reply',
        webhookStatus: forwarded.status,
        webhookBody: forwarded.body,
      });
    },
  );
}
