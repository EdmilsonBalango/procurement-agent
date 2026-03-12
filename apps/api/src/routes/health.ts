import { FastifyInstance } from 'fastify';
import { query } from '../lib/mysql.js';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (_request, reply) => {
    try {
      await query('select 1');
      return {
        api: 'up',
        database: 'up',
      };
    } catch (error) {
      reply.status(503);
      return {
        api: 'up',
        database: 'down',
        error: error instanceof Error ? error.message : 'Database unavailable',
      };
    }
  });
}
