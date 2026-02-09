import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { execute, query, withTransaction } from './mysql.js';

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'BUYER';
  passwordHash: string;
  lastMfaAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Session = {
  id: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  ip?: string | null;
  userAgent?: string | null;
};

export type MfaChallenge = {
  id: string;
  userId: string;
  codeHash: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  consumedAt?: Date | null;
};

export type Supplier = {
  id: string;
  name: string;
  email: string;
  categories: string;
  isActive: boolean;
  createdAt: Date;
};

export type CaseRecord = {
  id: string;
  prNumber: string;
  subject: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  priority: string;
  neededBy: Date;
  costCenter: string;
  deliveryLocation: string;
  budgetEstimate: number;
  status: string;
  assignedBuyerId?: string | null;
  exceptionApprovedById?: string | null;
  exceptionApprovedAt?: Date | null;
  exceptionReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
  summaryForProcurement: string;
};

export type CaseItem = {
  id: string;
  caseId: string;
  description: string;
  qty: number;
  uom: string;
  specs: string;
};

export type ChecklistItem = {
  id: string;
  caseId: string;
  title: string;
  status: string;
  ownerRole: string;
};

export type Quote = {
  id: string;
  caseId: string;
  supplierId: string;
  amount: number;
  currency: string;
  receivedAt: Date;
  fileId?: string | null;
  notes?: string | null;
};

export type FileRecord = {
  id: string;
  caseId: string;
  type: string;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  uploadedBy: string;
  createdAt: Date;
};

export type OutboundEmailLog = {
  id: string;
  caseId?: string | null;
  type: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  attachmentFileIds: string;
  createdAt: Date;
  createdBy?: string | null;
};

export type Notification = {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  caseId?: string | null;
  severity: string;
  isRead: boolean;
  createdAt: Date;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  actorUserId?: string | null;
  type: string;
  detailJson: string;
  createdAt: Date;
};

const notificationEvents = new EventEmitter();

const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statuses = [
  'NEW',
  'ASSIGNED',
  'WAITING_QUOTES',
  'READY_FOR_REVIEW',
  'READY_TO_SEND',
  'SENT',
  'CLOSED',
  'MISSING_INFO',
];

const now = () => new Date();

const userSelect =
  'select id, name, email, role, password_hash as passwordHash, last_mfa_at as lastMfaAt, created_at as createdAt, updated_at as updatedAt from users';
const supplierSelect =
  'select id, name, email, categories, is_active as isActive, created_at as createdAt from suppliers';
const caseSelect =
  'select id, pr_number as prNumber, subject, requester_name as requesterName, requester_email as requesterEmail, department, priority, needed_by as neededBy, cost_center as costCenter, delivery_location as deliveryLocation, budget_estimate as budgetEstimate, status, assigned_buyer_id as assignedBuyerId, exception_approved_by_id as exceptionApprovedById, exception_approved_at as exceptionApprovedAt, exception_reason as exceptionReason, created_at as createdAt, updated_at as updatedAt, summary_for_procurement as summaryForProcurement from cases';
const caseItemSelect =
  'select id, case_id as caseId, description, qty, uom, specs from case_items';
const checklistSelect =
  'select id, case_id as caseId, title, status, owner_role as ownerRole from checklist_items';
const quoteSelect =
  'select id, case_id as caseId, supplier_id as supplierId, amount, currency, received_at as receivedAt, file_id as fileId, notes from quotes';
const fileSelect =
  'select id, case_id as caseId, type, filename, mime_type as mimeType, size, storage_key as storageKey, uploaded_by as uploadedBy, created_at as createdAt from files';
const outboundEmailSelect =
  'select id, case_id as caseId, type, `to`, cc, subject, body, attachment_file_ids as attachmentFileIds, created_at as createdAt, created_by as createdBy from outbound_email_logs';
const notificationSelect =
  'select id, user_id as userId, type, title, body, case_id as caseId, severity, is_read as isRead, created_at as createdAt from notifications';
