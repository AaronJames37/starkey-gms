import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { once } from 'node:events';

async function running(env, work) {
  const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening');
  const port = listener.address().port; await new Promise(r => listener.close(r));
  const child = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, DATABASE_URL: '', BETTER_AUTH_SECRET: '', STAFF_EMAILS: '', BETTER_AUTH_URL: '', REQUIRE_AUTH: 'true', PORT: String(port), ...env }, stdio: 'ignore' });
  const base = `http://127.0.0.1:${port}`;
  try {
    let started = false;
    for (let n = 0; n < 80; n++) { try { if ((await fetch(`${base}/api/health`)).ok) { started = true; break; } } catch {} await new Promise(r => setTimeout(r, 50)); }
    assert.equal(started, true);
    await work(base);
  } finally { const exited = once(child, 'exit'); child.kill(); await exited; }
}
test('hosted design preview serves synthetic records and rejects writes', async () => {
  await running({}, async base => {
    const access = await (await fetch(`${base}/api/access`)).json();
    assert.equal(access.readOnly, true);
    const state = await (await fetch(`${base}/api/state`)).json();
    assert.equal(state.customers.length, 5);
    assert.equal(state.settings.demo, true);
    const result = await fetch(`${base}/api/customer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Must not save' }) });
    assert.equal(result.status, 503);
    assert.equal((await (await fetch(`${base}/api/state`)).json()).customers.length, 5);
    assert.equal((await fetch(`${base}/api/auth/sign-in/email`, { method: 'POST' })).status, 503);
  });
});
test('connecting a database disables the preview bypass and fails closed before sign-in setup', async () => {
  await running({ DATABASE_URL: 'postgresql://invalid:invalid@127.0.0.1:1/not-used' }, async base => {
    const access = await (await fetch(`${base}/api/access`)).json();
    assert.equal(access.authenticated, false);
    assert.equal(access.configured, false);
    const response = await fetch(`${base}/api/state`);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).error, 'Hosted sign-in is not configured yet.');
  });
});

