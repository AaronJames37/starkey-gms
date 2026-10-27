import readline from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createStaffAccount } from '../lib/auth.mjs';
import { closeStorage } from '../lib/storage.mjs';

let hidden = false;
const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk, encoding); callback(); } });
const input = readline.createInterface({ input: process.stdin, output, terminal: true });
try {
  const name = await input.question('Staff name: ');
  const email = await input.question('Email (must be listed in STAFF_EMAILS): ');
  process.stdout.write('Password (12+ characters, hidden): ');
  hidden = true;
  const password = await input.question('');
  hidden = false; process.stdout.write('\n');
  await createStaffAccount({ name, email, password });
  console.log('Staff account created. Password was not saved to a file.');
} catch (e) { console.error('Staff account could not be created. Check the email allowlist, password length and database setup.'); process.exitCode = 1; }
finally { input.close(); await closeStorage(); }