const caseEventSelect =
  'select id, case_id as caseId, actor_user_id as actorUserId, type, detail_json as detailJson, created_at as createdAt from case_events';

export async function initDb() {
  await query('select 1');
  await ensureSeedData();
}

async function ensureSeedData() {
  const counts = await query<{ count: number }>('select count(*) as count from users');
  if ((counts[0]?.count ?? 0) > 0) {
    return;
  }

  const passwordHash = bcrypt.hashSync('Password123!', 10);
  const admin: User = {
    id: randomUUID(),
    name: 'Edmilson Balango',
    email: 'edmilsonbalango34@gmail.com',
    role: 'ADMIN',
    passwordHash,
    lastMfaAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  const buyer1: User = {
    id: randomUUID(),
    name: 'Buyer One',
    email: 'buyer1@local',
    role: 'BUYER',
    passwordHash,
    lastMfaAt: null,
    createdAt: now(),
    updatedAt: now(),
  };
  const buyer2: User = {
    id: randomUUID(),
    name: 'Buyer Two',
    email: 'buyer2@local',
    role: 'BUYER',
    passwordHash,
    lastMfaAt: null,
    createdAt: now(),
    updatedAt: now(),
  };

  await withTransaction(async (conn) => {
    await conn.execute(
      'insert into users (id, name, email, role, password_hash, last_mfa_at, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        admin.id,
        admin.name,
        admin.email,
        admin.role,
        admin.passwordHash,
        admin.lastMfaAt,
        admin.createdAt,
        admin.updatedAt,
        buyer1.id,
        buyer1.name,
        buyer1.email,
        buyer1.role,
        buyer1.passwordHash,
        buyer1.lastMfaAt,
        buyer1.createdAt,
        buyer1.updatedAt,
        buyer2.id,
        buyer2.name,
        buyer2.email,
        buyer2.role,
        buyer2.passwordHash,
        buyer2.lastMfaAt,
        buyer2.createdAt,
        buyer2.updatedAt,
      ],
    );

    for (let index = 0; index < 10; index += 1) {
      await conn.execute(
        'insert into suppliers (id, name, email, categories, is_active, created_at) values (?, ?, ?, ?, ?, ?)',
        [
          randomUUID(),
          `Supplier ${index + 1}`,
          `supplier${index + 1}@example.com`,
          JSON.stringify(['IT', 'Facilities', 'Marketing'].slice(0, (index % 3) + 1)),
          true,
          now(),
        ],
      );
    }

    const supplierRows = await conn.execute('select id from suppliers');
    const supplierIds = (supplierRows[0] as Array<{ id: string }>).map((row) => row.id);

    for (let i = 0; i < 10; i += 1) {
      const assignedBuyer = i % 2 === 0 ? buyer1 : buyer2;
      const caseId = randomUUID();
      const createdAt = now();
      const updatedAt = now();

      await conn.execute(
        'insert into cases (id, pr_number, subject, requester_name, requester_email, department, priority, needed_by, cost_center, delivery_location, budget_estimate, status, assigned_buyer_id, created_at, updated_at, summary_for_procurement) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          caseId,
          `PR-2024-${1000 + i}`,
          `Procurement request ${i + 1}`,
          `Requester ${i + 1}`,
          `requester${i + 1}@example.com`,
          'Operations',
          priorities[i % priorities.length]!,
          new Date(Date.now() + 1000 * 60 * 60 * 24 * (5 + i)),
          `CC-${200 + i}`,
          'HQ Warehouse',
          1000 + i * 250,
          statuses[i % statuses.length]!,
          assignedBuyer.id,
          createdAt,
          updatedAt,
          `This is a summary for procurement request ${i + 1}.`,
        ],
      );

      await conn.execute(
        'insert into case_items (id, case_id, description, qty, uom, specs) values (?, ?, ?, ?, ?, ?)',
        [randomUUID(), caseId, 'Laptop hardware', 2, 'units', '16GB RAM, 512GB SSD'],
      );

      await conn.execute(
        'insert into checklist_items (id, case_id, title, status, owner_role) values (?, ?, ?, ?, ?), (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          caseId,
          'Requester info verified',
          'DONE',
          'SYSTEM',
          randomUUID(),
          caseId,
          'Budget approval',
          'OPEN',
          'BUYER',
        ],
      );

      const quotesToCreate = i % 4;
      for (let q = 0; q < quotesToCreate; q += 1) {
        const supplierId = supplierIds[(i + q) % supplierIds.length];
        if (!supplierId) {
          continue;
        }
        await conn.execute(
          'insert into quotes (id, case_id, supplier_id, amount, currency, received_at, notes) values (?, ?, ?, ?, ?, ?, ?)',
          [randomUUID(), caseId, supplierId, 1200 + q * 150, 'USD', now(), 'Initial estimate'],
        );
      }
    }

    await conn.execute(
      'insert into notifications (id, user_id, type, title, body, severity, is_read, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        buyer1.id,
        'ASSIGNMENT',
        'New PR assigned',
        'PR-2024-1000 assigned to you',
        'INFO',
        false,
        now(),
      ],
    );

    const caseRows = await conn.execute('select id from cases order by created_at asc limit 1');
    const firstCaseId = (caseRows[0] as Array<{ id: string }>)[0]?.id ?? randomUUID();

    await conn.execute(
      'insert into case_events (id, case_id, actor_user_id, type, detail_json, created_at) values (?, ?, ?, ?, ?, ?)',
      [
        randomUUID(),
        firstCaseId,
        admin.id,
        'STATUS_CHANGE',
        JSON.stringify({ from: 'NEW', to: 'ASSIGNED' }),
        now(),
      ],
    );
  });
}

