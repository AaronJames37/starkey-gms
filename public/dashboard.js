let dashboardMechanic = '';
const mechanicPages = {};

function ukPlate(registration, small = false) {
  const raw = String(registration || '').toUpperCase().replace(/\s/g, '');
  const display = /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4)}` : registration;
  return `<span class="uk-plate${small ? ' uk-plate-small' : ''}" aria-label="Registration ${esc(display)}"><span class="plate-country" aria-hidden="true">UK</span><span class="plate-letters">${esc(display)}</span></span>`;
}

function dashboardJobs() {
  // Keep unfinished work visible when it carries over from an earlier day.
  return state.jobs.filter(j => ['in-progress', 'ready'].includes(j.status) || j.status === 'booked' && j.date <= state.today || j.status === 'invoiced' && j.date === state.today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function mechanicJobs(name, jobs = dashboardJobs()) {
  return jobs.filter(j => (j.technician || 'Unassigned') === name)
    .sort((a, b) => Number(b.status === 'in-progress') - Number(a.status === 'in-progress') || a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

function workshopDashboard() {
  const jobs = dashboardJobs();
  const names = [...new Set([...state.settings.technicians, ...jobs.map(j => j.technician || 'Unassigned')])];
  if (!names.includes(dashboardMechanic)) dashboardMechanic = names[0] || '';
  const capacity = Math.max(1, Math.floor((window.innerHeight - (window.innerWidth <= 600 ? 300 : 255)) / 122));
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(new Date(`${state.today}T12:00:00Z`));
  return `<div class="workshop-dashboard mechanic-dashboard">
    <header class="mechanic-heading"><h1>Today's workshop<span class="heading-stop">.</span></h1><div class="mechanic-actions">${btn('new-job', 'Book a job', 'plus', true)}<span class="dash-date">${icon('calendar')}${date}</span><span class="mechanic-total">${jobs.length} jobs · Today & carried forward</span></div></header>
    <div class="mechanic-switch" aria-label="Choose mechanic">${names.map(name => `<button data-mechanic="${esc(name)}" class="${name === dashboardMechanic ? 'selected' : ''}" aria-pressed="${name === dashboardMechanic}">${esc(name)}<span>${mechanicJobs(name, jobs).length}</span></button>`).join('')}</div>
    <div class="mechanic-columns" style="--mechanic-count:${Math.max(1, names.length)}">${names.map((name, index) => {
      const assigned = mechanicJobs(name, jobs);
      const current = assigned.find(j => j.status === 'in-progress');
      const queue = assigned.filter(j => j !== current);
      const queueSize = Math.max(1, capacity - Number(Boolean(current)));
      const pages = Math.max(1, Math.ceil(queue.length / queueSize));
      const page = Math.max(0, Math.min(mechanicPages[name] || 0, pages - 1));
      mechanicPages[name] = page;
      return `<section class="mechanic-column ${name === dashboardMechanic ? 'is-selected' : ''}" aria-label="${esc(name)}'s jobs"><header class="mechanic-column-heading"><span class="tech-avatar tech-${index % 3}">${esc(initials(name))}</span><div><h2>${esc(name)}</h2><span>${assigned.length} ${assigned.length === 1 ? 'job' : 'jobs'} · ${(assigned.reduce((n, j) => n + j.duration, 0) / 60).toFixed(1)} hrs booked</span></div>${current ? '<span class="mechanic-working"><i></i>Working</span>' : ''}</header><div class="mechanic-job-list">${current ? dashboardJobCard(current, true) : ''}${queue.slice(page * queueSize, (page + 1) * queueSize).map(j => dashboardJobCard(j)).join('')}${!assigned.length ? '<div class="lane-empty">No jobs booked</div>' : ''}</div><footer class="mechanic-column-footer">${pages > 1 ? `<button class="icon-btn" data-mechanic-page="${index}" data-step="-1" aria-label="Previous jobs for ${esc(name)}" ${page === 0 ? 'disabled' : ''}>‹</button><span aria-live="polite">${page + 1} / ${pages}</span><button class="icon-btn" data-mechanic-page="${index}" data-step="1" aria-label="Next jobs for ${esc(name)}" ${page + 1 >= pages ? 'disabled' : ''}>›</button>` : `<span>${current ? 'Current job first · Then by booking time' : 'Jobs in booking time order'}</span>`}</footer></section>`;
    }).join('')}</div>
    <footer class="board-footer"><span>${state.settings.demo ? 'Sample workshop records' : 'Today’s bookings & unfinished work'}</span><a href="#diary">Workshop diary ${icon('arrow')}</a><a href="#jobs">All jobs & estimates ${icon('arrow')}</a></footer>
  </div>`;
}

function dashboardJobCard(job, current = false) {
  const v = vehicle(job.vehicleId);
  const status = current ? 'Working now' : { booked: 'Booked', 'in-progress': 'In progress', ready: 'Ready', invoiced: 'Invoiced' }[job.status] || label(job.status);
  return `<button class="dashboard-job mechanic-job${current ? ' current-job' : ''}" data-job="${job.id}" aria-label="Open job ${job.number}, ${esc(v.registration)}, ${esc(job.title)}, ${esc(status)}"><div class="compact-job-top">${ukPlate(v.registration, true)}<time>${esc(job.time)}<span> · ${job.duration} min</span></time></div><strong class="ticket-title">${esc(job.title)}</strong><div class="compact-job-bottom"><span class="compact-job-status ${job.status}">${current ? '<i></i>' : ''}${esc(status)}</span><span class="compact-job-reference">#${job.number}${job.date < state.today ? ` · ${fmtDate(job.date)}` : ''}</span></div></button>`;
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-mechanic],[data-mechanic-page]');
  if (!target) return;
  if (target.dataset.mechanic !== undefined) dashboardMechanic = target.dataset.mechanic;
  if (target.dataset.mechanicPage !== undefined) {
    const jobs = dashboardJobs();
    const names = [...new Set([...state.settings.technicians, ...jobs.map(j => j.technician || 'Unassigned')])];
    const name = names[Number(target.dataset.mechanicPage)];
    mechanicPages[name] = (mechanicPages[name] || 0) + Number(target.dataset.step);
  }
  render();
});
let dashboardResize;
window.addEventListener('resize', () => { clearTimeout(dashboardResize); dashboardResize = setTimeout(() => { if (state && route === 'today' && !document.querySelector('#modal')?.open) render(); }, 150); });

