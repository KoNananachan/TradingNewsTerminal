import { restoreDatabase } from '../lib/gcs-backup.js';

restoreDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[GCS] Restore script failed:', err);
    process.exit(0); // Don't block startup even if restore fails
  });