export async function findUserByEmail(email: string) {
  const rows = await query<User>(`${userSelect} where email = ? limit 1`, [email]);
  return rows[0] ?? null;
}

export async function findUserById(id: string) {
  const rows = await query<User>(`${userSelect} where id = ? limit 1`, [id]);
  return rows[0] ?? null;
}

export async function updateUser(id: string, data: Partial<User>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    params.push(data.email);
  }
  if (data.role !== undefined) {
    fields.push('role = ?');
    params.push(data.role);
  }
  if (data.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    params.push(data.passwordHash);
  }
  if (data.lastMfaAt !== undefined) {
    fields.push('last_mfa_at = ?');
    params.push(data.lastMfaAt);
  }

  if (fields.length === 0) {
    return findUserById(id);
  }

  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);
  await execute(`update users set ${fields.join(', ')} where id = ?`, params);
  return findUserById(id);
}

export async function createSession(data: {
  userId: string;
  ip?: string;
  userAgent?: string;
  expiresAt: Date;
}) {
  const session: Session = {
    id: randomUUID(),
    userId: data.userId,
    ip: data.ip ?? null,
    userAgent: data.userAgent ?? null,
    createdAt: now(),
    expiresAt: data.expiresAt,
  };
  await execute(
    'insert into sessions (id, user_id, created_at, expires_at, ip, user_agent) values (?, ?, ?, ?, ?, ?)',
    [
      session.id,
      session.userId,
      session.createdAt,
      session.expiresAt,
      session.ip,
      session.userAgent,
    ],
  );
  return session;
}

