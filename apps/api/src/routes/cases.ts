import { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import {
  countQuotesByCase,
  createCase,
  createCaseEvent,
  createFile,
  createNotification,
  createOutboundEmailLog,
  createOutboundEmailLogs,
  createQuote,
  getCaseById,
  getCaseByPrNumber,
  findUserById,
  createSupplier,
  getSupplierById,
  getSupplierByEmail,
  listCaseEvents,
  listCaseItems,
  listCases,
  listChecklistItems,
  listNotesByCase,
  listFilesByCase,
  listNotificationsByCase,
  listOutboundEmailsByCase,
  listQuotesByCase,
  listUsersByRole,
  createNote,
  deleteQuote,
  updateCase,
} from '../lib/db.js';
import { requireAdmin, requireAuth } from '../lib/require-auth.js';
import { canMoveToReadyForReview, selectBuyerRoundRobin } from '../lib/rules.js';
import { forwardEmailToWebhook, forwardPopToWebhook } from '../lib/email-webhook.js';

const uploadDir = path.resolve(process.cwd(), 'uploads', 'quotes');
const RFQ_SUBJECT_REGEX = /KARINGANI\s*-\s*RFQ\s*for\s*case\s+([A-Za-z0-9-]+)/i;
const INVOICE_SUBJECT_REGEX =
  /KARINGANI\s*-\s*(?:INVOICE|Invoice\s*request)\s*for\s*case\s+([A-Za-z0-9-]+)/i;
const RECEIPT_SUBJECT_REGEX =
  /KARINGANI\s*-\s*(?:POP|RECEIPT|Proof\s*of\s*Payment)[^]*?\bcase\s+([A-Za-z0-9-]+)/i;
const SUPPLIER_QUOTES_BODY_LIMIT = Number(process.env.SUPPLIER_QUOTES_BODY_LIMIT ?? 30 * 1024 * 1024);
const PDF_MIME_TYPE = 'application/pdf';
const CLOSED_CASE_STATUSES = new Set(['CLOSED', 'CLOSED_PAID']);
const HIDDEN_CASE_STATUSES = new Set(['QUARANTINE']);

function parsePrNumberFromSubject(subject: string) {
  const match = RFQ_SUBJECT_REGEX.exec(subject);
  return match?.[1] ?? null;
}

function parsePrNumberFromInvoiceSubject(subject: string) {
  const match = INVOICE_SUBJECT_REGEX.exec(subject);
  return match?.[1] ?? null;
}

function parsePrNumberFromReceiptSubject(subject: string) {
  const match = RECEIPT_SUBJECT_REGEX.exec(subject);
  return match?.[1] ?? null;
}

function normalizeFilename(filename: string, fallbackIndex: number) {
  const base = path.basename(filename || `quote-${fallbackIndex}.pdf`);
  return base.replace(/[^\w.\-]+/g, '_');
}

function decodeBase64Content(contentBase64: string) {
  const normalized = contentBase64.includes(',') ? contentBase64.split(',').pop() ?? '' : contentBase64;
  return Buffer.from(normalized, 'base64');
}

function isPdfUpload(filename: string, mimetype: string) {
  const normalizedMimeType = mimetype.toLowerCase();
  const normalizedFilename = filename.toLowerCase();
  return normalizedMimeType === PDF_MIME_TYPE || normalizedFilename.endsWith('.pdf');
}

function isClosedCaseStatus(status?: string | null) {
  return Boolean(status && CLOSED_CASE_STATUSES.has(status));
}

function isHiddenCaseStatus(status?: string | null) {
  return Boolean(status && HIDDEN_CASE_STATUSES.has(status));
}

export async function caseRoutes(app: FastifyInstance) {
  const rejectClosedCaseMutation = async (
    request: { user?: { role?: string } },
    reply: { status: (code: number) => { send: (payload: { message: string }) => unknown } },
    caseRecord: { status: string } | null | undefined,
  ) => {
    if (caseRecord && isClosedCaseStatus(caseRecord.status) && request.user?.role !== 'ADMIN') {
      return reply.status(403).send({ message: 'Closed PRs can only be changed by admins.' });
    }
    return null;
  };

  const sendClosedCaseAutoReply = async (
    caseRecord: { id: string; prNumber: string; messageId: string; assignedBuyerId?: string | null },
    recipientEmail: string,
    incomingSubject: string,
  ) => {
    const assignedBuyer = caseRecord.assignedBuyerId
      ? await findUserById(caseRecord.assignedBuyerId)
      : null;
    const contactName = assignedBuyer?.name ?? 'Procurement Team';
    const contactEmail = assignedBuyer?.email ?? '';
    const html = `<p>Hello,</p><p>Case ${caseRecord.prNumber} is already closed, so we cannot accept additional documents for it.</p><p>For further information, please contact ${contactName}${contactEmail ? ` at ${contactEmail}` : ''}.</p><p>Kind regards,<br/>Karingani Procurement Team</p>`;
    const subject = `Re: ${incomingSubject}`;

    try {
      const forwarded = await forwardEmailToWebhook({
        type: 'REQUEST_QUOTES',
        html,
        messageID: caseRecord.messageId ?? caseRecord.id,
        suppliers: [recipientEmail],
        subject,
      });
      if (!forwarded.ok) {
        app.log.error(
          {
            event: 'closed_case.auto_reply_not_ok',
            caseId: caseRecord.id,
            recipientEmail,
            webhookStatus: forwarded.status,
            webhookBody: forwarded.body,
          },
          'Webhook returned non-2xx for closed case auto reply',
        );
      }
    } catch (error) {
      app.log.error(
        {
          event: 'closed_case.auto_reply_failed',
          caseId: caseRecord.id,
          recipientEmail,
          error,
        },
        'Failed to send closed case auto reply',
      );
    }

    await createOutboundEmailLog({
      caseId: caseRecord.id,
      type: 'CLOSED_CASE_AUTO_REPLY',
      to: JSON.stringify([recipientEmail]),
      cc: JSON.stringify([]),
      subject,
      body: html,
      attachmentFileIds: JSON.stringify([]),
      createdBy: null,
    });
    await createCaseEvent({
      caseId: caseRecord.id,
      actorUserId: null,
      type: 'CLOSED_CASE_AUTO_REPLY_SENT',
      detailJson: JSON.stringify({ to: recipientEmail, subject }),
    });
  };

  app.get('/cases', { preHandler: requireAuth }, async (request) => {
    const { status, buyerId, priority, requesterEmail, dateFrom, dateTo, search } =
      request.query as Record<string, string | undefined>;
    const user = request.user;
    const resolvedBuyerId =
      user && user.role !== 'ADMIN' ? user.id : buyerId;

    const records = await listCases({
      status,
      priority,
      requesterEmail,
      assignedBuyerId: resolvedBuyerId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      search,
    });
    const visibleRecords = records.filter((record) => !isHiddenCaseStatus(record.status));

    const buyers = await listUsersByRole('BUYER');
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));
    const withQuotes = await Promise.all(
      visibleRecords.map(async (record) => ({
        ...record,
        quotes: await listQuotesByCase(record.id),
        assignedBuyer: record.assignedBuyerId
          ? buyerMap.get(record.assignedBuyerId) ?? null
          : null,
      })),
    );
  
    return withQuotes;
  });

  app.post(
    '/cases',
    {
      preHandler: requireAuth,
    },
    async (request) => {
      const body = request.body as any;
      const created = await createCase({
        ...body,
        neededBy: new Date(body.neededBy),
      });
      await createCaseEvent({
        caseId: created.id,
        actorUserId: request.user?.id,
        type: 'CREATED',
        detailJson: JSON.stringify({ prNumber: created.prNumber }),
      });
      return created;
    },
  );

  app.post(
    '/cases/supplier-quotes',
    {
      bodyLimit: Number.isFinite(SUPPLIER_QUOTES_BODY_LIMIT) ? SUPPLIER_QUOTES_BODY_LIMIT : 30 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['supplier', 'subject', 'files'],
          properties: {
            supplier: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', minLength: 1 },
              },
              additionalProperties: false,
            },
            subject: { type: 'string', minLength: 1 },
            files: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['fileName', 'mimeType', 'dataBase64'],
                properties: {
                  fileName: { type: 'string', minLength: 1 },
                  mimeType: { type: 'string', minLength: 1 },
                  dataBase64: { type: 'string', minLength: 1 },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = request.headers['x-webhook-secret'];
        const providedValue = Array.isArray(provided) ? provided[0] : provided;
        if (providedValue !== secret) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }

      const body = request.body as {
        supplier: { name: string; email: string };
        subject: string;
        files: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
      };

      const supplierEmail = body.supplier.email.trim().toLowerCase();
      const supplierName = body.supplier.name.trim();
      const prNumber = parsePrNumberFromSubject(body.subject.trim());
      if (!prNumber) {
        return reply.status(400).send({
          message: 'Could not extract PR number from subject. Expected: KARINGANI - RFQ for case <prNumber>',
        });
      }

      const caseRecord = await getCaseByPrNumber(prNumber);
      if (!caseRecord) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isHiddenCaseStatus(caseRecord.status)) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isClosedCaseStatus(caseRecord.status)) {
        await sendClosedCaseAutoReply(caseRecord, supplierEmail, body.subject.trim());
        return reply.status(409).send({
          message: `Case ${prNumber} is closed and cannot receive additional quote files.`,
        });
      }

      let supplier = await getSupplierByEmail(supplierEmail);
      if (!supplier) {
        supplier = await createSupplier({
          name: supplierName,
          email: supplierEmail,
          categories: 'General',
          isActive: true,
          phonePrimary: null,
          phoneSecondary: null,
          location: null,
        });
      }

      await fs.mkdir(uploadDir, { recursive: true });

      const createdFiles = await Promise.all(
        body.files.map(async (file, index) => {
          const safeFilename = normalizeFilename(file.fileName, index + 1);
          const contentBuffer = decodeBase64Content(file.dataBase64);
          const storageKey = `${Date.now()}-${index + 1}-${safeFilename}`;
          const targetPath = path.join(uploadDir, storageKey);
          await fs.writeFile(targetPath, contentBuffer);

          return createFile({
            caseId: caseRecord.id,
            type: 'QUOTE_ATTACHMENT',
            filename: safeFilename,
            mimeType: file.mimeType,
            size: contentBuffer.length,
            storageKey,
            uploadedBy: supplier.id,
          });
        }),
      );
      const fileCount = createdFiles.length;
      const supplierDisplay = supplier.name.trim() || supplier.email;

      await createCaseEvent({
        caseId: caseRecord.id,
        actorUserId: null,
        type: 'QUOTE_RECEIVED',
        detailJson: JSON.stringify({
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierEmail: supplier.email,
          subject: body.subject,
          files: createdFiles.map((file) => ({
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
          })),
        }),
      });

      const [admins, buyers] = await Promise.all([listUsersByRole('ADMIN'), listUsersByRole('BUYER')]);
      const recipientIds = new Set<string>();
      admins.forEach((user) => recipientIds.add(user.id));
      if (caseRecord.assignedBuyerId) {
        recipientIds.add(caseRecord.assignedBuyerId);
      } else {
        buyers.forEach((user) => recipientIds.add(user.id));
      }

      await Promise.all(
        [...recipientIds].map((userId) =>
          createNotification({
            userId,
            type: 'SUPPLIER_QUOTE_FILES_RECEIVED',
            title: 'Supplier quote files received',
            body: `Received ${fileCount} file${fileCount === 1 ? '' : 's'} from ${supplierDisplay}.`,
            caseId: caseRecord.id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      if (!['READY_FOR_REVIEW', 'IN_REVIEW', 'REQUEST_INVOICE', 'WAITING_INVOICE', 'REQUEST_RECEIPT', 'WAITING_RECEIPT', 'SENT', 'CLOSED'].includes(caseRecord.status)) {
        const updated = await updateCase(caseRecord.id, { status: 'READY_FOR_REVIEW' });
        if (updated && updated.status !== caseRecord.status) {
          await createCaseEvent({
            caseId: caseRecord.id,
            actorUserId: null,
            type: 'STATUS_CHANGE',
            detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
          });
        }
      }

      return reply.status(201).send({
        ok: true,
        caseId: caseRecord.id,
        prNumber,
        supplierId: supplier.id,
        attachedFileIds: createdFiles.map((file) => file.id),
      });
    },
  );

  app.post(
    '/cases/supplier-invoice',
    {
      bodyLimit: Number.isFinite(SUPPLIER_QUOTES_BODY_LIMIT) ? SUPPLIER_QUOTES_BODY_LIMIT : 30 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['supplier', 'subject', 'files'],
          properties: {
            supplier: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', minLength: 1 },
              },
              additionalProperties: false,
            },
            subject: { type: 'string', minLength: 1 },
            files: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['fileName', 'mimeType', 'dataBase64'],
                properties: {
                  fileName: { type: 'string', minLength: 1 },
                  mimeType: { type: 'string', minLength: 1 },
                  dataBase64: { type: 'string', minLength: 1 },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = request.headers['x-webhook-secret'];
        const providedValue = Array.isArray(provided) ? provided[0] : provided;
        if (providedValue !== secret) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }

      const body = request.body as {
        supplier: { name: string; email: string };
        subject: string;
        files: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
      };

      const supplierEmail = body.supplier.email.trim().toLowerCase();
      const supplierName = body.supplier.name.trim();
      const prNumber = parsePrNumberFromInvoiceSubject(body.subject.trim());
      if (!prNumber) {
        return reply.status(400).send({
          message:
            'Could not extract PR number from subject. Expected: KARINGANI - INVOICE for case <prNumber> or KARINGANI - Invoice request for case <prNumber>',
        });
      }

      const caseRecord = await getCaseByPrNumber(prNumber);
      if (!caseRecord) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isHiddenCaseStatus(caseRecord.status)) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isClosedCaseStatus(caseRecord.status)) {
        await sendClosedCaseAutoReply(caseRecord, supplierEmail, body.subject.trim());
        return reply.status(409).send({
          message: `Case ${prNumber} is closed and cannot receive additional invoice files.`,
        });
      }

      let supplier = await getSupplierByEmail(supplierEmail);
      if (!supplier) {
        supplier = await createSupplier({
          name: supplierName,
          email: supplierEmail,
          categories: 'General',
          isActive: true,
          phonePrimary: null,
          phoneSecondary: null,
          location: null,
        });
      }

      await fs.mkdir(uploadDir, { recursive: true });
      const createdFiles = await Promise.all(
        body.files.map(async (file, index) => {
          const safeFilename = normalizeFilename(file.fileName, index + 1);
          const contentBuffer = decodeBase64Content(file.dataBase64);
          const storageKey = `${Date.now()}-invoice-${index + 1}-${safeFilename}`;
          const targetPath = path.join(uploadDir, storageKey);
          await fs.writeFile(targetPath, contentBuffer);

          return createFile({
            caseId: caseRecord.id,
            type: 'SUPPLIER_INVOICE',
            filename: safeFilename,
            mimeType: file.mimeType,
            size: contentBuffer.length,
            storageKey,
            uploadedBy: supplier.id,
          });
        }),
      );

      await createCaseEvent({
        caseId: caseRecord.id,
        actorUserId: null,
        type: 'INVOICE_RECEIVED',
        detailJson: JSON.stringify({
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierEmail: supplier.email,
          subject: body.subject,
          files: createdFiles.map((file) => ({
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
          })),
        }),
      });

      const [admins, buyers] = await Promise.all([listUsersByRole('ADMIN'), listUsersByRole('BUYER')]);
      const recipientIds = new Set<string>();
      admins.forEach((user) => recipientIds.add(user.id));
      if (caseRecord.assignedBuyerId) {
        recipientIds.add(caseRecord.assignedBuyerId);
      } else {
        buyers.forEach((user) => recipientIds.add(user.id));
      }

      await Promise.all(
        [...recipientIds].map((userId) =>
          createNotification({
            userId,
            type: 'SUPPLIER_INVOICE_RECEIVED',
            title: 'Supplier invoice received',
            body: `Received ${createdFiles.length} invoice file${createdFiles.length === 1 ? '' : 's'} from ${supplier.name.trim() || supplier.email}.`,
            caseId: caseRecord.id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      if (!['REQUEST_RECEIPT', 'WAITING_RECEIPT', 'SENT', 'CLOSED', 'CLOSED_PAID'].includes(caseRecord.status)) {
        const updated = await updateCase(caseRecord.id, { status: 'REQUEST_RECEIPT' });
        if (updated && updated.status !== caseRecord.status) {
          await createCaseEvent({
            caseId: caseRecord.id,
            actorUserId: null,
            type: 'STATUS_CHANGE',
            detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
          });
        }
      }

      return reply.status(201).send({
        ok: true,
        caseId: caseRecord.id,
        prNumber,
        supplierId: supplier.id,
        attachedFileIds: createdFiles.map((file) => file.id),
      });
    },
  );

  app.post(
    '/cases/supplier-receipt',
    {
      bodyLimit: Number.isFinite(SUPPLIER_QUOTES_BODY_LIMIT) ? SUPPLIER_QUOTES_BODY_LIMIT : 30 * 1024 * 1024,
      schema: {
        body: {
          type: 'object',
          required: ['supplier', 'subject', 'files'],
          properties: {
            supplier: {
              type: 'object',
              required: ['name', 'email'],
              properties: {
                name: { type: 'string', minLength: 1 },
                email: { type: 'string', minLength: 1 },
              },
              additionalProperties: false,
            },
            subject: { type: 'string', minLength: 1 },
            files: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['fileName', 'mimeType', 'dataBase64'],
                properties: {
                  fileName: { type: 'string', minLength: 1 },
                  mimeType: { type: 'string', minLength: 1 },
                  dataBase64: { type: 'string', minLength: 1 },
                },
                additionalProperties: false,
              },
            },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const secret = process.env.WEBHOOK_SECRET;
      if (secret) {
        const provided = request.headers['x-webhook-secret'];
        const providedValue = Array.isArray(provided) ? provided[0] : provided;
        if (providedValue !== secret) {
          return reply.status(401).send({ error: 'Unauthorized' });
        }
      }

      const body = request.body as {
        supplier: { name: string; email: string };
        subject: string;
        files: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
      };

      const supplierEmail = body.supplier.email.trim().toLowerCase();
      const supplierName = body.supplier.name.trim();
      const prNumber = parsePrNumberFromReceiptSubject(body.subject.trim());
      if (!prNumber) {
        return reply.status(400).send({
          message:
            'Could not extract PR number from subject. Expected: KARINGANI - POP for case <prNumber> or KARINGANI - Receipt for case <prNumber>',
        });
      }

      const caseRecord = await getCaseByPrNumber(prNumber);
      if (!caseRecord) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isHiddenCaseStatus(caseRecord.status)) {
        return reply.status(404).send({ message: `Case not found for PR number ${prNumber}` });
      }
      if (isClosedCaseStatus(caseRecord.status)) {
        await sendClosedCaseAutoReply(caseRecord, supplierEmail, body.subject.trim());
        return reply.status(409).send({
          message: `Case ${prNumber} is closed and cannot receive additional receipt files.`,
        });
      }

      let supplier = await getSupplierByEmail(supplierEmail);
      if (!supplier) {
        supplier = await createSupplier({
          name: supplierName,
          email: supplierEmail,
          categories: 'General',
          isActive: true,
          phonePrimary: null,
          phoneSecondary: null,
          location: null,
        });
      }

      await fs.mkdir(uploadDir, { recursive: true });
      const createdFiles = await Promise.all(
        body.files.map(async (file, index) => {
          const safeFilename = normalizeFilename(file.fileName, index + 1);
          const contentBuffer = decodeBase64Content(file.dataBase64);
          const storageKey = `${Date.now()}-receipt-${index + 1}-${safeFilename}`;
          const targetPath = path.join(uploadDir, storageKey);
          await fs.writeFile(targetPath, contentBuffer);

          return createFile({
            caseId: caseRecord.id,
            type: 'RECEIPT_ATTACHMENT',
            filename: safeFilename,
            mimeType: file.mimeType,
            size: contentBuffer.length,
            storageKey,
            uploadedBy: supplier.id,
          });
        }),
      );

      await createCaseEvent({
        caseId: caseRecord.id,
        actorUserId: null,
        type: 'RECEIPT_RECEIVED',
        detailJson: JSON.stringify({
          supplierId: supplier.id,
          supplierName: supplier.name,
          supplierEmail: supplier.email,
          subject: body.subject,
          files: createdFiles.map((file) => ({
            fileId: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            size: file.size,
          })),
        }),
      });

      const [admins, buyers] = await Promise.all([listUsersByRole('ADMIN'), listUsersByRole('BUYER')]);
      const recipientIds = new Set<string>();
      admins.forEach((user) => recipientIds.add(user.id));
      if (caseRecord.assignedBuyerId) {
        recipientIds.add(caseRecord.assignedBuyerId);
      } else {
        buyers.forEach((user) => recipientIds.add(user.id));
      }

      await Promise.all(
        [...recipientIds].map((userId) =>
          createNotification({
            userId,
            type: 'SUPPLIER_RECEIPT_RECEIVED',
            title: 'Supplier receipt received',
            body: `Received ${createdFiles.length} receipt file${createdFiles.length === 1 ? '' : 's'} from ${supplier.name.trim() || supplier.email}.`,
            caseId: caseRecord.id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      return reply.status(201).send({
        ok: true,
        caseId: caseRecord.id,
        prNumber,
        supplierId: supplier.id,
        attachedFileIds: createdFiles.map((file) => file.id),
      });
    },
  );

  app.get('/cases/:id', { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const record = await getCaseById(id);

    if (!record || isHiddenCaseStatus(record.status)) {
      return reply.status(404).send({ message: 'Not found' });
    }
    const user = request.user;
    if (user && user.role !== 'ADMIN' && record.assignedBuyerId !== user.id) {
      return reply.status(404).send({ message: 'Not found' });
    }

    const [quotes, items, checklist, files, outboundEmails, notifications, events, buyers, notes] =
      await Promise.all([
        listQuotesByCase(id),
        listCaseItems(id),
        listChecklistItems(id),
        listFilesByCase(id),
        listOutboundEmailsByCase(id),
        listNotificationsByCase(id),
        listCaseEvents(id),
        listUsersByRole('BUYER'),
        listNotesByCase(id),
      ]);
    const quotesWithSuppliers = await Promise.all(
      quotes.map(async (quote) => ({
        ...quote,
        supplier: await getSupplierById(quote.supplierId),
      })),
    );
    const buyerMap = new Map(buyers.map((buyer) => [buyer.id, buyer]));

    return {
      ...record,
      items,
      checklist,
      quotes: quotesWithSuppliers,
      files,
      outboundEmails,
      notifications,
      events,
      notes,
      assignedBuyer: record.assignedBuyerId
        ? buyerMap.get(record.assignedBuyerId) ?? null
        : null,
    };
  });

  app.patch(
    '/cases/:id',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const payload = request.body as any;
      const before = await getCaseById(id);
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, before);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      
      if (payload.status === 'READY_FOR_REVIEW') {
        const quotesCount = await countQuotesByCase(id);
        const caseRecord = before;
        const hasException = Boolean(caseRecord?.exceptionApprovedAt);
        if (!canMoveToReadyForReview({ quotesCount, hasException })) {
          return reply
            .status(400)
            .send({ message: 'At least 3 quotes required unless exception approved.' });
        }
      }

      if (before && payload.status === 'IN_REVIEW' && before.messageId) {
        const [quotes, files] = await Promise.all([listQuotesByCase(id), listFilesByCase(id)]);
        const buyer =
          (before.assignedBuyerId ? await findUserById(before.assignedBuyerId) : null) ??
          (request.user?.id ? await findUserById(request.user.id) : null);
        const buyerName = buyer?.name ?? 'Procurement Team';
        const filesById = new Map(files.map((file) => [file.id, file]));
        const quoteByFileId = new Map(
          quotes
            .filter((quote) => Boolean(quote.fileId))
            .map((quote) => [quote.fileId as string, quote]),
        );
        const quoteFileCandidates = new Map<
          string,
          {
            fileId: string;
            quoteId: string;
            filename: string;
            mimeType: string;
            storageKey: string;
          }
        >();

        // Include files explicitly linked to quotes (manual uploads and linked supplier files).
        quotes.forEach((quote) => {
          if (!quote.fileId) {
            return;
          }
          const file = filesById.get(quote.fileId);
          if (!file) {
            return;
          }
          quoteFileCandidates.set(file.id, {
            fileId: file.id,
            quoteId: quote.id,
            filename: file.filename,
            mimeType: file.mimeType,
            storageKey: file.storageKey,
          });
        });

        // Also include supplier uploads that exist as quote attachments but were not manually linked to a quote row.
        files
          .filter((file) => file.type === 'QUOTE_ATTACHMENT')
          .forEach((file) => {
            const linkedQuote = quoteByFileId.get(file.id);
            quoteFileCandidates.set(file.id, {
              fileId: file.id,
              quoteId: linkedQuote?.id ?? `file-${file.id}`,
              filename: file.filename,
              mimeType: file.mimeType,
              storageKey: file.storageKey,
            });
          });

        const quoteFiles = (
          await Promise.all(
            Array.from(quoteFileCandidates.values()).map(async (entry) => {
              try {
                const filePath = path.join(uploadDir, entry.storageKey);
                const contentBase64 = (await fs.readFile(filePath)).toString('base64');
                return {
                  quoteId: entry.quoteId,
                  fileId: entry.fileId,
                  filename: entry.filename,
                  mimeType: entry.mimeType,
                  contentBase64,
                };
              } catch (error) {
                app.log.warn(
                  {
                    event: 'send_review.quote_file_read_failed',
                    caseId: id,
                    quoteId: entry.quoteId,
                    fileId: entry.fileId,
                    storageKey: entry.storageKey,
                    error,
                  },
                  'Failed to read quote file for review webhook payload',
                );
                return null;
              }
            }),
          )
        ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

        const html = `<p>Your PR is ready for your review.<br/>Please see attached ${quoteFiles.length} quotations from different suppliers</p><p>Kind regards,<br/>${buyerName}</p>`.trim();

        try {
          const forwarded = await forwardEmailToWebhook({
            type: 'QUOTES_FOR_REVIEW',
            html,
            messageID: before.messageId,
            quoteFiles,
          });
          if (!forwarded.ok) {
            app.log.error(
              {
                event: 'send_review.webhook_forward_not_ok',
                caseId: id,
                messageId: before.messageId,
                webhookStatus: forwarded.status,
                webhookBody: forwarded.body,
              },
              'Webhook returned non-2xx for send-for-review payload',
            );
            return reply.status(502).send({
              message: 'Failed to forward send-for-review payload to webhook',
              webhookStatus: forwarded.status,
              webhookBody: forwarded.body,
            });
          }
        } catch (error) {
          app.log.error(
            {
              event: 'send_review.webhook_forward_failed',
              caseId: id,
              messageId: before.messageId,
              error,
            },
            'Failed to forward send-for-review payload to webhook',
          );
          return reply.status(502).send({
            message: 'Failed to forward send-for-review payload to webhook',
          });
        }
      }
      const updated = await updateCase(id, payload);
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      if (before && payload.status && payload.status !== before.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: before.status, to: payload.status }),
        });
      }
      return updated;
    },
  );

  app.delete(
    '/cases/:id',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const before = await getCaseById(id);

      if (!before || isHiddenCaseStatus(before.status)) {
        return reply.status(404).send({ message: 'Not found' });
      }

      const updated = await updateCase(id, { status: 'QUARANTINE' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'QUARANTINED',
        detailJson: JSON.stringify({ from: before.status, to: 'QUARANTINE' }),
      });

      return reply.status(204).send();
    },
  );

  app.post(
    '/cases/:id/assign',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const { buyerId } = body;
      let resolvedBuyerId = buyerId;

      if (!resolvedBuyerId) {
        const buyers = await listUsersByRole('BUYER');
        if (buyers.length < 2) {
          return reply.status(400).send({ message: 'Not enough buyers to assign.' });
        }
        const workloads = await Promise.all(
          buyers.map(async (buyer) => ({
            buyerId: buyer.id,
            count: (await listCases({
              assignedBuyerId: buyer.id,
            })).filter((record) => !['CLOSED', 'SENT', 'QUARANTINE'].includes(record.status)).length,
          })),
        );
        resolvedBuyerId = selectBuyerRoundRobin(workloads) ?? undefined;
      }

      const before = await getCaseById(id);
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, before);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      const shouldPreserveStatus = before
        ? [
          'WAITING_QUOTES',
          'READY_FOR_REVIEW',
          'IN_REVIEW',
          'REQUEST_INVOICE',
          'WAITING_INVOICE',
          'REQUEST_RECEIPT',
          'WAITING_RECEIPT',
          'CLOSED_PAID',
          'SENT',
          'CLOSED',
          ].includes(before.status)
        : false;
      const updated = await updateCase(id, {
        assignedBuyerId: resolvedBuyerId,
        status: shouldPreserveStatus ? before?.status : 'ASSIGNED',
      });

      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      if (resolvedBuyerId) {
        await createNotification({
          userId: resolvedBuyerId,
          type: 'ASSIGNMENT',
          title: 'New PR assigned',
          body: `${updated.prNumber} assigned to you`,
          caseId: id,
          severity: 'INFO',
          isRead: false,
        });
      }

      const isFirstAssignment = Boolean(before && !before.assignedBuyerId && resolvedBuyerId);
      if (isFirstAssignment && before?.messageId) {
        const assignedBuyer = await findUserById(resolvedBuyerId as string);
        const assignedBuyerName = assignedBuyer?.name ?? 'Procurement Team';
        const html = `<p>Hi ${before.requesterName},</p><br/><p>Your request has been received and we are now working to bring you quotes for the requested items. <br/>Case ID: ${updated.prNumber}</p><br/><p>Kind regards,<br/>${assignedBuyerName}</p>`;

        try {
          await forwardEmailToWebhook({
            type: 'PR_ASSIGNMENT_NOTIFICATION',
            html,
            messageID: before.messageId,
          });
        } catch (error) {
          app.log.error(
            { event: 'assignment.reply_email_failed', caseId: id, messageId: before.messageId, error },
            'Failed to send first assignment reply email',
          );
        }
      }

      if (before && before.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: before.status, to: updated.status }),
        });
      }
      if (resolvedBuyerId) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'ASSIGNMENT',
          detailJson: JSON.stringify({ assignedBuyerId: resolvedBuyerId }),
        });
      }

      return updated;
    },
  );

  app.post(
    '/cases/:id/request-quotes',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { supplierIds: string[]; messageTemplate?: string };
      const { supplierIds, messageTemplate } = body;
      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      const suppliers = (
        await Promise.all(supplierIds.map((supplierId) => getSupplierById(supplierId)))
      ).filter((supplier): supplier is NonNullable<typeof supplier> => Boolean(supplier));
      const emailBody = messageTemplate ?? 'Please provide your best quote.';
      const emailSubject = `KARINGANI - RFQ for case ${caseRecord.prNumber}`;
      const supplierEmails = Array.from(new Set(suppliers.map((supplier) => supplier.email)));

      try {
        const forwarded = await forwardEmailToWebhook({
          type: 'REQUEST_QUOTES',
          html: emailBody.trim(),
          messageID: caseRecord.messageId ?? caseRecord.id,
          suppliers: supplierEmails,
          subject: emailSubject,
        });
        if (!forwarded.ok) {
          app.log.error(
            {
              event: 'request_quotes.webhook_forward_not_ok',
              caseId: id,
              webhookStatus: forwarded.status,
              webhookBody: forwarded.body,
            },
            'Webhook returned non-2xx for request-quotes payload',
          );
          return reply.status(502).send({
            message: 'Failed to forward request-quotes payload to webhook',
            webhookStatus: forwarded.status,
            webhookBody: forwarded.body,
          });
        }
      } catch (error) {
        app.log.error(
          {
            event: 'request_quotes.webhook_forward_failed',
            caseId: id,
            error,
          },
          'Failed to forward request-quotes payload to webhook',
        );
        return reply.status(502).send({
          message: 'Failed to forward request-quotes payload to webhook',
        });
      }

      await createOutboundEmailLogs(
        suppliers.map((supplier) => ({
          caseId: id,
          type: 'RFQ',
          to: JSON.stringify([supplier.email]),
          cc: JSON.stringify([]),
          subject: emailSubject,
          body: emailBody,
          attachmentFileIds: JSON.stringify([]),
          createdBy: request.user?.id,
        })),
      );

      const updated = await updateCase(id, { status: 'WAITING_QUOTES' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      if (caseRecord.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
        });
      }
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'RFQ_SENT',
        detailJson: JSON.stringify({ supplierIds }),
      });

      return updated;
    },
  );

  app.post(
    '/cases/:id/request-invoice',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        poFileId?: string;
        supplierId?: string;
        supplierEmail?: string;
        messageTemplate?: string;
      };
      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      if (!body.poFileId) {
        return reply.status(400).send({ message: 'PO file is required before requesting invoice.' });
      }
      if (!body.supplierId) {
        return reply.status(400).send({ message: 'supplierId is required when requesting invoice.' });
      }

      const caseFiles = await listFilesByCase(id);
      const poFile = caseFiles.find((file) => file.id === body.poFileId);
      if (!poFile) {
        return reply.status(400).send({ message: 'PO file not found for this case.' });
      }

      const supplier = await getSupplierById(body.supplierId);
      if (!supplier?.email) {
        return reply.status(400).send({ message: 'Selected supplier not found.' });
      }
      const recipientEmails = [supplier.email.trim().toLowerCase()];

      const emailSubject = `KARINGANI - Invoice request for case ${caseRecord.prNumber}`;
      const emailBody =
        body.messageTemplate?.trim() ||
        `<p>Hello,</p><p>Please share your invoice for case ${caseRecord.prNumber}. Purchase order attached.</p><p>Kind regards,<br/>Karingani Procurement Team</p>`;
      let poFileAttachment:
        | {
            fileId: string;
            filename: string;
            mimeType: string;
            contentBase64: string;
          }
        | null = null;
      try {
        const poFilePath = path.join(uploadDir, poFile.storageKey);
        const poContentBase64 = (await fs.readFile(poFilePath)).toString('base64');
        poFileAttachment = {
          fileId: poFile.id,
          filename: poFile.filename,
          mimeType: poFile.mimeType,
          contentBase64: poContentBase64,
        };
      } catch (error) {
        app.log.error(
          {
            event: 'request_invoice.po_file_read_failed',
            caseId: id,
            poFileId: poFile.id,
            storageKey: poFile.storageKey,
            error,
          },
          'Failed to read PO file for request-invoice payload',
        );
        return reply.status(500).send({
          message: 'Failed to read PO file for invoice request payload',
        });
      }

      try {
        const forwarded = await forwardEmailToWebhook({
          type: 'REQUEST_INVOICE',
          html: emailBody,
          messageID: caseRecord.messageId ?? caseRecord.id,
          suppliers: recipientEmails,
          subject: emailSubject,
          poFiles: poFileAttachment ? [poFileAttachment] : [],
        });
        if (!forwarded.ok) {
          app.log.error(
            {
              event: 'request_invoice.webhook_forward_not_ok',
              caseId: id,
              webhookStatus: forwarded.status,
              webhookBody: forwarded.body,
            },
            'Webhook returned non-2xx for request-invoice payload',
          );
          return reply.status(502).send({
            message: 'Failed to forward request-invoice payload to webhook',
            webhookStatus: forwarded.status,
            webhookBody: forwarded.body,
          });
        }
      } catch (error) {
        app.log.error(
          {
            event: 'request_invoice.webhook_forward_failed',
            caseId: id,
            error,
          },
          'Failed to forward request-invoice payload to webhook',
        );
        return reply.status(502).send({
          message: 'Failed to forward request-invoice payload to webhook',
        });
      }

      await createOutboundEmailLog({
        caseId: id,
        type: 'REQUEST_INVOICE',
        to: JSON.stringify(recipientEmails),
        cc: JSON.stringify([]),
        subject: emailSubject,
        body: emailBody,
        attachmentFileIds: JSON.stringify([poFile.id]),
        createdBy: request.user?.id,
      });

      const updated = await updateCase(id, { status: 'WAITING_INVOICE' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      if (caseRecord.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
        });
      }
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'INVOICE_REQUESTED',
        detailJson: JSON.stringify({
          poFileId: poFile.id,
          recipientEmails,
          supplierId: supplier.id,
        }),
      });

      return updated;
    },
  );

  app.post(
    '/cases/:id/supplier-invoice/manual',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { fileId?: string; supplierId?: string };
      if (!body.fileId) {
        return reply.status(400).send({ message: 'fileId is required.' });
      }
      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      const caseFiles = await listFilesByCase(id);
      const invoiceFile = caseFiles.find((file) => file.id === body.fileId);
      if (!invoiceFile) {
        return reply.status(400).send({ message: 'Invoice file not found for this case.' });
      }

      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'INVOICE_RECEIVED',
        detailJson: JSON.stringify({
          source: 'MANUAL_UPLOAD',
          fileId: invoiceFile.id,
          supplierId: body.supplierId ?? null,
        }),
      });

      const [admins, buyers] = await Promise.all([listUsersByRole('ADMIN'), listUsersByRole('BUYER')]);
      const recipientIds = new Set<string>();
      admins.forEach((user) => recipientIds.add(user.id));
      if (caseRecord.assignedBuyerId) {
        recipientIds.add(caseRecord.assignedBuyerId);
      } else {
        buyers.forEach((user) => recipientIds.add(user.id));
      }

      await Promise.all(
        [...recipientIds].map((userId) =>
          createNotification({
            userId,
            type: 'SUPPLIER_INVOICE_RECEIVED',
            title: 'Supplier invoice received',
            body: `Invoice uploaded manually for ${caseRecord.prNumber}.`,
            caseId: id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      if (!['REQUEST_RECEIPT', 'WAITING_RECEIPT', 'SENT', 'CLOSED', 'CLOSED_PAID'].includes(caseRecord.status)) {
        const updated = await updateCase(id, { status: 'REQUEST_RECEIPT' });
        if (updated && updated.status !== caseRecord.status) {
          await createCaseEvent({
            caseId: id,
            actorUserId: request.user?.id,
            type: 'STATUS_CHANGE',
            detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
          });
        }
      }

      return reply.status(201).send({ ok: true, caseId: id, fileId: invoiceFile.id });
    },
  );

  app.post(
    '/cases/:id/send-pop',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as {
        message?: string;
        data?: Array<{ supplierId?: string; fileId?: string }>;
      };
      const entries = body.data ?? [];
      if (!Array.isArray(entries) || entries.length === 0) {
        return reply.status(400).send({ message: 'At least one POP entry is required.' });
      }

      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      if (!['REQUEST_RECEIPT', 'WAITING_RECEIPT'].includes(caseRecord.status)) {
        return reply.status(400).send({ message: 'Case is not ready to send POP.' });
      }

      const caseFiles = await listFilesByCase(id);
      const payloadData: Array<{
        supplier: { name: string; emailAddress: string };
        pop: { filename: string; mimeType: string; contentBase64: string };
      }> = [];

      for (const entry of entries) {
        if (!entry?.supplierId || !entry?.fileId) {
          return reply.status(400).send({ message: 'Each POP entry must include supplierId and fileId.' });
        }
        const supplier = await getSupplierById(entry.supplierId);
        if (!supplier) {
          return reply.status(400).send({ message: `Supplier not found for id ${entry.supplierId}.` });
        }
        const popFile = caseFiles.find((file) => file.id === entry.fileId && file.type === 'POP_ATTACHMENT');
        if (!popFile) {
          return reply.status(400).send({ message: `POP file not found for id ${entry.fileId}.` });
        }

        let contentBase64: string;
        try {
          const popFilePath = path.join(uploadDir, popFile.storageKey);
          contentBase64 = (await fs.readFile(popFilePath)).toString('base64');
        } catch (error) {
          app.log.error(
            {
              event: 'send_pop.file_read_failed',
              caseId: id,
              fileId: popFile.id,
              storageKey: popFile.storageKey,
              error,
            },
            'Failed to read POP file for webhook payload',
          );
          return reply.status(500).send({
            message: `Failed to read POP file ${popFile.filename}.`,
          });
        }

        payloadData.push({
          supplier: {
            name: supplier.name,
            emailAddress: supplier.email,
          },
          pop: {
            filename: popFile.filename,
            mimeType: popFile.mimeType,
            contentBase64,
          },
        });
      }

      const message =
        body.message?.trim() ||
        `Please find attached POP for case ${caseRecord.prNumber}. Kindly confirm receipt.`;
      const payload = {
        type: 'SEND_POP' as const,
        subject: `KARINGANI - POP for case ${caseRecord.prNumber}`,
        message,
        data: payloadData,
      };

      try {
        const forwarded = await forwardPopToWebhook(payload);
        if (!forwarded.ok) {
          app.log.error(
            {
              event: 'send_pop.webhook_forward_not_ok',
              caseId: id,
              webhookStatus: forwarded.status,
              webhookBody: forwarded.body,
            },
            'Webhook returned non-2xx for send-pop payload',
          );
          return reply.status(502).send({
            message: 'Failed to forward send-pop payload to webhook',
            webhookStatus: forwarded.status,
            webhookBody: forwarded.body,
          });
        }
      } catch (error) {
        app.log.error(
          {
            event: 'send_pop.webhook_forward_failed',
            caseId: id,
            error,
          },
          'Failed to forward send-pop payload to webhook',
        );
        return reply.status(502).send({
          message: 'Failed to forward send-pop payload to webhook',
        });
      }

      const updated = await updateCase(id, { status: 'WAITING_RECEIPT' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      if (caseRecord.status !== updated.status) {
        await createCaseEvent({
          caseId: id,
          actorUserId: request.user?.id,
          type: 'STATUS_CHANGE',
          detailJson: JSON.stringify({ from: caseRecord.status, to: updated.status }),
        });
      }
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'POP_SENT',
        detailJson: JSON.stringify({
          message,
          data: entries,
        }),
      });

      const supplierIds = [...new Set(entries.map((entry) => entry.supplierId).filter(Boolean))] as string[];
      const supplierEmails = (
        await Promise.all(supplierIds.map(async (supplierId) => getSupplierById(supplierId)))
      )
        .map((supplier) => supplier?.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email));
      const fileIds = entries.map((entry) => entry.fileId).filter((value): value is string => Boolean(value));
      await createOutboundEmailLog({
        caseId: id,
        type: 'SEND_POP',
        to: JSON.stringify([...new Set(supplierEmails)]),
        cc: JSON.stringify([]),
        subject: `KARINGANI - POP for case ${caseRecord.prNumber}`,
        body: message,
        attachmentFileIds: JSON.stringify(fileIds),
        createdBy: request.user?.id,
      });

      return reply.status(201).send({
        ok: true,
        status: updated.status,
      });
    },
  );

  app.post(
    '/cases/:id/supplier-receipt/upload',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: 'Receipt PDF file is required.' });
      }
      if (!isPdfUpload(data.filename, data.mimetype)) {
        data.file.resume();
        return reply.status(400).send({ message: 'Only PDF files are allowed.' });
      }

      const supplierIdRaw = (data.fields?.supplierId as { value?: unknown } | undefined)?.value;
      const supplierId =
        typeof supplierIdRaw === 'string' && supplierIdRaw.trim().length > 0
          ? supplierIdRaw.trim()
          : undefined;

      await fs.mkdir(uploadDir, { recursive: true });
      const safeFilename = normalizeFilename(data.filename, 1);
      const storageKey = `${Date.now()}-receipt-upload-${safeFilename}`;
      const targetPath = path.join(uploadDir, storageKey);
      await pipeline(data.file, fsSync.createWriteStream(targetPath));
      const stats = await fs.stat(targetPath);

      const receiptFile = await createFile({
        caseId: id,
        type: 'RECEIPT_ATTACHMENT',
        filename: safeFilename,
        mimeType: data.mimetype,
        size: stats.size,
        storageKey,
        uploadedBy: request.user?.id ?? 'system',
      });

      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'RECEIPT_RECEIVED',
        detailJson: JSON.stringify({
          source: 'DIRECT_UPLOAD',
          fileId: receiptFile.id,
          supplierId: supplierId ?? null,
        }),
      });

      const [admins, buyers] = await Promise.all([listUsersByRole('ADMIN'), listUsersByRole('BUYER')]);
      const recipientIds = new Set<string>();
      admins.forEach((user) => recipientIds.add(user.id));
      if (caseRecord.assignedBuyerId) {
        recipientIds.add(caseRecord.assignedBuyerId);
      } else {
        buyers.forEach((user) => recipientIds.add(user.id));
      }

      await Promise.all(
        [...recipientIds].map((userId) =>
          createNotification({
            userId,
            type: 'SUPPLIER_RECEIPT_RECEIVED',
            title: 'Supplier receipt received',
            body: `Receipt uploaded manually for ${caseRecord.prNumber}.`,
            caseId: id,
            severity: 'INFO',
            isRead: false,
          }),
        ),
      );

      return reply.status(201).send({
        ok: true,
        caseId: id,
        fileId: receiptFile.id,
      });
    },
  );

  app.post(
    '/cases/:id/notes',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { body?: string };
      const caseRecord = await getCaseById(id);
      if (!caseRecord) {
        return reply.status(404).send({ message: 'Not found' });
      }
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, caseRecord);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      if (!body.body || body.body.trim().length === 0) {
        return reply.status(400).send({ message: 'Note body is required.' });
      }
      const note = await createNote({
        caseId: id,
        authorUserId: request.user?.id,
        body: body.body.trim(),
      });
      return note;
    },
  );

  app.post(
    '/cases/:id/quotes',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const before = await getCaseById(id);
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, before);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      const quote = await createQuote({
        caseId: id,
        supplierId: body.supplierId,
        amount: body.amount,
        currency: body.currency,
        fileId: body.fileId,
        notes: body.notes,
      });
      if (before && !['CLOSED', 'SENT', 'REQUEST_INVOICE', 'WAITING_INVOICE', 'REQUEST_RECEIPT', 'WAITING_RECEIPT'].includes(before.status)) {
        const updated = await updateCase(id, { status: 'READY_FOR_REVIEW' });
        if (updated && before.status !== updated.status) {
          await createCaseEvent({
            caseId: id,
            actorUserId: request.user?.id,
            type: 'STATUS_CHANGE',
            detailJson: JSON.stringify({ from: before.status, to: updated.status }),
          });
        }
      }
      return quote;
    },
  );

  app.delete(
    '/cases/:id/quotes/:quoteId',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id, quoteId } = request.params as { id: string; quoteId: string };
      const before = await getCaseById(id);
      const closedMutationReply = await rejectClosedCaseMutation(request, reply, before);
      if (closedMutationReply) {
        return closedMutationReply;
      }
      await deleteQuote(id, quoteId);
      return reply.status(204).send();
    },
  );

  app.post(
    '/cases/:id/approve-exception',
    {
      preHandler: requireAdmin,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const updated = await updateCase(id, {
        exceptionApprovedAt: new Date(),
        exceptionApprovedById: request.user?.id,
        exceptionReason: body.reason,
      });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }
      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'EXCEPTION_APPROVED',
        detailJson: JSON.stringify({ reason: body.reason }),
      });
      return updated;
    },
  );

  app.post(
    '/cases/:id/send-final',
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = request.body as any;
      const caseRecord = await getCaseById(id);
      if (!caseRecord || caseRecord.status !== 'IN_REVIEW') {
        return reply.status(400).send({ message: 'Case not ready to send.' });
      }

      await createOutboundEmailLog({
        caseId: id,
        type: 'FINAL_RESPONSE',
        to: JSON.stringify([caseRecord.requesterEmail]),
        cc: JSON.stringify([]),
        subject: body.subject,
        body: body.body,
        attachmentFileIds: JSON.stringify(body.attachmentFileIds ?? []),
        createdBy: request.user?.id,
      });

      const updated = await updateCase(id, { status: 'SENT' });
      if (!updated) {
        return reply.status(404).send({ message: 'Not found' });
      }

      await createCaseEvent({
        caseId: id,
        actorUserId: request.user?.id,
        type: 'FINAL_SENT',
        detailJson: JSON.stringify({ subject: body.subject }),
      });

      if (updated.assignedBuyerId) {
        await createNotification({
          userId: updated.assignedBuyerId,
          type: 'FINAL_SENT',
          title: 'Final response sent',
          body: `${updated.prNumber} final response delivered`,
          caseId: id,
          severity: 'INFO',
          isRead: false,
        });
      }

      return updated;
    },
  );
}
