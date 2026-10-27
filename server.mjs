import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import * as storage from './lib/storage.mjs';
import { authStatus, authHandler, requireStaff } from './lib/auth.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date());
const dateOffset = (date, days) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
async function readState() {
  if (storage.designPreview) return { ...seed(), today: today() };
  const s = await storage.read(seed);
  s.today = today();
  return s;
}
function event(s, text) { s.activity.unshift({ id: id('evt'), text, at: new Date().toISOString() }); s.activity = s.activity.slice(0, 100); }
function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function text(value, name, max = 250, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) fail(`Enter a valid ${name}.`);
  return value.trim();
}
function integer(value, name, min = 0, max = 100000000) { if (!Number.isSafeInteger(value) || value < min || value > max) fail(`Enter a valid ${name}.`); return value; }
function date(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value) fail('Enter a valid date.'); return value; }
function get(s, type, key) { return s[type].find(r => r.id === key) || fail(`${type.slice(0, -1)} not found.`, 404); }
function lines(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) fail('Add between 1 and 100 estimate lines.');
  return value.map(l => {
    if (!['labour', 'part', 'other'].includes(l.type)) fail('Choose a valid line type.');
    if (typeof l.quantity !== 'number' || !Number.isFinite(l.quantity) || l.quantity <= 0 || l.quantity > 1000 || Math.abs(Math.round(l.quantity * 100) - l.quantity * 100) > 1e-8) fail('Use a positive quantity with at most two decimal places.');
    return { description: text(l.description, 'description'), type: l.type, quantity: l.quantity, unitPrice: integer(l.unitPrice, 'unit price'), unitCost: integer(l.unitCost ?? 0, 'unit cost'), vatRate: integer(l.vatRate ?? 20, 'VAT rate', 0, 20) };
  });
}
export function totals(items) {
  const net = items.reduce((n, l) => n + Math.round(l.quantity * l.unitPrice), 0);
  const vat = items.reduce((n, l) => n + Math.round(Math.round(l.quantity * l.unitPrice) * l.vatRate / 100), 0);
  const cost = items.reduce((n, l) => n + Math.round(l.quantity * l.unitCost), 0);
  return { net, vat, gross: net + vat, cost, margin: net - cost };
}
function seed() {
  const d = today();
  const s = {
    customers: [
      { id: 'cus_1', name: 'Olivia Bennett', email: 'olivia@example.test', phone: '07700 900101', type: 'Retail', postcode: 'DY9 8EL', notes: 'Please call when ready to collect.', communication: 'Email' },
      { id: 'cus_2', name: 'Daniel Hughes', email: 'daniel@example.test', phone: '07700 900102', type: 'Retail', postcode: 'DY8 1AA', notes: '', communication: 'SMS' },
      { id: 'cus_3', name: 'Oakfield Electrical', email: 'fleet@example.test', phone: '07700 900103', type: 'Account', postcode: 'DY5 3AB', notes: 'Purchase order required on invoices.', communication: 'Email' },
      { id: 'cus_4', name: 'Charlotte Evans', email: 'charlotte@example.test', phone: '07700 900104', type: 'Retail', postcode: 'DY9 7AA', notes: '', communication: 'Email' },
      { id: 'cus_5', name: 'William Parker', email: 'william@example.test', phone: '07700 900105', type: 'Retail', postcode: 'DY8 4AB', notes: '', communication: 'Email' }
    ],
    vehicles: [
      { id: 'veh_1', customerId: 'cus_1', registration: 'AB21 CDE', make: 'Volkswagen', model: 'Golf', colour: 'Grey', mileage: 38240, motDue: dateOffset(d, 25), fuel: 'Petrol' },
      { id: 'veh_2', customerId: 'cus_2', registration: 'CD19 FGH', make: 'Ford', model: 'Focus', colour: 'Blue', mileage: 61520, motDue: dateOffset(d, 8), fuel: 'Diesel' },
      { id: 'veh_3', customerId: 'cus_3', registration: 'EF22 JKL', make: 'Ford', model: 'Transit Custom', colour: 'White', mileage: 76430, motDue: dateOffset(d, 60), fuel: 'Diesel' },
      { id: 'veh_4', customerId: 'cus_4', registration: 'GH20 MNP', make: 'MINI', model: 'Cooper', colour: 'Black', mileage: 29600, motDue: dateOffset(d, 40), fuel: 'Petrol' },
      { id: 'veh_5', customerId: 'cus_5', registration: 'JK18 RST', make: 'BMW', model: '320d', colour: 'Silver', mileage: 84310, motDue: dateOffset(d, 18), fuel: 'Diesel' }
    ],
    jobs: [], products: [
      { id: 'prd_1', name: '5W-30 fully synthetic oil', sku: 'OIL-5W30', supplierId: 'sup_1', stock: 24, minimum: 10, cost: 495, price: 995, unit: 'litre' },
      { id: 'prd_2', name: 'Oil filter · OE quality', sku: 'FLT-001', supplierId: 'sup_1', stock: 3, minimum: 5, cost: 650, price: 1450, unit: 'each' },
      { id: 'prd_3', name: 'Brake cleaner · 500ml', sku: 'BRK-500', supplierId: 'sup_2', stock: 12, minimum: 6, cost: 225, price: 595, unit: 'each' },
      { id: 'prd_4', name: 'Screenwash concentrate', sku: 'SCR-001', supplierId: 'sup_2', stock: 2, minimum: 4, cost: 180, price: 495, unit: 'each' }
    ], suppliers: [{ id: 'sup_1', name: 'LKQ Euro Car Parts', reference: 'Demo account', connected: false }, { id: 'sup_2', name: 'GSF Car Parts', reference: 'Demo account', connected: false }, { id: 'sup_3', name: 'NAPA Auto Parts', reference: '', connected: false }, { id: 'sup_4', name: 'Dingbro', reference: '', connected: false }],
    reminders: [], invoices: [], activity: [], settings: { name: 'G & J Starkey', address: 'Unit 3 Old Forge Trading Estate, Dudley Road, Lye, Stourbridge, DY9 8EL', phone: '01384 894772', email: '', vatNumber: '', labourRate: 6500, technicians: ['James', 'Sam', 'Ben'], nextJob: 1048, nextInvoice: 1001, demo: true }
  };
  const labour = (description, quantity, price = 6500, vatRate = 20) => ({ description, quantity, unitPrice: price, unitCost: 2800, type: 'labour', vatRate });
  const part = (description, quantity, unitPrice, unitCost) => ({ description, quantity, unitPrice, unitCost, type: 'part', vatRate: 20 });
  const samples = [
    ['cus_1', 'veh_1', 'Full service & MOT', 'in-progress', 'James', '08:30', 120, [labour('Full service labour', 1.5), part('Service parts & fluids', 1, 8450, 4200), labour('MOT test', 1, 5485, 0)]],
    ['cus_2', 'veh_2', 'Front brakes', 'booked', 'Sam', '09:00', 90, [labour('Replace front brake pads & discs', 1.5), part('Front brake pads & discs', 1, 14500, 8900)]],
    ['cus_3', 'veh_3', 'Engine warning light', 'in-progress', 'Ben', '08:30', 90, [labour('Diagnostic investigation', 1)]],
    ['cus_4', 'veh_4', 'Air conditioning service', 'ready', 'James', '11:00', 60, [labour('Air conditioning service', 1, 7900)]],
    ['cus_5', 'veh_5', 'MOT test', 'booked', 'Sam', '11:00', 60, [labour('MOT test', 1, 5485, 0)]],
    ['cus_3', 'veh_3', 'Interim service', 'estimate', 'Ben', '14:00', 90, [labour('Interim service labour', 1), part('Filters & fluids', 1, 6500, 3200)]]
  ];
  samples.forEach((j, i) => s.jobs.push({ id: `job_${i + 1}`, number: 1042 + i, customerId: j[0], vehicleId: j[1], title: j[2], status: j[3], technician: j[4], time: j[5], duration: j[6], date: d, lines: j[7], notes: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 }));
  s.reminders = [{ id: 'rem_1', customerId: 'cus_2', vehicleId: 'veh_2', type: 'MOT', due: dateOffset(d, 8), status: 'pending', channel: 'SMS' }, { id: 'rem_2', customerId: 'cus_5', vehicleId: 'veh_5', type: 'MOT', due: dateOffset(d, 18), status: 'pending', channel: 'Email' }, { id: 'rem_3', customerId: 'cus_1', vehicleId: 'veh_1', type: 'Service', due: dateOffset(d, 25), status: 'pending', channel: 'Email' }];
  event(s, 'Your sample workshop is ready to explore.');
  if (process.env.SEED_DEMO === 'false') {
    for (const name of ['customers', 'vehicles', 'jobs', 'products', 'reminders', 'invoices', 'activity']) s[name] = [];
    s.settings.demo = false;
  }
  return s;
}

