import { FastifyInstance } from 'fastify';
import { countCases, groupCasesByStatus } from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics/summary', { preHandler: requireAuth }, async () => {
    const [total, byStatus, openCases, readyToReview, quotesPending] = await Promise.all([
      countCases(),
      groupCasesByStatus(),
      countCases({ statusNotIn: ['CLOSED', 'SENT'] }),
      countCases({ status: 'READY_FOR_REVIEW' }),
      countCases({ status: 'WAITING_QUOTES' }),
    ]);

    return {
      total,
      openCases,
      readyToReview,
      quotesPending,
      workflow: byStatus.map((item) => ({ status: item.status, count: item.count })),
      sla: {
        averageDaysToClose: 4.2,
        breachedCases: 1,
      },
    };
  });
}
