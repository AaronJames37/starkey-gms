// Expand sample workshops once; preserve all existing jobs, invoices and payments.
export function expandDemoBoard(s, day) {
  if (!s.settings.demo || s.settings.demoBoardVersion === 1) return;
  s.settings.technicians = [...new Set([...s.settings.technicians, 'Alex', 'Ryan'])];
  const bookings = [
    ['James', '12:30', 30, 'Battery replacement'],
    ['James', '14:30', 60, 'Rear brake pads'],
    ['James', '15:45', 45, 'Exhaust inspection'],
    ['Sam', '12:30', 60, 'Annual service'],
    ['Sam', '14:30', 60, 'Suspension knock'],
    ['Ben', '10:30', 60, 'Wheel bearing noise'],
    ['Ben', '12:00', 60, 'Cooling system check'],
    ['Ben', '15:30', 60, 'Oil & filter change'],
    ['Alex', '08:30', 90, 'Timing belt inspection'],
    ['Alex', '10:30', 60, 'MOT test'],
    ['Alex', '12:00', 60, 'Air conditioning service'],
    ['Alex', '14:30', 60, 'Brake fluid change'],
    ['Ryan', '08:30', 90, 'Clutch diagnostics'],
    ['Ryan', '10:30', 60, 'Interim service'],
    ['Ryan', '12:30', 60, 'Track rod ends'],
    ['Ryan', '14:00', 60, 'MOT & safety check']
  ];
  const models = [['Audi', 'A3'], ['Vauxhall', 'Corsa'], ['Toyota', 'Yaris'], ['Kia', 'Sportage'], ['Peugeot', '208'], ['Nissan', 'Qashqai'], ['SEAT', 'Leon'], ['Skoda', 'Octavia']];
  bookings.forEach(([technician, time, duration, title], index) => {
    const customer = s.customers[index % s.customers.length];
    if (!customer) return;
    const vehicleId = `veh_busy_demo_${index}`;
    const [make, model] = models[index % models.length];
    s.vehicles.push({ id: vehicleId, customerId: customer.id, registration: `GX${20 + index} DEM`, make, model, colour: 'Grey', mileage: 42500 + index * 1200, motDue: day, fuel: 'Petrol' });
    const now = new Date().toISOString();
    s.jobs.push({ id: `job_busy_demo_${index}`, number: s.settings.nextJob++, customerId: customer.id, vehicleId, title, technician, time, duration, date: day, status: ['Alex', 'Ryan'].includes(technician) && time === '08:30' ? 'in-progress' : 'booked', notes: 'Sample booking for the workshop design preview.', lines: [{ type: 'labour', description: title, quantity: duration / 60, unitPrice: s.settings.labourRate, unitCost: 2800, vatRate: 20 }], createdAt: now, updatedAt: now, revision: 1 });
  });
  s.settings.demoBoardVersion = 1;
}