export async function findSessionById(id: string) {
  const rows = await query<Session>(
    'select id, user_id as userId, created_at as createdAt, expires_at as expiresAt, ip, user_agent as userAgent from sessions where id = ? limit 1',
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteSessionById(id: string) {
  await execute('delete from sessions where id = ?', [id]);
  return true;
}

export async function createMfaChallenge(data: { userId: string; codeHash: string; expiresAt: Date }) {
  const challenge: MfaChallenge = {
    id: randomUUID(),
    userId: data.userId,
    codeHash: data.codeHash,
    createdAt: now(),
    expiresAt: data.expiresAt,
    attempts: 0,
    consumedAt: null,
  };
  await execute(
    'insert into mfa_challenges (id, user_id, code_hash, created_at, expires_at, attempts, consumed_at) values (?, ?, ?, ?, ?, ?, ?)',
    [
      challenge.id,
      challenge.userId,
      challenge.codeHash,
      challenge.createdAt,
      challenge.expiresAt,
      challenge.attempts,
      challenge.consumedAt,
    ],
  );
  return challenge;
}

export async function findLatestValidMfaChallenge(userId: string) {
  const rows = await query<MfaChallenge>(
    'select id, user_id as userId, code_hash as codeHash, created_at as createdAt, expires_at as expiresAt, attempts, consumed_at as consumedAt from mfa_challenges where user_id = ? and consumed_at is null and expires_at > ? order by created_at desc limit 1',
    [userId, now()],
  );
  return rows[0] ?? null;
}

export async function updateMfaChallenge(id: string, data: Partial<MfaChallenge>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.codeHash !== undefined) {
    fields.push('code_hash = ?');
    params.push(data.codeHash);
  }
  if (data.expiresAt !== undefined) {
    fields.push('expires_at = ?');
    params.push(data.expiresAt);
  }
  if (data.attempts !== undefined) {
    fields.push('attempts = ?');
    params.push(data.attempts);
  }
  if (data.consumedAt !== undefined) {
    fields.push('consumed_at = ?');
    params.push(data.consumedAt);
  }
  if (fields.length === 0) {
    return null;
  }
  params.push(id);
  await execute(`update mfa_challenges set ${fields.join(', ')} where id = ?`, params);
  const rows = await query<MfaChallenge>(
    'select id, user_id as userId, code_hash as codeHash, created_at as createdAt, expires_at as expiresAt, attempts, consumed_at as consumedAt from mfa_challenges where id = ? limit 1',
    [id],
  );
  return rows[0] ?? null;
}

export async function createOutboundEmailLog(data: Omit<OutboundEmailLog, 'id' | 'createdAt'>) {
  const log: OutboundEmailLog = {
    id: randomUUID(),
    createdAt: now(),
    ...data,
  };
  await execute(
    'insert into outbound_email_logs (id, case_id, type, `to`, cc, subject, body, attachment_file_ids, created_at, created_by) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      log.id,
      log.caseId ?? null,
      log.type,
      log.to,
      log.cc,
      log.subject,
      log.body,
      log.attachmentFileIds,
      log.createdAt,
      log.createdBy ?? null,
    ],
  );
  return log;
}

export async function createOutboundEmailLogs(
  data: Array<Omit<OutboundEmailLog, 'id' | 'createdAt'>>,
) {
  const created: OutboundEmailLog[] = [];
  for (const entry of data) {
    created.push(await createOutboundEmailLog(entry));
  }
  return created;
}

export async function listSuppliers() {
  return query<Supplier>(`${supplierSelect} order by created_at desc`);
}

export async function createSupplier(data: Omit<Supplier, 'id' | 'createdAt'>) {
  const supplier: Supplier = {
    id: randomUUID(),
    createdAt: now(),
    ...data,
  };
  await execute(
    'insert into suppliers (id, name, email, categories, is_active, created_at) values (?, ?, ?, ?, ?, ?)',
    [
      supplier.id,
      supplier.name,
      supplier.email,
      supplier.categories,
      supplier.isActive,
      supplier.createdAt,
    ],
  );
  return supplier;
}

export async function updateSupplier(id: string, data: Partial<Supplier>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined) {
    fields.push('name = ?');
    params.push(data.name);
  }
  if (data.email !== undefined) {
    fields.push('email = ?');
    params.push(data.email);
  }
  if (data.categories !== undefined) {
    fields.push('categories = ?');
    params.push(data.categories);
  }
  if (data.isActive !== undefined) {
    fields.push('is_active = ?');
    params.push(data.isActive);
  }
  if (fields.length === 0) {
    return getSupplierById(id);
  }
  params.push(id);
  await execute(`update suppliers set ${fields.join(', ')} where id = ?`, params);
  return getSupplierById(id);
}

