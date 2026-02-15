import { FastifyInstance } from 'fastify';
import {
  countQuotesByCase,
  createCase,
  createCaseEvent,
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
  listNotesByCase,
  listFilesByCase,
  listNotificationsByCase,
  listOutboundEmailsByCase,
  listQuotesByCase,
  listUsersByRole,
  createNote,
  updateCase,
} from '../lib/db.js';
import { requireAdmin, requireAuth } from '../lib/require-auth.js';
import { canMoveToReadyForReview, selectBuyerRoundRobin } from '../lib/rules.js';

export async function caseRoutes(app: FastifyInstance) {
  app.get('/cases', { preHandler: requireAuth }, async (request) => {
    const { status, buyerId, priority, requesterEmail, dateFrom, dateTo, search } =
      request.query as Record<string, string | undefined>;
    const user = request.user;
    const resolvedBuyerId =
      user && user.role !== 'ADMIN' ? user.id : buyerId;

    const records = await listCases({
      status,
      priority,
      requesterEmail,
      assignedBuyerId: resolvedBuyerId,
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
  
    return withQuotes;
  });

  app.post(
    '/cases',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const body = request.body as any;
      const created = await createCase({
        ...body,
        neededBy: new Date(body.neededBy),
      });
      await createCaseEvent({
        caseId: created.id,
        actorUserId: request.user?.id,
        type: 'CREATED',
        detailJson: JSON.stringify({ prNumber: created.prNumber }),
      });
      return created;
    },
  );

  app.get('/cases/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await getCaseById(id);

    if (!record) {
      return reply.status(404).send({ message: 'Not found' });
    }
    const user = request.user;
    if (user && user.role !== 'ADMIN' && record.assignedBuyerId !== user.id) {
      return reply.status(404).send({ message: 'Not found' });
    }

    const [quotes, items, checklist, files, outboundEmails, notifications, events, buyers, notes] =
      await Promise.all([
        listQuotesByCase(id),
        listCaseItems(id),
        listChecklistItems(id),
        listFilesByCase(id),
        listOutboundEmailsByCase(id),
        listNotificationsByCase(id),
        listCaseEvents(id),
        listUsersByRole('BUYER'),
        listNotesByCase(id),
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
      notes,
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
      const before = await getCaseById(id);

      if (payload.status === 'READY_FOR_REVIEW') {
        const quotesCount = await countQuotesByCase(id);
        const caseRecord = before;
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
      if (before && payload.status && payload.status !== before.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: before.status, to: payload.status }),
        });
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

      const before = await getCaseById(id);
      const shouldPreserveStatus = before
        ? [
            'WAITING_QUOTES',
            'READY_FOR_REVIEW',
            'READY_TO_SEND',
            'CLOSED_PAID',
            'SENT',
            'CLOSED',
          ].includes(before.status)
        : false;
      const updated = await updateCase(id, {
        assignedBuyerId: resolvedBuyerId,
        status: shouldPreserveStatus ? before?.status : 'ASSIGNED',
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

      if (before && before.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: before.status, to: updated.status }),
        });
      }
      if (resolvedBuyerId) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'ASSIGNMENT',
          detailJson: JSON.stringify({ assignedBuyerId: resolvedBuyerId }),
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

      const before = await getCaseById(id);
      const updated = await updateCase(id, { status: 'WAITING_QUOTES' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      if (before && before.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: before.status, to: updated.status }),
        });
      }
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'RFQ_SENT',
        detailJson: JSON.stringify({ supplierIds }),
      });

      return updated;
    },
  );

  app.post(
    '/cases/:id/notes',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { body?: string };
      if (!body.body || body.body.trim().length === 0) {
        return reply.status(400).send({ message: 'Note body is required.' });
      }
      const note = await createNote({
        caseId: id,
        authorUserId: request.user?.id,
        body: body.body.trim(),
      });
      return note;
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
      const before = await getCaseById(id);
      const quote = await createQuote({
        caseId: id,
        supplierId: body.supplierId,
        amount: body.amount,
        currency: body.currency,
        fileId: body.fileId,
        notes: body.notes,
      });
      if (before && !['CLOSED', 'SENT'].includes(before.status)) {
        const updated = await updateCase(id, { status: 'READY_FOR_REVIEW' });
        if (updated && before.status !== updated.status) {
          await createCaseEvent({
            caseId: id,
            actorUserId: request.user?.id,
            type: 'STATUS_CHANGE',
            detailJson: JSON.stringify({ from: before.status, to: updated.status }),
          });
        }
      }
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
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'EXCEPTION_APPROVED',
        detailJson: JSON.stringify({ reason: body.reason }),
      });
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

      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'FINAL_SENT',
        detailJson: JSON.stringify({ subject: body.subject }),
      });

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
