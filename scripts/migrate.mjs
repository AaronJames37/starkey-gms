import { migrateAuth } from '../lib/auth.mjs';
import { closeStorage } from '../lib/storage.mjs';
try { await migrateAuth(); console.log('Staff sign-in database is ready.'); }
finally { await closeStorage(); }

