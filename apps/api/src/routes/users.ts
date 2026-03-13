import bcrypt from 'bcryptjs';
import { FastifyInstance } from 'fastify';
import {
  countCasesReferencingUser,
  createOutboundEmailLog,
  createUser,
  deleteUserById,
  findUserById,
  listUsers,
  updateUser,
} from '../lib/db.js';
import { forwardEmailToWebhook } from '../lib/email-webhook.js';
import { requireAdmin, requireAuth } from '../lib/require-auth.js';

const isDuplicateEntryError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  error.code === 'ER_DUP_ENTRY';

const generateTemporaryPassword = () =>
  `Temp${Math.random().toString(36).slice(2, 8)}!${Math.random().toString(10).slice(2, 6)}`;

const credentialEmailSubject = 'Your Procurement Portal account password';

const buildCredentialEmailHtml = ({
  name,
  email,
  password,
  action,
}: {
  name: string;
  email: string;
  password: string;
  action: 'created' | 'reset';
}) => `<p>Hello ${name},</p><p>Your Procurement Portal account password has been ${action}.</p><p><strong>Email:</strong> ${email}<br/><strong>Temporary password:</strong> ${password}</p><p>Please sign in and change it as soon as possible.</p><p>Kind regards,<br/>Karingani Procurement Team</p>`;

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

  app.post('/users', { preHandler: requireAdmin }, async (request, reply) => {
    const body = (request.body ?? {}) as Partial<{
      name: string;
      email: string;
      role: 'ADMIN' | 'BUYER';
    }>;

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const role = body.role;

    if (!name || !email || !role) {
      return reply.status(400).send({ message: 'Name, email, and role are required.' });
    }

    if (!['ADMIN', 'BUYER'].includes(role)) {
      return reply.status(400).send({ message: 'Role must be ADMIN or BUYER.' });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return reply.status(400).send({ message: 'A valid email address is required.' });
    }

    const temporaryPassword = generateTemporaryPassword();

    try {
      const user = await createUser({
        name,
        email,
        role,
        password: temporaryPassword,
      });

      const html = buildCredentialEmailHtml({
        name: user.name,
        email: user.email,
        password: temporaryPassword,
        action: 'created',
      });

      try {
        const forwarded = await forwardEmailToWebhook({
          type: 'USER_CREDENTIALS',
          html,
          messageID: user.id,
          to: [user.email],
          subject: credentialEmailSubject,
        });

        if (!forwarded.ok) {
          await deleteUserById(user.id);
          return reply.status(502).send({
            message: 'Failed to send the credentials email. User was not created.',
            webhookStatus: forwarded.status,
            webhookBody: forwarded.body,
          });
        }
      } catch (error) {
        await deleteUserById(user.id);
        app.log.error({ event: 'users.create.email_failed', userId: user.id, error }, 'Failed to send credentials email');
        return reply.status(502).send({
          message: 'Failed to send the credentials email. User was not created.',
        });
      }

      await createOutboundEmailLog({
        caseId: null,
        type: 'USER_CREDENTIALS',
        to: JSON.stringify([user.email]),
        cc: JSON.stringify([]),
        subject: credentialEmailSubject,
        body: html,
        attachmentFileIds: JSON.stringify([]),
        createdBy: request.user?.id,
      });

      return reply.status(201).send({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      });
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        return reply.status(409).send({ message: 'A user with that email already exists.' });
      }
      throw error;
    }
  });

  app.post('/users/:id/reset-password', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await findUserById(id);
    if (!user) {
      return reply.status(404).send({ message: 'User not found.' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
    const previousPasswordHash = user.passwordHash;
    const updated = await updateUser(id, { passwordHash });

    if (!updated) {
      return reply.status(404).send({ message: 'User not found.' });
    }

    const html = buildCredentialEmailHtml({
      name: updated.name,
      email: updated.email,
      password: temporaryPassword,
      action: 'reset',
    });

    try {
      const forwarded = await forwardEmailToWebhook({
        type: 'USER_CREDENTIALS',
        html,
        messageID: updated.id,
        to: [updated.email],
        subject: credentialEmailSubject,
      });

      if (!forwarded.ok) {
        await updateUser(id, { passwordHash: previousPasswordHash });
        return reply.status(502).send({
          message: 'Failed to send the reset password email. Password was not changed.',
          webhookStatus: forwarded.status,
          webhookBody: forwarded.body,
        });
      }
    } catch (error) {
      await updateUser(id, { passwordHash: previousPasswordHash });
      app.log.error({ event: 'users.reset_password.email_failed', userId: updated.id, error }, 'Failed to send reset password email');
      return reply.status(502).send({
        message: 'Failed to send the reset password email. Password was not changed.',
      });
    }

    await createOutboundEmailLog({
      caseId: null,
      type: 'USER_CREDENTIALS',
      to: JSON.stringify([updated.email]),
      cc: JSON.stringify([]),
      subject: credentialEmailSubject,
      body: html,
      attachmentFileIds: JSON.stringify([]),
      createdBy: request.user?.id,
    });

    return reply.send({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      success: true,
    });
  });

  app.delete('/users/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = request.params as { id: string };

    if (request.user?.id === id) {
      return reply.status(400).send({ message: 'You cannot delete your own account.' });
    }

    const user = await findUserById(id);
    if (!user) {
      return reply.status(404).send({ message: 'User not found.' });
    }

    const referencedCases = await countCasesReferencingUser(id);
    if (referencedCases > 0) {
      return reply.status(409).send({
        message: 'This user is still referenced by procurement cases and cannot be deleted.',
      });
    }

    await deleteUserById(id);
    return reply.status(204).send();
  });
}
