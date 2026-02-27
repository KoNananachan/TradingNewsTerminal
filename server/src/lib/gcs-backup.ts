import { Storage } from '@google-cloud/storage';
import fs from 'fs';
import path from 'path';

const DB_FILENAME = 'prod.db';

function getDbPath(): string {
  return path.resolve(process.cwd(), 'prisma', DB_FILENAME);
}

export async function restoreDatabase(): Promise<void> {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) {
    console.log('[GCS] No GCS_BUCKET set, skipping restore');
    return;
  }

  try {
    const storage = new Storage();
    const file = storage.bucket(bucket).file(DB_FILENAME);

    const [exists] = await file.exists();
    if (!exists) {
      console.log('[GCS] No backup found in bucket, starting fresh');
      return;
    }

    const dbPath = getDbPath();
    console.log(`[GCS] Downloading database backup to ${dbPath}...`);
    await file.download({ destination: dbPath });
    console.log('[GCS] Database restored successfully');
  } catch (err) {
    console.error('[GCS] Restore failed (continuing with empty DB):', err);
  }
}

export async function backupDatabase(): Promise<void> {
  const bucket = process.env.GCS_BUCKET;
  if (!bucket) return;

  const dbPath = getDbPath();
  if (!fs.existsSync(dbPath)) return;

  try {
    const storage = new Storage();
    await storage.bucket(bucket).upload(dbPath, {
      destination: DB_FILENAME,
      metadata: { cacheControl: 'no-cache' },
    });
    console.log('[GCS] Database backup completed');
  } catch (err) {
    console.error('[GCS] Backup failed:', err);
  }
}
