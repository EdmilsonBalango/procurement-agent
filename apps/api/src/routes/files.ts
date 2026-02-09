import { FastifyInstance } from 'fastify';
import { pipeline } from 'node:stream/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createFile, listFilesByCase } from '../lib/db.js';
import { requireAuth } from '../lib/require-auth.js';

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

    const fileRecord = await createFile({
      caseId: id,
      type: 'PR_ATTACHMENT',
      filename: data.filename,
      mimeType: data.mimetype,
      size: Number(data.fields.size ?? 0),
      storageKey,
      uploadedBy: request.user?.id ?? 'system',
    });

    return fileRecord;
  });

  app.get('/cases/:id/files', { preHandler: requireAuth }, async (request) => {
    const { id } = request.params as { id: string };
    return listFilesByCase(id);
  });
}
