import { FastifyInstance } from 'fastify';
import { supplierSchema } from '@procurement/shared';
import { prisma } from '../lib/prisma.js';
import { requireAuth } from '../lib/require-auth.js';

export async function supplierRoutes(app: FastifyInstance) {
  app.get('/suppliers', { preHandler: requireAuth }, async () => {
    return prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
  });

  app.post(
    '/suppliers',
    { preHandler: requireAuth },
    async (request) => {
      const body = request.body as any;
      return prisma.supplier.create({ data: body });
    },
  );

  app.patch(
    '/suppliers/:id',
    { preHandler: requireAuth },
    async (request) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      return prisma.supplier.update({ where: { id }, data: body });
    },
  );
}
