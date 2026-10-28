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

test('mechanic columns put work in progress first and keep the remaining jobs in booking order', () => {
  const context = vm.createContext({
    state: { today: '2026-10-28', jobs: [] },
    document: { addEventListener() {} }, window: { addEventListener() {} }
  });
  vm.runInContext(readFileSync(new URL('../public/dashboard.js', import.meta.url), 'utf8'), context);
  context.state.jobs = [
    { id: 'later', technician: 'James', status: 'booked', date: '2026-10-28', time: '14:00' },
    { id: 'early', technician: 'James', status: 'booked', date: '2026-10-28', time: '08:00' },
    { id: 'current', technician: 'James', status: 'in-progress', date: '2026-10-28', time: '10:00' },
    { id: 'other', technician: 'Sam', status: 'booked', date: '2026-10-28', time: '09:00' },
    { id: 'unassigned', technician: '', status: 'booked', date: '2026-10-28', time: '09:00' }
  ];
  assert.deepEqual(Array.from(vm.runInContext("mechanicJobs('James').map(j => j.id)", context)), ['current', 'early', 'later']);
  assert.deepEqual(Array.from(vm.runInContext("mechanicJobs('Unassigned').map(j => j.id)", context)), ['unassigned']);
});

