import { FastifyInstance } from 'fastify';
import { createSupplier, deleteSupplier, listSuppliers, updateSupplier } from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

export async function supplierRoutes(app: FastifyInstance) {
  app.get('/suppliers', { preHandler: requireAuth }, async () => {
    return listSuppliers();
  });

  app.post(
    '/suppliers',
    { preHandler: requireAuth },
    async (request) => {
      const body = request.body as any;
      return createSupplier(body);
    },
  );

  app.patch(
    '/suppliers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const updated = await updateSupplier(id, body);
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      return updated;
    },
  );

  app.delete(
    '/suppliers/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await deleteSupplier(id);
      return reply.status(204).send();
    },
  );
}
