import { FastifyInstance } from 'fastify';
import {
  countQuotesByCase,
  createCase,
  createNotification,
  createOutboundEmailLog,
  createOutboundEmailLogs,
  createQuote,
  getCaseById,
  getSupplierById,
  listCaseEvents,
  listCaseItems,
  listCases,
  listChecklistItems,
  listFilesByCase,
  listNotificationsByCase,
  listOutboundEmailsByCase,
  listQuotesByCase,
  listUsersByRole,
  updateCase,
} from '../lib/db.js';
import { requireAdmin, requireAuth } from '../lib/require-auth.js';
import { canMoveToReadyForReview, selectBuyerRoundRobin } from '../lib/rules.js';

export async function caseRoutes(app: FastifyInstance) {
  app.get('/cases', { preHandler: requireAuth }, async (request) => {
    const { status, buyerId, priority, requesterEmail, dateFrom, dateTo, search } =
      request.query as Record<string, string | undefined>;

    const records = await listCases({
      status,
      priority,
      requesterEmail,
      assignedBuyerId: buyerId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      search,
    });

    const buyers = await listUsersByRole('BUYER');
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    const withQuotes = await Promise.all(
      records.map(async (record) => ({
        ...record,
        quotes: await listQuotesByCase(record.id),
        assignedBuyer: record.assignedBuyerId
          ? buyerMap.get(record.assignedBuyerId) ?? null
          : null,
      })),
    );
    console.log('Fetched cases with quotes:', withQuotes);
    return withQuotes;
  });

  app.post(
    '/cases',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const body = request.body as any;
      return createCase({
        ...body,
        neededBy: new Date(body.neededBy),
      });
    },
  );

  app.get('/cases/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await getCaseById(id);

    if (!record) {
      return reply.status(404).send({ message: 'Not found' });
    }

    const [quotes, items, checklist, files, outboundEmails, notifications, events, buyers] =
      await Promise.all([
        listQuotesByCase(id),
        listCaseItems(id),
        listChecklistItems(id),
        listFilesByCase(id),
        listOutboundEmailsByCase(id),
        listNotificationsByCase(id),
        listCaseEvents(id),
        listUsersByRole('BUYER'),
      ]);
    const quotesWithSuppliers = await Promise.all(
      quotes.map(async (quote) => ({
        ...quote,
        supplier: await getSupplierById(quote.supplierId),
      })),
    );
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));

    return {
      ...record,
      items,
      checklist,
      quotes: quotesWithSuppliers,
      files,
      outboundEmails,
      notifications,
      events,
      assignedBuyer: record.assignedBuyerId
        ? buyerMap.get(record.assignedBuyerId) ?? null
        : null,
    };
  });

  app.patch(
    '/cases/:id',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = request.body as any;

      if (payload.status === 'READY_FOR_REVIEW') {
        const quotesCount = await countQuotesByCase(id);
        const caseRecord = await getCaseById(id);
        const hasException = Boolean(caseRecord?.exceptionApprovedAt);
        if (!canMoveToReadyForReview({ quotesCount, hasException })) {
          return reply
            .status(400)
            .send({ message: 'At least 3 quotes required unless exception approved.' });
        }
      }

      const updated = await updateCase(id, payload);
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      return updated;
    },
  );

  app.post(
    '/cases/:id/assign',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { buyerId } = body;
      let resolvedBuyerId = buyerId;

      if (!resolvedBuyerId) {
        const buyers = await listUsersByRole('BUYER');
        if (buyers.length < 2) {
          return reply.status(400).send({ message: 'Not enough buyers to assign.' });
        }
        const workloads = await Promise.all(
          buyers.map(async (buyer) => ({
            buyerId: buyer.id,
            count: (await listCases({
              assignedBuyerId: buyer.id,
            })).filter((record) => !['CLOSED', 'SENT'].includes(record.status)).length,
          })),
        );
        resolvedBuyerId = selectBuyerRoundRobin(workloads) ?? undefined;
      }

      const updated = await updateCase(id, {
        assignedBuyerId: resolvedBuyerId,
        status: 'ASSIGNED',
      });

      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      if (resolvedBuyerId) {
        await createNotification({
          userId: resolvedBuyerId,
          type: 'ASSIGNMENT',
          title: 'New PR assigned',
          body: `${updated.prNumber} assigned to you`,
          caseId: id,
          severity: 'INFO',
          isRead: false,
        });
      }

      return updated;
    },
  );

  app.post(
    '/cases/:id/request-quotes',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { supplierIds: string[]; messageTemplate?: string };
      const { supplierIds, messageTemplate } = body;
      const suppliers = (
        await Promise.all(supplierIds.map((supplierId) => getSupplierById(supplierId)))
      ).filter((supplier): supplier is NonNullable<typeof supplier> => Boolean(supplier));

      await createOutboundEmailLogs(
        suppliers.map((supplier) => ({
          caseId: id,
          type: 'RFQ',
          to: JSON.stringify([supplier.email]),
          cc: JSON.stringify([]),
          subject: `RFQ for case ${id}`,
          body: messageTemplate ?? 'Please provide your best quote.',
          attachmentFileIds: JSON.stringify([]),
          createdBy: request.user?.id,
        })),
      );

      const updated = await updateCase(id, { status: 'WAITING_QUOTES' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      return updated;
    },
  );

  app.post(
    '/cases/:id/quotes',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const quote = await createQuote({
        caseId: id,
        supplierId: body.supplierId,
        amount: body.amount,
        currency: body.currency,
        fileId: body.fileId,
        notes: body.notes,
      });
      return quote;
    },
  );

  app.post(
    '/cases/:id/approve-exception',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const updated = await updateCase(id, {
        exceptionApprovedAt: new Date(),
        exceptionApprovedById: request.user?.id,
        exceptionReason: body.reason,
      });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      return updated;
    },
  );

  app.post(
    '/cases/:id/send-final',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const caseRecord = await getCaseById(id);
      if (!caseRecord || caseRecord.status !== 'READY_TO_SEND') {
        return reply.status(400).send({ message: 'Case not ready to send.' });
      }

      await createOutboundEmailLog({
        caseId: id,
        type: 'FINAL_RESPONSE',
        to: JSON.stringify([caseRecord.requesterEmail]),
        cc: JSON.stringify([]),
        subject: body.subject,
        body: body.body,
        attachmentFileIds: JSON.stringify(body.attachmentFileIds ?? []),
        createdBy: request.user?.id,
      });

      const updated = await updateCase(id, { status: 'SENT' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      if (updated.assignedBuyerId) {
        await createNotification({
          userId: updated.assignedBuyerId,
          type: 'FINAL_SENT',
          title: 'Final response sent',
          body: `${updated.prNumber} final response delivered`,
          caseId: id,
          severity: 'INFO',
          isRead: false,
        });
      }

      return updated;
    },
  );
}
