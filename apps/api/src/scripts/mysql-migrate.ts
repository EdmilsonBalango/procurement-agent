import mysql from 'mysql2/promise';
import { initDb } from '../lib/db.js';
import { pool } from '../lib/mysql.js';

const host = process.env.MYSQL_HOST ?? '127.0.0.1';
const port = Number(process.env.MYSQL_PORT ?? 3306);
const user = process.env.MYSQL_USER ?? 'root';
const password = process.env.MYSQL_PASSWORD ?? '';
const database = process.env.MYSQL_DATABASE ?? 'procuremes-agent-test';

const schemaStatements = [
  `create table if not exists users (
    id char(36) primary key,
    name varchar(255) not null,
    email varchar(255) not null,
    role varchar(20) not null,
    password_hash varchar(255) not null,
    last_mfa_at datetime null,
    created_at datetime not null,
    updated_at datetime not null,
    unique key uniq_users_email (email)
  )`,
  `create table if not exists sessions (
    id char(36) primary key,
    user_id char(36) not null,
    created_at datetime not null,
    expires_at datetime not null,
    ip varchar(64) null,
    user_agent varchar(512) null,
    index idx_sessions_user (user_id)
  )`,
  `create table if not exists mfa_challenges (
    id char(36) primary key,
    user_id char(36) not null,
    code_hash varchar(255) not null,
    created_at datetime not null,
    expires_at datetime not null,
    attempts int not null,
    consumed_at datetime null,
    index idx_mfa_user (user_id)
  )`,
  `create table if not exists suppliers (
    id char(36) primary key,
    name varchar(255) not null,
    email varchar(255) not null,
    categories text not null,
    is_active boolean not null,
    phone_primary varchar(64) null,
    phone_secondary varchar(64) null,
    location varchar(255) null,
    created_at datetime not null,
    index idx_suppliers_active (is_active)
  )`,
  `create table if not exists cases (
    id char(36) primary key,
    pr_number varchar(64) not null,
    subject varchar(255) not null,
    requester_name varchar(255) not null,
    requester_email varchar(255) not null,
    department varchar(255) not null,
    priority varchar(20) not null,
    needed_by datetime not null,
    cost_center varchar(64) not null,
    delivery_location varchar(255) not null,
    budget_estimate decimal(12,2) not null,
    status varchar(32) not null,
    assigned_buyer_id char(36) null,
    exception_approved_by_id char(36) null,
    exception_approved_at datetime null,
    exception_reason text null,
    created_at datetime not null,
    updated_at datetime not null,
    summary_for_procurement text not null,
    unique key uniq_cases_pr_number (pr_number),
    index idx_cases_status (status),
    index idx_cases_assigned (assigned_buyer_id)
  )`,
  `create table if not exists case_items (
    id char(36) primary key,
    case_id char(36) not null,
    description varchar(255) not null,
    qty int not null,
    uom varchar(64) not null,
    specs text not null,
    index idx_case_items_case (case_id)
  )`,
  `create table if not exists checklist_items (
    id char(36) primary key,
    case_id char(36) not null,
    title varchar(255) not null,
    status varchar(32) not null,
    owner_role varchar(32) not null,
    index idx_checklist_case (case_id)
  )`,
  `create table if not exists quotes (
    id char(36) primary key,
    case_id char(36) not null,
    supplier_id char(36) not null,
    amount decimal(12,2) not null,
    currency varchar(8) not null,
    received_at datetime not null,
    file_id char(36) null,
    notes text null,
    index idx_quotes_case (case_id),
    index idx_quotes_supplier (supplier_id)
  )`,
  `create table if not exists files (
    id char(36) primary key,
    case_id char(36) not null,
    type varchar(64) not null,
    filename varchar(255) not null,
    mime_type varchar(255) not null,
    size int not null,
    storage_key varchar(255) not null,
    uploaded_by varchar(64) not null,
    created_at datetime not null,
    index idx_files_case (case_id)
  )`,
  `create table if not exists outbound_email_logs (
    id char(36) primary key,
    case_id char(36) null,
    type varchar(64) not null,
    \`to\` text not null,
    cc text not null,
    subject varchar(255) not null,
    body text not null,
    attachment_file_ids text not null,
    created_at datetime not null,
    created_by char(36) null,
    index idx_email_case (case_id)
  )`,
  `create table if not exists notifications (
    id char(36) primary key,
    user_id char(36) not null,
    type varchar(64) not null,
    title varchar(255) not null,
    body text not null,
    case_id char(36) null,
    severity varchar(32) not null,
    is_read boolean not null,
    created_at datetime not null,
    index idx_notifications_user (user_id),
    index idx_notifications_case (case_id)
  )`,
  `create table if not exists case_events (
    id char(36) primary key,
    case_id char(36) not null,
    actor_user_id char(36) null,
    type varchar(64) not null,
    detail_json text not null,
    created_at datetime not null,
    index idx_case_events_case (case_id)
  )`,
  `create table if not exists notes (
    id char(36) primary key,
    case_id char(36) not null,
    author_user_id char(36) null,
    body text not null,
    created_at datetime not null,
    updated_at datetime not null,
    index idx_notes_case (case_id)
  )`,
];

async function run() {
  const serverConnection = await mysql.createConnection({
    host,
    port,
    user,
    password,
  });

  await serverConnection.execute(
    `create database if not exists \`${database}\``,
  );
  await serverConnection.end();

  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password,
    database,
  });

  for (const statement of schemaStatements) {
    await connection.execute(statement);
  }

  const [existingColumns] = await connection.execute(
    'select COLUMN_NAME from information_schema.columns where table_schema = ? and table_name = ?',
    [database, 'suppliers'],
  );
  const columnRows = existingColumns as Array<{ COLUMN_NAME: string }>;
  const columnSet = new Set(columnRows.map((row) => row.COLUMN_NAME));
  if (!columnSet.has('phone_primary')) {
    await connection.execute(
      'alter table suppliers add column phone_primary varchar(64) null',
    );
  }
  if (!columnSet.has('phone_secondary')) {
    await connection.execute(
      'alter table suppliers add column phone_secondary varchar(64) null',
    );
  }
  if (!columnSet.has('location')) {
    await connection.execute(
      'alter table suppliers add column location varchar(255) null',
    );
  }

  await connection.end();

  await initDb();
  await pool.end();
  console.log(`MySQL migration complete for ${database} at ${host}:${port}`);
}

run().catch((error) => {
  console.error('MySQL migration failed:', error);
  process.exit(1);
});