export async function listCases(filters: {
  status?: string;
  priority?: string;
  requesterEmail?: string;
  assignedBuyerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
}) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    clauses.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.requesterEmail) {
    clauses.push('requester_email like ?');
    params.push(`%${filters.requesterEmail}%`);
  }
  if (filters.assignedBuyerId) {
    clauses.push('assigned_buyer_id = ?');
    params.push(filters.assignedBuyerId);
  }
  if (filters.dateFrom) {
    clauses.push('created_at >= ?');
    params.push(filters.dateFrom);
  }
  if (filters.dateTo) {
    clauses.push('created_at <= ?');
    params.push(filters.dateTo);
  }
  if (filters.search) {
    clauses.push('(pr_number like ? or subject like ? or requester_name like ?)');
    const search = `%${filters.search}%`;
    params.push(search, search, search);
  }
  const where = clauses.length ? ` where ${clauses.join(' and ')}` : '';
  return query<CaseRecord>(`${caseSelect}${where} order by created_at desc`, params);
}

export async function getCaseById(id: string) {
  const rows = await query<CaseRecord>(`${caseSelect} where id = ? limit 1`, [id]);
  return rows[0] ?? null;
}

export async function createCase(data: Omit<CaseRecord, 'id' | 'createdAt' | 'updatedAt'>) {
  const record: CaseRecord = {
    id: randomUUID(),
    createdAt: now(),
    updatedAt: now(),
    ...data,
  };
  await execute(
    'insert into cases (id, pr_number, subject, requester_name, requester_email, department, priority, needed_by, cost_center, delivery_location, budget_estimate, status, assigned_buyer_id, exception_approved_by_id, exception_approved_at, exception_reason, created_at, updated_at, summary_for_procurement) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      record.id,
      record.prNumber,
      record.subject,
      record.requesterName,
      record.requesterEmail,
      record.department,
      record.priority,
      record.neededBy,
      record.costCenter,
      record.deliveryLocation,
      record.budgetEstimate,
      record.status,
      record.assignedBuyerId ?? null,
      record.exceptionApprovedById ?? null,
      record.exceptionApprovedAt ?? null,
      record.exceptionReason ?? null,
      record.createdAt,
      record.updatedAt,
      record.summaryForProcurement,
    ],
  );
  return record;
}

export async function getNextPrNumber(date: Date = now()) {
  const year = date.getFullYear();
  const prefix = `PR-${year}-`;
  const rows = await query<{ maxSeq: number | null }>(
    'select max(cast(substring(pr_number, ?) as unsigned)) as maxSeq from cases where pr_number like ?',
    [prefix.length + 1, `${prefix}%`],
  );
  const maxSequence = rows[0]?.maxSeq ?? 1000;
  return `${prefix}${maxSequence + 1}`;
}

