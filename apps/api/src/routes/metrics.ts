import { FastifyInstance } from 'fastify';
import { countCases, groupCasesByStatus, listCases } from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics/summary', { preHandler: requireAuth }, async (request) => {
    const user = request.user;
    const assignedBuyerId = user && user.role !== 'ADMIN' ? user.id : undefined;
    const [total, byStatus, openCases, readyToReview, quotesPending, cases] = await Promise.all([
      countCases({ statusNotIn: ['QUARANTINE'] }),
      groupCasesByStatus(),
      countCases({ statusNotIn: ['CLOSED', 'SENT', 'QUARANTINE'] }),
      countCases({ status: 'READY_FOR_REVIEW' }),
      countCases({ status: 'WAITING_QUOTES' }),
      listCases({ assignedBuyerId }),
    ]);
    const visibleCases = cases.filter((item) => item.status !== 'QUARANTINE');
    const completedStatuses = new Set(['CLOSED', 'CLOSED_PAID', 'SENT']);
    const completedCases = visibleCases.filter((item) => completedStatuses.has(item.status));
    const averageDaysToClose = completedCases.length
      ? completedCases.reduce((sum, item) => {
          const createdAt = new Date(item.createdAt).getTime();
          const completedAt = new Date(item.updatedAt).getTime();
          const durationDays = Math.max(0, completedAt - createdAt) / (1000 * 60 * 60 * 24);
          return sum + durationDays;
        }, 0) / completedCases.length
      : 0;

    const slaEvaluatedCases = visibleCases.filter((item) => !Number.isNaN(new Date(item.neededBy).getTime()));
    const breachedCases = slaEvaluatedCases.filter((item) => {
      const deadline = new Date(item.neededBy).getTime();
      const referenceTime = completedStatuses.has(item.status)
        ? new Date(item.updatedAt).getTime()
        : Date.now();
      return referenceTime > deadline;
    }).length;
    const compliantCases = Math.max(0, slaEvaluatedCases.length - breachedCases);
    const complianceRate = slaEvaluatedCases.length
      ? (compliantCases / slaEvaluatedCases.length) * 100
      : 100;

    return {
      total,
      openCases,
      readyToReview,
      quotesPending,
      workflow: byStatus
        .filter((item) => item.status !== 'QUARANTINE')
        .map((item) => ({ status: item.status, count: item.count })),
      sla: {
        averageDaysToClose,
        completedCases: completedCases.length,
        breachedCases,
        compliantCases,
        evaluatedCases: slaEvaluatedCases.length,
        complianceRate,
      },
    };
  });
}