async function mutate(action, body) {
  if (storage.designPreview) fail('Connect Supabase and staff sign-in to save changes. This hosted design preview contains read-only sample records.', 503);
  return storage.transaction(seed, async s => {
    s.today = today();
    let result;
    if (action === 'customer') {
      const customer = { id: id('cus'), name: text(body.name, 'customer name'), email: text(body.email || '', 'email', 254, false), phone: text(body.phone || '', 'phone', 40, false), postcode: text(body.postcode || '', 'postcode', 16, false).toUpperCase(), type: body.type === 'Account' ? 'Account' : 'Retail', notes: text(body.notes || '', 'notes', 3000, false), communication: ['Email', 'SMS', 'Phone'].includes(body.communication) ? body.communication : 'Email' };
      if (customer.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) fail('Enter a valid email address.');
      s.customers.push(customer); event(s, `${customer.name} added to customers.`); result = customer;
    } else if (action === 'vehicle') {
      get(s, 'customers', body.customerId);
      const registration = text(body.registration, 'registration', 12).toUpperCase().replace(/\s/g, '');
      if (!/^[A-Z0-9]{2,10}$/.test(registration)) fail('Enter a valid registration.');
      if (s.vehicles.some(v => v.registration.replace(/\s/g, '') === registration)) fail('That registration is already in the workshop records.');
      const vehicle = { id: id('veh'), customerId: body.customerId, registration, make: text(body.make, 'make', 60), model: text(body.model, 'model', 80), colour: text(body.colour || '', 'colour', 40, false), mileage: integer(body.mileage || 0, 'mileage', 0, 9999999), motDue: body.motDue ? date(body.motDue) : '', fuel: text(body.fuel || 'Petrol', 'fuel', 30) };
      s.vehicles.push(vehicle); event(s, `${vehicle.registration} added to vehicle records.`); result = vehicle;
    } else if (action === 'job') {
      get(s, 'customers', body.customerId); const vehicle = get(s, 'vehicles', body.vehicleId);
      if (vehicle.customerId !== body.customerId) fail('Choose a vehicle belonging to this customer.');
      if (!['estimate', 'booked'].includes(body.status)) fail('Choose estimate or booking.');
      if (!s.settings.technicians.includes(body.technician)) fail('Choose a technician.');
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time || '')) fail('Enter a valid time.');
      const job = { id: id('job'), number: s.settings.nextJob++, customerId: body.customerId, vehicleId: body.vehicleId, title: text(body.title, 'job title', 150), status: body.status, technician: body.technician, time: body.time, date: date(body.date), duration: integer(body.duration, 'duration', 15, 540), notes: text(body.notes || '', 'notes', 5000, false), lines: lines(body.lines), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), revision: 1 };
      checkSlot(s, job); s.jobs.push(job); event(s, `${body.status === 'estimate' ? 'Estimate' : 'Job'} #${job.number} created.`); result = job;
    } else if (action === 'job-update') {
      const job = get(s, 'jobs', body.id);
      if (job.revision !== body.revision) fail('This job changed in another window. Reopen it before saving.', 409);
      if (['invoiced', 'completed', 'cancelled'].includes(job.status)) fail('This job is closed for editing.');
      if (body.lines) job.lines = lines(body.lines);
      if (body.notes !== undefined) job.notes = text(body.notes, 'notes', 5000, false);
      if (body.status !== undefined) {
        const allowed = { estimate: ['booked', 'cancelled'], booked: ['in-progress', 'cancelled'], 'in-progress': ['ready', 'booked'], ready: ['in-progress'] };
        if (!(allowed[job.status] || []).includes(body.status)) fail('That status change is not available.');
        job.status = body.status;
      }
      if (body.date !== undefined) job.date = date(body.date);
      if (body.time !== undefined) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time)) fail('Enter a valid time.'); job.time = body.time; }
      if (body.technician !== undefined) { if (!s.settings.technicians.includes(body.technician)) fail('Choose a technician.'); job.technician = body.technician; }
      checkSlot(s, job); job.revision++; job.updatedAt = new Date().toISOString(); event(s, `Job #${job.number} updated.`); result = job;
    } else if (action === 'invoice') {
      const job = get(s, 'jobs', body.jobId);
      if (job.status !== 'ready') fail('Mark the job ready before creating its invoice.');
      if (s.invoices.some(i => i.jobId === job.id)) fail('This job already has an invoice.');
      const customer = get(s, 'customers', job.customerId); const vehicle = get(s, 'vehicles', job.vehicleId);
      const invoice = { id: id('inv'), number: `GJS-${s.settings.nextInvoice++}`, jobId: job.id, customerId: job.customerId, date: today(), due: dateOffset(today(), customer.type === 'Account' ? 30 : 0), lines: structuredClone(job.lines), totals: totals(job.lines), payments: [], customer: structuredClone(customer), vehicle: structuredClone(vehicle), business: structuredClone(s.settings), title: job.title };
      s.invoices.push(invoice); job.status = 'invoiced'; job.revision++; event(s, `${invoice.number} created from job #${job.number}.`); result = invoice;
    } else if (action === 'payment') {
      const invoice = get(s, 'invoices', body.invoiceId);
      const balance = invoice.totals.gross - invoice.payments.reduce((n, p) => n + p.amount, 0);
      const amount = integer(body.amount, 'payment amount', 1);
      if (amount > balance) fail('Payment cannot exceed the outstanding balance.');
      if (!['Cash', 'Bank transfer', 'Card (external)'].includes(body.method)) fail('Choose a payment method.');
      invoice.payments.push({ id: id('pay'), amount, method: body.method, at: new Date().toISOString(), reference: text(body.reference || '', 'reference', 100, false) });
      if (amount === balance) { const job = get(s, 'jobs', invoice.jobId); job.status = 'completed'; job.revision++; }
      event(s, `Payment recorded against ${invoice.number}.`); result = invoice;
    } else if (action === 'product') {
      const sku = text(body.sku, 'SKU', 60).toUpperCase();
      if (s.products.some(p => p.sku === sku)) fail('This stock code already exists.');
      if (body.supplierId) get(s, 'suppliers', body.supplierId);
      const product = { id: id('prd'), name: text(body.name, 'product name'), sku, stock: integer(body.stock, 'stock', 0, 100000), minimum: integer(body.minimum, 'minimum stock', 0, 100000), price: integer(body.price, 'price'), cost: integer(body.cost, 'cost'), supplierId: body.supplierId || '', unit: text(body.unit || 'each', 'unit', 30) };
      s.products.push(product); event(s, `${product.name} added to stock.`); result = product;
    } else if (action === 'stock') {
      const product = get(s, 'products', body.id);
      const delta = integer(body.delta, 'quantity change', -100000, 100000);
      if (!delta || product.stock + delta < 0 || product.stock + delta > 100000) fail('Enter a stock change that leaves a valid quantity.');
      const reason = text(body.reason, 'stock adjustment reason', 250);
      product.stock += delta; event(s, `${product.sku}: ${delta > 0 ? '+' : ''}${delta} ${product.unit}. ${reason}`); result = product;
    } else if (action === 'reminder') {
      const vehicle = get(s, 'vehicles', body.vehicleId);
      if (!['MOT', 'Service', 'Custom'].includes(body.type)) fail('Choose a reminder type.');
      const reminder = { id: id('rem'), vehicleId: vehicle.id, customerId: vehicle.customerId, type: body.type, due: date(body.due), channel: body.channel === 'SMS' ? 'SMS' : 'Email', status: 'pending' };
      s.reminders.push(reminder); event(s, `${reminder.type} reminder scheduled.`); result = reminder;
    } else if (action === 'reminder-done') {
      const reminder = get(s, 'reminders', body.id); reminder.status = 'handled'; event(s, `${reminder.type} reminder marked handled manually.`); result = reminder;
    } else if (action === 'settings') {
      s.settings.name = text(body.name, 'business name', 120); s.settings.address = text(body.address, 'address', 500);
      s.settings.phone = text(body.phone || '', 'phone', 40, false); s.settings.email = text(body.email || '', 'email', 254, false);
      s.settings.vatNumber = text(body.vatNumber || '', 'VAT number', 40, false); s.settings.labourRate = integer(body.labourRate, 'labour rate', 0, 1000000);
      event(s, 'Business details updated.'); result = s.settings;
    } else fail('Unknown action.', 404);
    return result;
  });
}
function checkSlot(s, job) {
  if (['estimate', 'cancelled', 'completed', 'invoiced'].includes(job.status)) return;
  const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const start = minutes(job.time), end = start + job.duration;
  if (start < 480 || end > 1020) fail('Book work between 08:00 and 17:00.');
  if (s.jobs.some(j => j.id !== job.id && j.date === job.date && j.technician === job.technician && !['estimate', 'cancelled', 'completed', 'invoiced'].includes(j.status) && start < minutes(j.time) + j.duration && end > minutes(j.time))) fail('This technician already has work in that time slot.', 409);
}

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
function reply(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); }
export async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/api/health') return reply(res, 200, { ok: true, mode: storage.hosted ? 'hosted' : 'local-preview' });
    if (req.method === 'GET' && url.pathname === '/api/access') return reply(res, 200, await authStatus(req));
    if (url.pathname.startsWith('/api/auth/')) return await authHandler(req, res);
    if (url.pathname.startsWith('/api/')) await requireStaff(req);
    if (req.method === 'GET' && url.pathname === '/api/state') return reply(res, 200, await readState());
    if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
      const protocol = process.env.VERCEL ? 'https' : 'http';
      if (req.headers.origin && req.headers.origin !== `${protocol}://${req.headers.host}`) fail('This request came from another site.', 403);
      if (!req.headers['content-type']?.startsWith('application/json')) fail('Use a JSON request.', 415);
      let body;
      if (req.body !== undefined) {
        try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; } catch { fail('Invalid request body.'); }
        if (JSON.stringify(body).length > 1000000) fail('Request is too large.', 413);
      } else {
        let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 1000000) fail('Request is too large.', 413); }
        try { body = JSON.parse(raw); } catch { fail('Invalid request body.'); }
      }
      if (!body || typeof body !== 'object' || Array.isArray(body)) fail('Invalid request body.');
      return reply(res, 200, await mutate(url.pathname.slice(5), body));
    }
    if (url.pathname.startsWith('/api/')) return reply(res, 404, { error: 'Not found.' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Method not allowed.' });
    const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!['index.html', 'app.js', 'dashboard.js', 'styles.css', 'favicon.svg', 'logo-small.webp'].includes(file)) return reply(res, 404, { error: 'Not found.' });
    const path = join(root, 'public', file); if (!existsSync(path)) return reply(res, 404, { error: 'Not found.' });
    res.writeHead(200, { 'Content-Type': mime[extname(path)], 'Cache-Control': 'no-cache' }); res.end(req.method === 'HEAD' ? undefined : readFileSync(path));
  } catch (e) { if (!e.status) console.error(e); reply(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' }); }
}
const server = http.createServer(handler);
if (process.env.NODE_ENV !== 'test-import' && !process.env.VERCEL) {
  server.listen(Number(process.env.PORT || 3080), process.env.HOST || '127.0.0.1', () => console.log(`Starkey GMS is ready at http://localhost:${process.env.PORT || 3080}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(async () => { await storage.closeStorage(); process.exit(0); }));
}

