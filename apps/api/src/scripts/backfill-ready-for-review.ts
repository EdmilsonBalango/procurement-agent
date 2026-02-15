import { pool } from '../lib/mysql.js';

type CaseRow = {
  id: string;
  status: string;
  quotes: number;
};

async function run() {
  const [rows] = await pool.execute(
    `select c.id, c.status, count(q.id) as quotes
     from cases c
     inner join quotes q on q.case_id = c.id
     where c.status in ('NEW', 'ASSIGNED', 'WAITING_QUOTES')
     group by c.id, c.status`,
  );

  const cases = rows as CaseRow[];
  const ids = cases.filter((row) => row.quotes > 0).map((row) => row.id);

  if (ids.length === 0) {
    await pool.end();
    console.log('No cases to update.');
    return;
  }

  const placeholders = ids.map(() => '?').join(',');
  await pool.execute(
    `update cases set status = 'READY_FOR_REVIEW', updated_at = now()
     where id in (${placeholders})`,
    ids,
  );

  await pool.end();
  console.log(`Updated ${ids.length} cases to READY_FOR_REVIEW.`);
}

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