export async function updateCase(id: string, data: Partial<CaseRecord>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.prNumber !== undefined) {
    fields.push('pr_number = ?');
    params.push(data.prNumber);
  }
  if (data.subject !== undefined) {
    fields.push('subject = ?');
    params.push(data.subject);
  }
  if (data.requesterName !== undefined) {
    fields.push('requester_name = ?');
    params.push(data.requesterName);
  }
  if (data.requesterEmail !== undefined) {
    fields.push('requester_email = ?');
    params.push(data.requesterEmail);
  }
  if (data.department !== undefined) {
    fields.push('department = ?');
    params.push(data.department);
  }
  if (data.priority !== undefined) {
    fields.push('priority = ?');
    params.push(data.priority);
  }
  if (data.neededBy !== undefined) {
    fields.push('needed_by = ?');
    params.push(data.neededBy);
  }
  if (data.costCenter !== undefined) {
    fields.push('cost_center = ?');
    params.push(data.costCenter);
  }
  if (data.deliveryLocation !== undefined) {
    fields.push('delivery_location = ?');
    params.push(data.deliveryLocation);
  }
  if (data.budgetEstimate !== undefined) {
    fields.push('budget_estimate = ?');
    params.push(data.budgetEstimate);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
  }
  if (data.assignedBuyerId !== undefined) {
    fields.push('assigned_buyer_id = ?');
    params.push(data.assignedBuyerId);
  }
  if (data.exceptionApprovedById !== undefined) {
    fields.push('exception_approved_by_id = ?');
    params.push(data.exceptionApprovedById);
  }
  if (data.exceptionApprovedAt !== undefined) {
    fields.push('exception_approved_at = ?');
    params.push(data.exceptionApprovedAt);
  }
  if (data.exceptionReason !== undefined) {
    fields.push('exception_reason = ?');
    params.push(data.exceptionReason);
  }
  if (data.summaryForProcurement !== undefined) {
    fields.push('summary_for_procurement = ?');
    params.push(data.summaryForProcurement);
  }
  if (fields.length === 0) {
    return getCaseById(id);
  }
  fields.push('updated_at = ?');
  params.push(now());
  params.push(id);
  await execute(`update cases set ${fields.join(', ')} where id = ?`, params);
  return getCaseById(id);
}

export async function countCases(filters?: { status?: string; statusNotIn?: string[] }) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (filters?.status) {
    clauses.push('status = ?');
    params.push(filters.status);
  }
  if (filters?.statusNotIn && filters.statusNotIn.length > 0) {
    clauses.push(`status not in (${filters.statusNotIn.map(() => '?').join(', ')})`);
    params.push(...filters.statusNotIn);
  }
  const where = clauses.length ? ` where ${clauses.join(' and ')}` : '';
  const rows = await query<{ count: number }>(`select count(*) as count from cases${where}`, params);
  return rows[0]?.count ?? 0;
}

export async function groupCasesByStatus() {
  return query<{ status: string; count: number }>(
    'select status, count(*) as count from cases group by status',
  );
}

export async function listCaseItems(caseId: string) {
  return query<CaseItem>(`${caseItemSelect} where case_id = ?`, [caseId]);
}

export async function createCaseItems(caseId: string, items: Array<Omit<CaseItem, 'id' | 'caseId'>>) {
  const created: CaseItem[] = [];
  for (const item of items) {
    const record: CaseItem = {
      id: randomUUID(),
      caseId,
      ...item,
    };
    await execute(
      'insert into case_items (id, case_id, description, qty, uom, specs) values (?, ?, ?, ?, ?, ?)',
      [record.id, record.caseId, record.description, record.qty, record.uom, record.specs],
    );
    created.push(record);
  }
  return created;
}

export async function listChecklistItems(caseId: string) {
  return query<ChecklistItem>(`${checklistSelect} where case_id = ?`, [caseId]);
}

export async function listQuotesByCase(caseId: string) {
  return query<Quote>(`${quoteSelect} where case_id = ?`, [caseId]);
}

export async function countQuotesByCase(caseId: string) {
  const rows = await query<{ count: number }>('select count(*) as count from quotes where case_id = ?', [
    caseId,
  ]);
  return rows[0]?.count ?? 0;
}

export async function createQuote(data: Omit<Quote, 'id' | 'receivedAt'>) {
  const quote: Quote = {
    id: randomUUID(),
    receivedAt: now(),
    ...data,
  };
  await execute(
    'insert into quotes (id, case_id, supplier_id, amount, currency, received_at, file_id, notes) values (?, ?, ?, ?, ?, ?, ?, ?)',
    [
      quote.id,
      quote.caseId,
      quote.supplierId,
      quote.amount,
      quote.currency,
      quote.receivedAt,
      quote.fileId ?? null,
      quote.notes ?? null,
    ],
  );
  return quote;
}

export async function listFilesByCase(caseId: string) {
  return query<FileRecord>(`${fileSelect} where case_id = ?`, [caseId]);
}

