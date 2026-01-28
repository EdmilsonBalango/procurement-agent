import { FastifyInstance } from 'fastify';
import {
  assignCaseSchema,
  approveExceptionSchema,
  createCaseSchema,
  createQuoteSchema,
  requestQuotesSchema,
  sendFinalSchema,
  updateCaseSchema,
} from '@procurement/shared';
import { prisma } from '../lib/prisma.js';
import { requireAdmin, requireAuth } from '../lib/require-auth.js';
import { canMoveToReadyForReview, selectBuyerRoundRobin } from '../lib/rules.js';

export async function caseRoutes(app: FastifyInstance) {
  app.get('/cases', { preHandler: requireAuth }, async (request) => {
    const { status, buyerId, priority, requesterEmail, dateFrom, dateTo, search } =
      request.query as Record<string, string | undefined>;

    return prisma.case.findMany({
      where: {
        status: status as any,
        priority: priority as any,
        requesterEmail: requesterEmail ? { contains: requesterEmail } : undefined,
        assignedBuyerId: buyerId,
        createdAt: {
          gte: dateFrom ? new Date(dateFrom) : undefined,
          lte: dateTo ? new Date(dateTo) : undefined,
        },
        OR: search
          ? [
              { prNumber: { contains: search } },
              { subject: { contains: search } },
              { requesterName: { contains: search } },
            ]
          : undefined,
      },
      include: {
        quotes: true,
        assignedBuyer: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  });

  app.post(
    '/cases',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const body = request.body as any;
      return prisma.case.create({
        data: {
          ...body,
          neededBy: new Date(body.neededBy),
        },
      });
    },
  );

  app.get('/cases/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await prisma.case.findUnique({
      where: { id },
      include: {
        items: true,
        checklist: true,
        quotes: { include: { supplier: true } },
        files: true,
        outboundEmails: true,
        notifications: true,
        events: true,
        assignedBuyer: true,
      },
    });

    if (!record) {
      return reply.status(404).send({ message: 'Not found' });
    }

    return record;
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
        const quotesCount = await prisma.quote.count({ where: { caseId: id } });
        const caseRecord = await prisma.case.findUnique({ where: { id } });
        const hasException = Boolean(caseRecord?.exceptionApprovedAt);
        if (!canMoveToReadyForReview({ quotesCount, hasException })) {
          return reply
            .status(400)
            .send({ message: 'At least 3 quotes required unless exception approved.' });
        }
      }

      return prisma.case.update({
        where: { id },
        data: payload,
      });
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
        const buyers = await prisma.user.findMany({ where: { role: 'BUYER' } });
        if (buyers.length < 2) {
          return reply.status(400).send({ message: 'Not enough buyers to assign.' });
        }
        const workloads = await Promise.all(
          buyers.map(async (buyer) => ({
            buyerId: buyer.id,
            count: await prisma.case.count({
              where: {
                assignedBuyerId: buyer.id,
                status: { notIn: ['CLOSED', 'SENT'] },
              },
            }),
          })),
        );
        resolvedBuyerId = selectBuyerRoundRobin(workloads) ?? undefined;
      }

      const updated = await prisma.case.update({
        where: { id },
        data: {
          assignedBuyerId: resolvedBuyerId,
          status: 'ASSIGNED',
        },
      });

      await prisma.notification.create({
        data: {
          userId: resolvedBuyerId,
          type: 'ASSIGNMENT',
          title: 'New PR assigned',
          body: `${updated.prNumber} assigned to you`,
          caseId: id,
          severity: 'INFO',
        },
      });

      return updated;
    },
  );

  app.post(
    '/cases/:id/request-quotes',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { supplierIds, messageTemplate } = body;
      const suppliers = await prisma.supplier.findMany({
        where: { id: { in: supplierIds } },
      });

      await prisma.outboundEmailLog.createMany({
        data: suppliers.map((supplier) => ({
          caseId: id,
          type: 'RFQ',
          to: JSON.stringify([supplier.email]),
          cc: JSON.stringify([]),
          subject: `RFQ for case ${id}`,
          body: messageTemplate ?? 'Please provide your best quote.',
          attachmentFileIds: JSON.stringify([]),
          createdBy: request.user?.id,
        })),
      });

      const updated = await prisma.case.update({
        where: { id },
        data: { status: 'WAITING_QUOTES' },
      });

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
      const quote = await prisma.quote.create({
        data: {
          caseId: id,
          supplierId: body.supplierId,
          amount: body.amount,
          currency: body.currency,
          fileId: body.fileId,
          notes: body.notes,
        },
      });
      return quote;
    },
  );

  app.post(
    '/cases/:id/approve-exception',
    {
      preHandler: requireAdmin,
    },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      return prisma.case.update({
        where: { id },
        data: {
          exceptionApprovedAt: new Date(),
          exceptionApprovedById: request.user?.id,
          exceptionReason: body.reason,
        },
      });
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
      const caseRecord = await prisma.case.findUnique({ where: { id } });
      if (!caseRecord || caseRecord.status !== 'READY_TO_SEND') {
        return reply.status(400).send({ message: 'Case not ready to send.' });
      }

      await prisma.outboundEmailLog.create({
        data: {
          caseId: id,
          type: 'FINAL_RESPONSE',
          to: JSON.stringify([caseRecord.requesterEmail]),
          cc: JSON.stringify([]),
          subject: body.subject,
          body: body.body,
          attachmentFileIds: JSON.stringify(body.attachmentFileIds ?? []),
          createdBy: request.user?.id,
        },
      });

      const updated = await prisma.case.update({
        where: { id },
        data: { status: 'SENT' },
      });

      if (updated.assignedBuyerId) {
        await prisma.notification.create({
          data: {
            userId: updated.assignedBuyerId,
            type: 'FINAL_SENT',
            title: 'Final response sent',
            body: `${updated.prNumber} final response delivered`,
            caseId: id,
            severity: 'INFO',
          },
        });
      }

      return updated;
    },
  );
}
