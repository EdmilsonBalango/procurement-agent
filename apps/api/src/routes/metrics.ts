import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/require-auth.js';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics/summary', { preHandler: requireAuth }, async () => {
    const total = await prisma.case.count();
    const byStatus = await prisma.case.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    const openCases = await prisma.case.count({
      where: { status: { notIn: ['CLOSED', 'SENT'] } },
    });
    const readyToReview = await prisma.case.count({ where: { status: 'READY_FOR_REVIEW' } });
    const quotesPending = await prisma.case.count({ where: { status: 'WAITING_QUOTES' } });

    return {
      total,
      openCases,
      readyToReview,
      quotesPending,
      workflow: byStatus.map((item) => ({ status: item.status, count: item._count.status })),
      sla: {
        averageDaysToClose: 4.2,
        breachedCases: 1,
      },
    };
  });
}