export async function createFile(data: Omit<FileRecord, 'id' | 'createdAt'>) {
  const file: FileRecord = {
    id: randomUUID(),
    createdAt: now(),
    ...data,
  };
  await execute(
    'insert into files (id, case_id, type, filename, mime_type, size, storage_key, uploaded_by, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      file.id,
      file.caseId,
      file.type,
      file.filename,
      file.mimeType,
      file.size,
      file.storageKey,
      file.uploadedBy,
      file.createdAt,
    ],
  );
  return file;
}

export async function listOutboundEmailsByCase(caseId: string) {
  return query<OutboundEmailLog>(`${outboundEmailSelect} where case_id = ?`, [caseId]);
}

export async function listNotificationsByUser(userId: string) {
  return query<Notification>(
    `${notificationSelect} where user_id = ? order by created_at desc`,
    [userId],
  );
}

export async function listNotificationsByCase(caseId: string) {
  return query<Notification>(`${notificationSelect} where case_id = ?`, [caseId]);
}

export async function updateNotification(id: string, data: Partial<Notification>) {
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.isRead !== undefined) {
    fields.push('is_read = ?');
    params.push(data.isRead);
  }
  if (data.title !== undefined) {
    fields.push('title = ?');
    params.push(data.title);
  }
  if (data.body !== undefined) {
    fields.push('body = ?');
    params.push(data.body);
  }
  if (data.severity !== undefined) {
    fields.push('severity = ?');
    params.push(data.severity);
  }
  if (fields.length === 0) {
    const rows = await query<Notification>(`${notificationSelect} where id = ? limit 1`, [id]);
    return rows[0] ?? null;
  }
  params.push(id);
  await execute(`update notifications set ${fields.join(', ')} where id = ?`, params);
  const rows = await query<Notification>(`${notificationSelect} where id = ? limit 1`, [id]);
  return rows[0] ?? null;
}

export async function createNotification(data: Omit<Notification, 'id' | 'createdAt'>) {
  const note: Notification = {
    id: randomUUID(),
    createdAt: now(),
    ...data,
  };
  await execute(
    'insert into notifications (id, user_id, type, title, body, case_id, severity, is_read, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      note.id,
      note.userId,
      note.type,
      note.title,
      note.body,
      note.caseId ?? null,
      note.severity,
      note.isRead,
      note.createdAt,
    ],
  );
  notificationEvents.emit('created', note);
  return note;
}

export function onNotificationCreated(listener: (notification: Notification) => void) {
  notificationEvents.on('created', listener);
  return () => {
    notificationEvents.off('created', listener);
  };
}

export async function listCaseEvents(caseId: string) {
  return query<CaseEvent>(`${caseEventSelect} where case_id = ?`, [caseId]);
}

export async function createCaseEvent(data: Omit<CaseEvent, 'id' | 'createdAt'>) {
  const event: CaseEvent = {
    id: randomUUID(),
    createdAt: now(),
    ...data,
  };
  await execute(
    'insert into case_events (id, case_id, actor_user_id, type, detail_json, created_at) values (?, ?, ?, ?, ?, ?)',
    [
      event.id,
      event.caseId,
      event.actorUserId ?? null,
      event.type,
      event.detailJson,
      event.createdAt,
    ],
  );
  return event;
}

export async function getSupplierById(id: string) {
  const rows = await query<Supplier>(`${supplierSelect} where id = ? limit 1`, [id]);
  return rows[0] ?? null;
}

export async function listUsersByRole(role: 'ADMIN' | 'BUYER') {
  return query<User>(`${userSelect} where role = ?`, [role]);
}

export async function listUsers() {
  return query<User>(userSelect);
}

export async function getLatestMfaLog() {
  const rows = await query<OutboundEmailLog>(
    `${outboundEmailSelect} where type = 'MFA_CODE' order by created_at desc limit 1`,
  );
  return rows[0] ?? null;
}
