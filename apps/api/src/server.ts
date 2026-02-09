import dotenv from 'dotenv';
import path from 'node:path';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import { authRoutes } from './routes/auth.js';
import { caseRoutes } from './routes/cases.js';
import { supplierRoutes } from './routes/suppliers.js';
import { notificationRoutes } from './routes/notifications.js';
import { metricsRoutes } from './routes/metrics.js';
import { fileRoutes } from './routes/files.js';
import { webhookRoutes } from './routes/webhooks.js';
import { prRoutes } from './routes/prs.js';
import { userRoutes } from './routes/users.js';
import { initDb } from './lib/db.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

const app = Fastify({
  logger: true,
});

await initDb();

await app.register(cookie);
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    if (process.env.NODE_ENV !== 'production') {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed'), false);
  },
  credentials: true,
});
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
await app.register(webhookRoutes);
await app.register(prRoutes);
await app.register(userRoutes);

const port = Number(process.env.PORT ?? 3001);

app.listen({ port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
