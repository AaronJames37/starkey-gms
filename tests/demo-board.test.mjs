import test from 'node:test';
import assert from 'node:assert/strict';
import { expandDemoBoard } from '../lib/demo-board.mjs';

test('busy demo expansion adds five mechanics once and preserves existing work', () => {
  const original = { id: 'existing', title: 'User booking' };
  const s = { settings: { demo: true, technicians: ['James', 'Sam', 'Ben'], nextJob: 1049, labourRate: 6500 }, customers: [{ id: 'customer' }], vehicles: [], jobs: [original], invoices: [{ id: 'invoice' }] };
  expandDemoBoard(s, '2026-10-28');
  assert.equal(s.settings.technicians.length, 5);
  assert.equal(s.jobs.length, 17);
  assert.equal(s.jobs[0], original);
  assert.equal(new Set(s.jobs.map(j => j.id)).size, 17);
  assert.equal(new Set(s.jobs.map(j => j.number).filter(Boolean)).size, 16);
  assert.equal(s.invoices[0].id, 'invoice');
  expandDemoBoard(s, '2026-10-29');
  assert.equal(s.jobs.length, 17);
  const live = { settings: { demo: false } };
  expandDemoBoard(live, '2026-10-28');
  assert.deepEqual(live, { settings: { demo: false } });
});

