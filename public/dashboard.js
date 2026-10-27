let dashboardPage = 0;
let dashboardView = 'jobs';
let dashboardStage = 'booked';

function ukPlate(registration, small = false) {
  const raw = String(registration || '').toUpperCase().replace(/\s/g, '');
  const display = /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4)}` : registration;
  return `<span class="uk-plate${small ? ' uk-plate-small' : ''}" aria-label="Registration ${esc(display)}"><span class="plate-country" aria-hidden="true">UK</span><span class="plate-letters">${esc(display)}</span></span>`;
}

function dashboardJobs() {
  return state.jobs.filter(j => j.date === state.today && !['estimate', 'cancelled', 'completed'].includes(j.status)).sort((a, b) => a.time.localeCompare(b.time));
}

function workshopDashboard() {
  const jobs = dashboardJobs();
  const stages = [
    { id: 'booked', title: 'Booked in', subtitle: 'On the diary', glyph: 'calendar', jobs: jobs.filter(j => j.status === 'booked') },
    { id: 'working', title: 'In the workshop', subtitle: 'Work underway', glyph: 'wrench', jobs: jobs.filter(j => j.status === 'in-progress') },
    { id: 'collection', title: 'Ready & invoiced', subtitle: 'Finishing up', glyph: 'check', jobs: jobs.filter(j => ['ready', 'invoiced'].includes(j.status)) }
  ];
  const pageSize = window.innerHeight < 860 ? 1 : 2;
  const pages = Math.max(1, ...stages.map(s => Math.ceil(s.jobs.length / pageSize)));
  dashboardPage = Math.min(dashboardPage, pages - 1);
  const assigned = jobs.filter(j => state.settings.technicians.includes(j.technician)).length;
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' }).format(new Date());
  return `<div class="workshop-dashboard" data-view="${dashboardView}" data-stage="${dashboardStage}">
    <header class="dash-heading"><div><div class="eyebrow">THE WORKSHOP, AT A GLANCE</div><h1>Today's workshop<span class="heading-stop">.</span></h1></div><div class="dash-heading-actions"><span class="dash-date">${icon('calendar')}${date}</span>${btn('new-job', 'Book a job', 'plus', true)}</div></header>
    <section class="dash-stats" aria-label="Today's workshop totals">
      ${dashStat('Jobs booked', jobs.length, 'On today’s diary', 'calendar', 'booked')}
      ${dashStat('In the workshop', stages[1].jobs.length, 'Jobs being worked on', 'wrench', 'working')}
      ${dashStat('Ready & invoiced', stages[2].jobs.length, 'Finished or awaiting payment', 'car', 'collection')}
      ${dashStat('Technicians assigned', new Set(jobs.map(j => j.technician).filter(t => state.settings.technicians.includes(t))).size, `${assigned} of ${jobs.length} jobs assigned`, 'users', 'technicians')}
    </section>
    <div class="dash-mobile-switch" aria-label="Dashboard view"><button class="${dashboardView === 'jobs' ? 'selected' : ''}" data-dash-view="jobs">${icon('jobs')}Job board</button><button class="${dashboardView === 'technicians' ? 'selected' : ''}" data-dash-view="technicians">${icon('users')}Technicians</button></div>
    <div class="dash-workspace">
      <section class="job-board" aria-labelledby="job-board-heading"><header class="dash-panel-heading"><div><h2 id="job-board-heading">Job board</h2><span>${jobs.length} vehicles · ${fmtDate(state.today)}</span></div><div class="dash-pager"><button class="icon-btn" data-dash-page="-1" aria-label="Previous jobs" ${dashboardPage === 0 ? 'disabled' : ''}>‹</button><span aria-live="polite">${dashboardPage + 1} / ${pages}</span><button class="icon-btn" data-dash-page="1" aria-label="Next jobs" ${dashboardPage + 1 >= pages ? 'disabled' : ''}>›</button></div></header>
        <div class="dash-stage-switch" aria-label="Job stage">${stages.map(s => `<button data-dash-stage="${s.id}" class="${dashboardStage === s.id ? 'selected' : ''}">${s.title}<b>${s.jobs.length}</b></button>`).join('')}</div>
        <div class="job-lanes">${stages.map(s => `<section class="job-lane lane-${s.id}" data-stage="${s.id}" aria-label="${s.title}"><header class="lane-heading"><div><span class="lane-dot"></span><h3>${s.title}</h3></div><span class="lane-count">${s.jobs.length}</span></header><div class="lane-jobs">${s.jobs.slice(dashboardPage * pageSize, (dashboardPage + 1) * pageSize).map(dashboardJobCard).join('') || `<div class="lane-empty">${icon(s.glyph)}<span>${s.jobs.length ? 'No more jobs on this page' : 'No jobs in this stage'}</span></div>`}</div></section>`).join('')}</div>
        <footer class="board-footer"><span>${state.settings.demo ? 'Sample workshop records' : 'Today’s scheduled jobs'}</span><a href="#jobs">All jobs & estimates ${icon('arrow')}</a></footer>
      </section>
      <section class="technician-board" aria-labelledby="technician-heading"><header class="dash-panel-heading"><div><h2 id="technician-heading">On the tools</h2><span>Who's working on what</span></div>${icon('users')}</header><div class="technician-roster">${state.settings.technicians.map((name, index) => {
        const assignedJobs = jobs.filter(j => j.technician === name);
        const current = assignedJobs.find(j => j.status === 'in-progress') || assignedJobs.find(j => j.status === 'booked') || assignedJobs[0];
        const hours = assignedJobs.reduce((n, j) => n + j.duration, 0) / 60;
        return `<button class="technician-assignment" data-dash-tech="${esc(name)}" aria-label="View ${esc(name)}'s ${assignedJobs.length} assigned jobs"><div class="tech-person"><span class="tech-avatar tech-${index % 3}">${esc(initials(name))}</span><div><strong>${esc(name)}</strong><span>${assignedJobs.length} ${assignedJobs.length === 1 ? 'job' : 'jobs'} assigned · ${hours.toFixed(1)} hrs</span></div><span class="tech-indicator ${current?.status === 'in-progress' ? 'is-working' : ''}"></span></div>${current ? `<div class="tech-current"><span class="tech-caption">${current.status === 'in-progress' ? 'WORKING ON' : current.status === 'booked' ? 'NEXT BOOKING' : 'FINISHING UP'}</span><div>${ukPlate(vehicle(current.vehicleId).registration, true)}<span class="tech-job-name">${esc(current.title)}</span></div></div>` : '<div class="tech-unassigned">No jobs assigned today</div>'}</button>`;
      }).join('')}</div><a class="team-diary-link" href="#diary">Open technician diary ${icon('arrow')}</a></section>
    </div>
  </div>`;
}

function dashStat(title, value, caption, glyph, stage) {
  return `<button class="dash-stat stat-${stage}" data-dash-stat="${stage}"><div class="dash-stat-icon">${icon(glyph)}</div><div class="dash-stat-copy"><span>${title}</span><strong class="numeric">${value}</strong><small>${caption}</small></div>${icon('arrow')}</button>`;
}

function dashboardJobCard(job) {
  const v = vehicle(job.vehicleId), c = customer(job.customerId);
  return `<button class="dashboard-job" data-job="${job.id}" aria-label="Open job ${job.number}, ${esc(v.registration)}, ${esc(job.title)}, assigned to ${esc(job.technician)}"><div class="job-ticket-top"><span>#${job.number}</span><time>${esc(job.time)}<span> · ${job.duration} min</span></time></div>${ukPlate(v.registration)}<div class="ticket-vehicle">${esc(v.make)} ${esc(v.model)}</div><strong class="ticket-title">${esc(job.title)}</strong><div class="ticket-customer">${esc(c.name)}</div><div class="ticket-assignment"><span class="ticket-avatar">${esc(initials(job.technician))}</span><span><small>ASSIGNED TO</small><b>${esc(job.technician || 'Unassigned')}</b></span><span class="ticket-open">${icon('arrow')}</span></div></button>`;
}

