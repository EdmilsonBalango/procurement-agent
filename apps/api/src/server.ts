import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { authRoutes } from './routes/auth.js';
import { caseRoutes } from './routes/cases.js';
import { supplierRoutes } from './routes/suppliers.js';
import { notificationRoutes } from './routes/notifications.js';
import { metricsRoutes } from './routes/metrics.js';
import { fileRoutes } from './routes/files.js';

const app = Fastify({
  logger: true,
});

await app.register(cookie);
await app.register(multipart);

await app.register(swagger, {
  openapi: {
    info: {
      title: 'Procurement API',
      version: '0.1.0',
    },
  },
});

await app.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false,
  },
});

await app.register(fastifyStatic, {
  root: path.join(process.cwd(), 'uploads'),
  prefix: '/uploads/',
});

await app.register(authRoutes);
await app.register(caseRoutes);
await app.register(supplierRoutes);
await app.register(notificationRoutes);
await app.register(metricsRoutes);
await app.register(fileRoutes);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
