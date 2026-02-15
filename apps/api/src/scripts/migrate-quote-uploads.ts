import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../lib/mysql.js';

const oldDir = path.resolve(process.cwd(), 'uploads');
const newDir = path.resolve(process.cwd(), 'uploads', 'quotes');

type FileRow = {
  id: string;
  storage_key: string;
};

async function run() {
  await fs.mkdir(newDir, { recursive: true });

  const [rows] = await pool.execute(
    "select id, storage_key from files where storage_key not like 'quotes/%'",
  );
  const files = rows as FileRow[];

  for (const file of files) {
    const oldPath = path.join(oldDir, file.storage_key);
    const newStorageKey = `quotes/${file.storage_key}`;
    const newPath = path.join(oldDir, newStorageKey);

    try {
      await fs.rename(oldPath, newPath);
      await pool.execute('update files set storage_key = ? where id = ?', [
        newStorageKey,
        file.id,
      ]);
    } catch {
      // ignore missing files
    }
  }

  await pool.end();
  console.log(`Migrated ${files.length} files into quotes/ folder.`);
}

run().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
