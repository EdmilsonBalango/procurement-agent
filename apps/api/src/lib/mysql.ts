import mysql from 'mysql2/promise';

const host = process.env.MYSQL_HOST ?? '192.168.88.4';
const port = Number(process.env.MYSQL_PORT ?? 3306);
const user = process.env.MYSQL_USER ?? 'root';
const password = process.env.MYSQL_PASSWORD ?? 'Karingani@1';
const database = process.env.MYSQL_DATABASE ?? 'procuremes-agent-test';
const connectionLimit = Number(process.env.MYSQL_CONNECTION_LIMIT ?? 10);

export const pool = mysql.createPool({
  host,
  port,
  user,
  password,
  database,
  connectionLimit,
  waitForConnections: true,
  dateStrings: false,
  decimalNumbers: true,
});

export async function query<T>(sql: string, params: unknown[] = []) {
  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

export async function execute(sql: string, params: unknown[] = []) {
  await pool.execute(sql, params);
}

export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}
