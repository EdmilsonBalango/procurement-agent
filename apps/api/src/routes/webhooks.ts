import { FastifyInstance } from 'fastify';

const RFQ_SUBJECT_REGEX = /KARINGANI\s*-\s*RFQ\s*for\s*case\s+([A-Za-z0-9-]+)/i;
const INVOICE_SUBJECT_REGEX =
  /KARINGANI\s*-\s*(?:INVOICE|Invoice\s*request)\s*for\s*case\s+([A-Za-z0-9-]+)/i;
const RECEIPT_SUBJECT_REGEX =
  /KARINGANI\s*-\s*(?:POP|RECEIPT|Proof\s*of\s*Payment)[^]*?\bcase\s+([A-Za-z0-9-]+)/i;

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

      const body = request.body as Record<string, unknown>;
      const subject = typeof body?.subject === 'string' ? body.subject.trim() : '';
      const isSupplierEmailPayload =
        subject.length > 0 &&
        Array.isArray(body?.files) &&
        body?.supplier &&
        typeof body.supplier === 'object';
      const isSupplierQuotePayload =
        isSupplierEmailPayload && RFQ_SUBJECT_REGEX.test(subject);
      const isSupplierInvoicePayload =
        isSupplierEmailPayload && INVOICE_SUBJECT_REGEX.test(subject);
      const isSupplierReceiptPayload =
        isSupplierEmailPayload && RECEIPT_SUBJECT_REGEX.test(subject);

      if (isSupplierReceiptPayload) {
        const forwarded = await app.inject({
          method: 'POST',
          url: '/cases/supplier-receipt',
          headers: {
            ...(secret ? { 'x-webhook-secret': secret } : {}),
          },
          payload: body,
        });

        if (forwarded.statusCode >= 400) {
          return reply.status(forwarded.statusCode).send(forwarded.json());
        }
        return reply.status(forwarded.statusCode).send(forwarded.json());
      }

      if (isSupplierQuotePayload) {
        const forwarded = await app.inject({
          method: 'POST',
          url: '/cases/supplier-quotes',
          headers: {
            ...(secret ? { 'x-webhook-secret': secret } : {}),
          },
          payload: body,
        });

        if (forwarded.statusCode >= 400) {
          return reply.status(forwarded.statusCode).send(forwarded.json());
        }
        return reply.status(forwarded.statusCode).send(forwarded.json());
      }

      if (isSupplierInvoicePayload) {
        const forwarded = await app.inject({
          method: 'POST',
          url: '/cases/supplier-invoice',
          headers: {
            ...(secret ? { 'x-webhook-secret': secret } : {}),
          },
          payload: body,
        });

        if (forwarded.statusCode >= 400) {
          return reply.status(forwarded.statusCode).send(forwarded.json());
        }
        return reply.status(forwarded.statusCode).send(forwarded.json());
      }

      return { ok: true };
    },
  );
}
