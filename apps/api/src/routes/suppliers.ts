import { FastifyInstance } from 'fastify';
import { ZodTypeProvider } from '@fastify/type-provider-zod';
import { supplierSchema } from '@procurement/shared';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/require-auth';

export async function supplierRoutes(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>();

  server.get('/suppliers', { preHandler: requireAuth }, async () => {
    return prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
  });

  server.post(
    '/suppliers',
    { preHandler: requireAuth, schema: { body: supplierSchema } },
    async (request) => {
      return prisma.supplier.create({ data: request.body });
    },
  );

  server.patch(
    '/suppliers/:id',
    { preHandler: requireAuth, schema: { body: supplierSchema.partial() } },
    async (request) => {
      const { id } = request.params as { id: string };
      return prisma.supplier.update({ where: { id }, data: request.body });
    },
  );
}
