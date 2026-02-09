import { FastifyInstance } from 'fastify';
import { listUsers } from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

export async function userRoutes(app: FastifyInstance) {
  app.get('/users', { preHandler: requireAuth }, async () => {
    const users = await listUsers();
    return users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }));
  });
}