document.addEventListener('click', event => {
  const target = event.target.closest('[data-dash-page],[data-dash-view],[data-dash-stage],[data-dash-stat],[data-dash-tech]');
  if (!target) return;
  if (target.dataset.dashPage) dashboardPage += Number(target.dataset.dashPage);
  if (target.dataset.dashView) dashboardView = target.dataset.dashView;
  if (target.dataset.dashStage) { dashboardStage = target.dataset.dashStage; dashboardPage = 0; }
  if (target.dataset.dashStat) {
    if (window.innerWidth > 900) {
      const key = target.dataset.dashStat;
      const jobs = dashboardJobs().filter(j => key === 'booked' || key === 'technicians' || key === 'working' && j.status === 'in-progress' || key === 'collection' && ['ready', 'invoiced'].includes(j.status));
      const title = { booked: "Today's booked jobs", working: 'Jobs in the workshop', collection: 'Ready & invoiced jobs', technicians: 'Technician assignments' }[key];
      modal(title, 'TODAY’S WORKSHOP', `<div class="tech-job-detail">${jobs.map(dashboardJobCard).join('') || '<div class="empty">No jobs in this group.</div>'}</div>`);
      return;
    }
    if (target.dataset.dashStat === 'technicians') dashboardView = 'technicians';
    else { dashboardView = 'jobs'; dashboardStage = target.dataset.dashStat; dashboardPage = 0; }
  }
  if (target.dataset.dashTech) {
    const name = target.dataset.dashTech;
    const jobs = dashboardJobs().filter(j => j.technician === name);
    modal(`${name}'s assigned jobs`, 'TECHNICIAN WORKLOAD', `<div class="tech-job-detail">${jobs.map(dashboardJobCard).join('') || '<div class="empty">No jobs assigned today.</div>'}</div>`);
    return;
  }
  render();
});
let dashboardResize;
window.addEventListener('resize', () => { clearTimeout(dashboardResize); dashboardResize = setTimeout(() => { if (state && route === 'today' && !document.querySelector('#modal')?.open) render(); }, 150); });

