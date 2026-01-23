import { FastifyInstance } from 'fastify';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../lib/require-auth';

const uploadDir = path.resolve(process.cwd(), 'uploads');

export async function fileRoutes(app: FastifyInstance) {
  app.post('/cases/:id/files', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ message: 'No file provided' });
    }

    await fs.promises.mkdir(uploadDir, { recursive: true });
    const storageKey = `${Date.now()}-${data.filename}`;
    const targetPath = path.join(uploadDir, storageKey);
    await pipeline(data.file, fs.createWriteStream(targetPath));

    const fileRecord = await prisma.file.create({
      data: {
        caseId: id,
        type: 'PR_ATTACHMENT',
        filename: data.filename,
        mimeType: data.mimetype,
        size: Number(data.fields.size ?? 0),
        storageKey,
        uploadedBy: request.user?.id ?? 'system',
      },
    });

    return fileRecord;
  });

  app.get('/cases/:id/files', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return prisma.file.findMany({ where: { caseId: id } });
  });
}
