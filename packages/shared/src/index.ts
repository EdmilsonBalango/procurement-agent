import { z } from 'zod';

export const roles = ['ADMIN', 'BUYER'] as const;
export const userRoleSchema = z.enum(roles);

export const caseStatusValues = [
  'NEW',
  'MISSING_INFO',
  'ASSIGNED',
  'WAITING_QUOTES',
  'READY_FOR_REVIEW',
  'READY_TO_SEND',
  'SENT',
  'CLOSED',
] as const;

export const caseStatusSchema = z.enum(caseStatusValues);

export const checklistStatusSchema = z.enum(['OPEN', 'DONE', 'BLOCKED']);
export const checklistOwnerSchema = z.enum(['SYSTEM', 'BUYER', 'REQUESTER']);

export const notificationSeveritySchema = z.enum(['INFO', 'WARN', 'CRITICAL']);

export const casePrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const mfaVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export const createCaseSchema = z.object({
  prNumber: z.string().min(3),
  subject: z.string().min(3),
  requesterName: z.string().min(2),
  requesterEmail: z.string().email(),
  department: z.string().min(2),
  priority: casePrioritySchema,
  neededBy: z.string().datetime(),
  costCenter: z.string().min(2),
  deliveryLocation: z.string().min(2),
  budgetEstimate: z.number().nonnegative(),
});

export const updateCaseSchema = createCaseSchema.partial().extend({
  status: caseStatusSchema.optional(),
});

export const assignCaseSchema = z.object({
  buyerId: z.string().uuid().optional(),
});

export const requestQuotesSchema = z.object({
  supplierIds: z.array(z.string().uuid()).min(1),
  messageTemplate: z.string().optional(),
});

export const createQuoteSchema = z.object({
  supplierId: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
  fileId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const approveExceptionSchema = z.object({
  reason: z.string().min(4),
});

export const sendFinalSchema = z.object({
  subject: z.string().min(3),
  body: z.string().min(3),
  attachmentFileIds: z.array(z.string().uuid()).optional(),
});

export const supplierSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  categories: z.array(z.string()),
  isActive: z.boolean().default(true),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type AssignCaseInput = z.infer<typeof assignCaseSchema>;
export type RequestQuotesInput = z.infer<typeof requestQuotesSchema>;
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type ApproveExceptionInput = z.infer<typeof approveExceptionSchema>;
export type SendFinalInput = z.infer<typeof sendFinalSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
