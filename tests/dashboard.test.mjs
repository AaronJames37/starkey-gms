import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('dashboard keeps unfinished work visible after its booking date', () => {
  const context = vm.createContext({
    state: { today: '2026-10-28', jobs: [] },
    document: { addEventListener() {} }, window: { addEventListener() {} }
  });
  vm.runInContext(readFileSync(new URL('../public/dashboard.js', import.meta.url), 'utf8'), context);
  const job = (id, status, date) => ({ id, status, date, time: '09:00' });
  context.state.jobs = [
    job('working-yesterday', 'in-progress', '2026-10-27'),
    job('ready-yesterday', 'ready', '2026-10-27'),
    job('booked-yesterday', 'booked', '2026-10-27'),
    job('booked-today', 'booked', '2026-10-28'),
    job('invoice-today', 'invoiced', '2026-10-28'),
    job('booked-tomorrow', 'booked', '2026-10-29'),
    job('invoice-yesterday', 'invoiced', '2026-10-27'),
    ...['estimate', 'cancelled', 'completed'].map(status => job(status, status, '2026-10-28'))
  ];
  assert.deepEqual(Array.from(vm.runInContext('dashboardJobs().map(j => j.id)', context)), [
    'working-yesterday', 'ready-yesterday', 'booked-yesterday', 'booked-today', 'invoice-today'
  ]);
});

