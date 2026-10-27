import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';
import { once } from 'node:events';

const directory = mkdtempSync(join(tmpdir(), 'starkey-gms-test-'));
let child, base, port, logs = '';
async function boot() {
  child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.mjs'], { cwd: process.cwd(), env: { ...process.env, DATA_DIR: directory, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', d => { logs += d; }); child.stderr.on('data', d => { logs += d; });
  for (let n = 0; n < 80; n++) { try { if ((await fetch(`${base}/api/health`)).ok) return; } catch {} await new Promise(r => setTimeout(r, 50)); }
  throw new Error(`Server failed to start: ${logs}`);
}
async function stop() { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } }
before(async () => { const listener = net.createServer(); listener.listen(0, '127.0.0.1'); await once(listener, 'listening'); port = listener.address().port; await new Promise(r => listener.close(r)); base = `http://127.0.0.1:${port}`; await boot(); });
after(async () => { await stop(); rmSync(directory, { recursive: true, force: true }); });
async function state() { return (await fetch(`${base}/api/state`)).json(); }
async function post(action, data, expected = 200) { const r = await fetch(`${base}/api/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const body = await r.json(); assert.equal(r.status, expected, JSON.stringify(body)); return body; }

test('serves the app, sample records, and no public database file', async () => {
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await state()).customers.length, 5);
  assert.equal((await fetch(`${base}/data/workshop.sqlite`)).status, 404);
});

test('booking, estimate, VAT, invoice, payments, stock and persistence', async t => {
  const c = (await post('customer', { name: 'Workflow Test', email: 'workflow@example.test', phone: '07700 900999', type: 'Retail' })).result;
  const v = (await post('vehicle', { customerId: c.id, registration: 'QA26 TST', make: 'Test', model: 'Vehicle', mileage: 100 })).result;
  await t.test('rejects duplicate registrations after normalising spaces', async () => {
    await post('vehicle', { customerId: c.id, registration: 'QA26TST', make: 'Test', model: 'Vehicle' }, 400);
  });
  const sample = await state();
  const draft = { customerId: c.id, vehicleId: v.id, title: 'Workflow test service', status: 'estimate', technician: 'Ben', date: sample.today, time: '14:00', duration: 60, lines: [{ description: 'Labour', type: 'labour', quantity: 1.5, unitPrice: 6500, unitCost: 0, vatRate: 20 }, { description: 'MOT', type: 'labour', quantity: 1, unitPrice: 5485, unitCost: 0, vatRate: 0 }] };
  let job = (await post('job', draft)).result;
  await t.test('accepts decimal labour hours without floating-point validation errors', async () => {
    const result = await post('job', { ...draft, title: 'Fractional labour estimate', lines: [{ ...draft.lines[0], quantity: 1.1 }] });
    assert.equal(result.result.lines[0].quantity, 1.1);
  });
  await t.test('rejects invalid quantities without creating a record', async () => {
    const before = (await state()).jobs.length;
    await post('job', { ...draft, lines: [{ ...draft.lines[0], quantity: -1 }] }, 400);
    assert.equal((await state()).jobs.length, before);
  });
  await t.test('converts estimate to booking and rejects overlapping work', async () => {
    job = (await post('job-update', { id: job.id, revision: job.revision, status: 'booked' })).result;
    await post('job', { ...draft, status: 'booked', title: 'Overlapping job' }, 409);
  });
  await t.test('protects against overwriting a newer revision', async () => {
    await post('job-update', { id: job.id, revision: 1, notes: 'stale' }, 409);
    job = (await post('job-update', { id: job.id, revision: job.revision, status: 'in-progress' })).result;
    job = (await post('job-update', { id: job.id, revision: job.revision, status: 'ready' })).result;
  });
  const invoice = (await post('invoice', { jobId: job.id })).result;
  await t.test('correctly bills mixed VAT and locks finalised invoices', async () => {
    assert.equal(invoice.totals.net, 15235);
    assert.equal(invoice.totals.vat, 1950);
    assert.equal(invoice.totals.gross, 17185);
    await post('invoice', { jobId: job.id }, 400);
    await post('job-update', { id: job.id, revision: job.revision + 1, notes: 'cannot change invoice' }, 400);
  });
  await t.test('rejects overpayment and records part/final payments exactly', async () => {
    await post('payment', { invoiceId: invoice.id, amount: 17186, method: 'Cash' }, 400);
    let i = (await post('payment', { invoiceId: invoice.id, amount: 5000, method: 'Cash' })).result;
    assert.equal(i.payments.length, 1);
    i = (await post('payment', { invoiceId: invoice.id, amount: 12185, method: 'Bank transfer' })).result;
    assert.equal(i.payments.reduce((n, p) => n + p.amount, 0), i.totals.gross);
    assert.equal((await state()).jobs.find(j => j.id === job.id).status, 'completed');
  });
  await t.test('rejects negative inventory and logs a valid adjustment', async () => {
    const p = (await state()).products[0];
    await post('stock', { id: p.id, delta: -p.stock - 1, reason: 'Invalid' }, 400);
    const result = await post('stock', { id: p.id, delta: 2, reason: 'Test delivery' });
    assert.equal(result.result.stock, p.stock + 2);
    assert.match(result.state.activity[0].text, /Test delivery/);
  });
  await t.test('retains invoice business details when settings change', async () => {
    const settings = (await state()).settings;
    await post('settings', { ...settings, name: 'Changed test workshop' });
    assert.equal((await state()).invoices.find(i => i.id === invoice.id).business.name, 'G & J Starkey');
  });
  await t.test('retains records when the process restarts', async () => {
    await stop(); await boot();
    const s = await state();
    assert.equal(s.customers.find(r => r.id === c.id).name, 'Workflow Test');
    assert.equal(s.invoices.find(r => r.id === invoice.id).payments.length, 2);
  });
});

test('rejects invalid dates, cross-site requests and non-JSON mutations', async () => {
  const s = await state();
  await post('reminder', { vehicleId: s.vehicles[0].id, type: 'MOT', due: '2026-02-31', channel: 'Email' }, 400);
  const cross = await fetch(`${base}/api/customer`, { method: 'POST', headers: { Origin: 'https://example.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Cross site' }) });
  assert.equal(cross.status, 403);
  assert.equal((await fetch(`${base}/api/customer`, { method: 'POST', body: 'name=bad' })).status, 415);
});

