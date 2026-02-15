import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../lib/mysql.js';

const uploadDir = path.resolve(process.cwd(), 'uploads', 'quotes');

type FileRow = {
  id: string;
  storage_key: string;
};

async function run() {
  const [rows] = await pool.execute(
    'select id, storage_key from files where size = 0',
  );
  const files = rows as FileRow[];

  for (const file of files) {
    try {
      const stats = await fs.stat(path.join(uploadDir, file.storage_key));
      await pool.execute('update files set size = ? where id = ?', [
        stats.size,
        file.id,
      ]);
    } catch {
      // ignore missing files
    }
  }

  await pool.end();
  console.log(`Backfilled sizes for ${files.length} file records.`);
}

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
