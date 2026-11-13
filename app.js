'use strict';
const A3 = { me: null, on: {}, notifs: { unread: 0, items: [] }, timer: null, shellRole: null };
window.A3 = A3;
const root = () => $('#root');
ACT.p = (d, el, e) => A3.on[d.fn] && A3.on[d.fn](d, el, e);
const on = (name, fn) => { A3.on[name] = fn; };
const P = (fn, arg = '', extra = '') => `data-act="p" data-fn="${fn}" data-id="${esc(arg)}" ${extra}`;

const DEPT_ICONS = ['scan', 'pill', 'heart', 'news'];
const ROLE_LABEL = { admin: 'Administrator', teacher: 'Teacher', student: 'Student' };
const NAV = {
  admin: [['dashboard', 'Dashboard', 'dashboard'], ['students', 'Students', 'users'], ['teachers', 'Teachers', 'teacher'], ['courses', 'Departments & Courses', 'book'],
    ['attendance', 'Attendance', 'check'], ['announcements', 'Announcements', 'megaphone'], ['notes', 'Notes & Materials', 'file'], ['reports', 'Reports & Analytics', 'chart'],
    ['accounts', 'User Accounts', 'key'], ['profile', 'My Profile', 'user']],
  teacher: [['dashboard', 'Dashboard', 'dashboard'], ['courses', 'My Courses', 'book'], ['students', 'My Students', 'users'], ['attendance', 'Attendance', 'check'],
    ['notes', 'Notes & Materials', 'file'], ['announcements', 'Announcements', 'megaphone'], ['profile', 'My Profile', 'user']],
  student: [['dashboard', 'Dashboard', 'dashboard'], ['announcements', 'Announcements', 'megaphone'], ['attendance', 'My Attendance', 'check'],
    ['notes', 'Learning Notes', 'file'], ['profile', 'Profile & Course', 'user']],
};

/* ====================== ROUTER ====================== */
function route() {
  const [a, b] = location.hash.replace(/^#\/?/, '').split('/');
  if (a === 'login') return renderLogin(['admin', 'teacher', 'student'].includes(b) ? b : 'student');
  if (a === 'app') {
    if (!A3.me) { location.hash = '#/login'; return; }
    return renderShell(NAV[A3.me.role].some((n) => n[0] === b) ? b : 'dashboard');
  }
  A3.shellRole = null; stopPolling();
  renderLanding();
}
window.addEventListener('hashchange', route);
(async function init() {
  try { A3.me = await GET('/api/me'); } catch { A3.me = null; }
  route();
})();

/* ====================== LANDING ====================== */
function renderLanding() {
  const depts = [
    ['Radiology', 'Master medical imaging — X-ray, CT, MRI and ultrasound — with radiation safety at the core.'],
    ['Pharmacy', 'Pharmaceutics, pharmacology and clinical practice for tomorrow\'s trusted pharmacists.'],
    ['Nursing', 'Compassionate, evidence-based patient care with hands-on clinical placements.'],
    ['Journalism', 'Reporting, broadcasting and digital storytelling for the modern newsroom.'],
  ];
  const feats = [
    ['check', 'Smart Attendance', 'Mark Present, Absent or Late by date and subject with automatic percentages and PDF / Excel reports.'],
    ['file', 'Digital Library', 'Teachers share PDF, Word and PowerPoint notes organised by department, course, subject and semester.'],
    ['megaphone', 'Instant Announcements', 'College notices, exam alerts and class updates reach the right students immediately.'],
    ['shield', 'Secure by Design', 'Hashed passwords, role-based access and protected file storage keep every portal safe.'],
  ];
  const logged = A3.me;
  root().innerHTML = `
  <nav class="nav"><a class="brand" href="#/"><img src="/logo.svg" alt="A3 logo"><span>A3 College<small>MANAGEMENT SYSTEM</small></span></a>
    <div class="links"><a class="hide-m" href="#departments" data-act="scroll" data-to="departments">Departments</a><a class="hide-m" href="#features" data-act="scroll" data-to="features">Features</a>
    <a class="hide-m" href="#portals" data-act="scroll" data-to="portals">Portals</a>
    ${logged ? `<a class="btn primary sm" href="#/app/dashboard">${icon('dashboard')} Dashboard</a>` : `<a class="btn primary sm" href="#/login">${icon('lock')} Sign in</a>`}</div></nav>
  <header class="hero"><div><span class="pill">${icon('shield')} Radiology · Pharmacy · Nursing · Journalism</span>
    <h1>Where Future <span class="gradient-text">Professionals</span> Are Built.</h1>
    <p class="lead">A3 College brings students, teachers and administrators together on one fast, secure platform — attendance, notes, announcements and academics, all in one place.</p>
    <div class="cta"><a class="btn primary" href="#/login/student">${icon('user')} Student Portal</a><a class="btn" href="#/login/teacher">${icon('teacher')} Teacher Portal</a><a class="btn" href="#/login/admin">${icon('shield')} Admin</a></div></div>
    <div class="hero-logo"><img src="/logo.svg" alt="A3 College emblem"></div></header>
  <section class="section" style="padding-top:10px"><div class="counters glass"><div><b class="gradient-text">4</b><span>Departments</span></div><div><b class="gradient-text">3</b><span>Role-based portals</span></div><div><b class="gradient-text">24/7</b><span>Online access</span></div><div><b class="gradient-text">100%</b><span>Digital records</span></div></div></section>
  <section class="section" id="departments"><h2>Our <span class="gradient-text">Departments</span></h2><p class="sub">Four career-focused departments with qualified teachers, structured modules and practical training.</p>
    <div class="grid g4">${depts.map((d, i) => `<div class="glass dept"><div class="ico">${icon(DEPT_ICONS[i])}</div><h3>${d[0]} Department</h3><p>${d[1]}</p></div>`).join('')}</div></section>
  <section class="section" id="features"><h2>Everything the college <span class="gradient-text">needs</span></h2><p class="sub">Built for speed and simplicity on desktop, tablet and phone.</p>
    <div class="grid g4">${feats.map((f) => `<div class="glass dept"><div class="ico">${icon(f[0])}</div><h3>${f[1]}</h3><p>${f[2]}</p></div>`).join('')}</div></section>
  <section class="section portals" id="portals"><h2>Choose your <span class="gradient-text">portal</span></h2><p class="sub">Sign in with your registration number or staff ID.</p>
    <div class="grid g3">
      <a class="glass portal" href="#/login/student"><div class="ico">${icon('user')}</div><h3>Students</h3><p class="muted small">Announcements, attendance, notes and your course.</p></a>
      <a class="glass portal" href="#/login/teacher"><div class="ico">${icon('teacher')}</div><h3>Teachers</h3><p class="muted small">Attendance, notes, announcements and your classes.</p></a>
      <a class="glass portal" href="#/login/admin"><div class="ico">${icon('shield')}</div><h3>Administration</h3><p class="muted small">Full control over students, staff, courses and reports.</p></a></div></section>
  <footer class="footer"><img src="/logo.svg" width="34" alt="" style="vertical-align:middle;margin-right:8px">© ${new Date().getFullYear()} A3 College Management System · All rights reserved</footer>`;
  window.scrollTo(0, 0);
}
ACT.scroll = (d) => { const el = document.getElementById(d.to); if (el) el.scrollIntoView({ behavior: 'smooth' }); };

/* ====================== LOGIN ====================== */
function renderLogin(r) {
  const cfg = {
    student: ['Student Portal', 'Registration number', 'e.g. A3-NUR-2026-001', 'user'],
    teacher: ['Teacher Portal', 'Staff ID', 'e.g. T-NUR-001', 'teacher'],
    admin: ['Administrator', 'Username', 'Administrator username', 'shield'],
  };
  const [title, ulabel, ph] = cfg[r];
  root().innerHTML = `<div class="login-wrap"><div class="glass login">
    <a href="#/"><img class="logo" src="/logo.svg" alt="A3 logo"></a>
    <h2>A3 College</h2><p class="sub">${title} — sign in to continue</p>
    <div class="role-tabs">${Object.keys(cfg).map((k) => `<button type="button" class="${k === r ? 'on' : ''}" data-act="rolepick" data-r="${k}">${icon(cfg[k][3])}${ROLE_LABEL[k]}</button>`).join('')}</div>
    <div class="err-box hidden" id="lerr" role="alert"></div>
    <form id="lf" autocomplete="on" novalidate>
      <div class="field"><label for="lu">${ulabel}</label><input id="lu" name="username" placeholder="${ph}" autocomplete="username" autocapitalize="off" required></div>
      <div class="field" style="margin-top:14px"><label for="lp">Password</label><div class="pw"><input id="lp" name="password" type="password" placeholder="Enter your password" autocomplete="current-password" required>
        <button type="button" data-act="showpw" aria-label="Show password">${icon('eye')}</button></div></div>
      <button class="btn primary block" style="margin-top:22px" id="lbtn">${icon('lock')} Sign in</button></form>
    <p class="small muted" style="text-align:center;margin-top:18px">Forgot your password? Contact the college administrator.<br><a href="#/">← Back to home</a></p></div></div>`;
  $('#lu').focus();
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#lerr'); err.classList.add('hidden');
    const btn = $('#lbtn'); btn.disabled = true;
    try {
      await api('POST', '/api/login', { username: $('#lu').value, password: $('#lp').value, role: r });
      A3.me = await GET('/api/me');
      A3.first = true;
      location.hash = '#/app/dashboard';
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; }
  });
}
ACT.rolepick = (d) => { location.hash = '#/login/' + d.r; };
ACT.showpw = (d, el) => { const i = $('#lp'); i.type = i.type === 'password' ? 'text' : 'password'; };

/* ====================== SHELL ====================== */
function renderShell(page) {
  const me = A3.me;
  if (A3.shellRole !== me.role) {
    A3.shellRole = me.role;
    root().innerHTML = `<div class="shell" id="shell"><aside class="sidebar" id="sidebar">
      <a class="brand" href="#/"><img src="/logo.svg" alt="A3"><span>A3 College<small>MANAGEMENT SYSTEM</small></span></a>
      <div class="nav-label">${ROLE_LABEL[me.role]} menu</div>
      ${NAV[me.role].map(([k, l, i]) => `<a class="nav-item" data-page="${k}" href="#/app/${k}">${icon(i)}<span>${l}</span></a>`).join('')}
      <div class="spacer"></div>
      <div class="userbox"><div class="avatar">${esc(me.full_name.trim()[0] || '?').toUpperCase()}</div><div style="min-width:0"><div class="nm">${esc(me.full_name)}</div><div class="rl">${ROLE_LABEL[me.role]}</div></div></div>
      <button class="btn block" data-act="logout" style="margin-top:10px">${icon('logout')} Sign out</button></aside>
      <div class="scrim" data-act="menu"></div>
      <div class="main"><div class="topbar"><button class="btn icon menu-btn" data-act="menu" aria-label="Menu">${icon('menu')}</button><h1 id="ptitle"></h1>
        <div class="bell" id="bell"><button class="btn icon" data-act="bell" aria-label="Notifications">${icon('bell')}<span class="dot hidden" id="bdot">0</span></button><div class="dropdown hidden" id="ndrop"></div></div></div>
      <main class="view" id="view"></main></div></div>`;
    startPolling();
  }
  $('#shell').classList.remove('open');
  $$('.nav-item').forEach((n) => n.classList.toggle('on', n.dataset.page === page));
  const label = NAV[me.role].find((n) => n[0] === page)[1];
  $('#ptitle').textContent = label; document.title = `${label} · A3 College`;
  loadPage(page);
}
ACT.menu = () => $('#shell').classList.toggle('open');
ACT.logout = async () => { try { await POST('/api/logout'); } catch {} A3.me = null; A3.shellRole = null; stopPolling(); location.hash = '#/'; };

async function loadPage(page) {
  A3.on = {}; A3.page = page;
  const v = $('#view'); v.innerHTML = '<div class="spinner"></div>';
  window.scrollTo(0, 0);
  try {
    await PAGES[A3.me.role][page](v);
    if (A3.page !== page) return;
    $$('[data-count]', v).forEach(animateCount);
  } catch (e) {
    if (A3.page === page) v.innerHTML = `<div class="glass card"><div class="empty">${icon('alert')}<div>${esc(e.message)}</div></div></div>`;
  }
}
function animateCount(el) {
  const n = Number(el.dataset.count); if (!Number.isFinite(n) || n === 0) return;
  const t0 = performance.now();
  const tick = (t) => { const k = Math.min(1, (t - t0) / 700); el.textContent = Math.round(n * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
}
const pageHead = (title, sub, actions = '') => `<div class="page-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div><div class="toolbar" style="margin:0">${actions}</div></div>`;
const welcome = (sub) => `<div class="banner"><div><h2>Welcome back, <span class="gradient-text">${esc(A3.me.full_name.split(' ')[0] === 'System' ? 'Admin' : A3.me.full_name.split(' ').slice(-1)[0])}</span></h2><p>${sub}</p></div></div>`;

/* ---------- notifications ---------- */
function startPolling() { stopPolling(); pollNotifs(true); A3.timer = setInterval(() => pollNotifs(false), 30000); }
function stopPolling() { clearInterval(A3.timer); A3.timer = null; }
async function pollNotifs(initial) {
  if (!A3.me) return;
  try {
    const d = await GET('/api/notifications');
    const prev = A3.notifs.unread;
    A3.notifs = d;
    const dot = $('#bdot'); if (!dot) return;
    dot.textContent = d.unread > 99 ? '99+' : d.unread; dot.classList.toggle('hidden', !d.unread);
    if (initial && d.unread && A3.first) { toast(`You have ${d.unread} new notification${d.unread > 1 ? 's' : ''}: ${d.items.find((i) => !i.is_read)?.title || ''}`); A3.first = false; }
    else if (!initial && d.unread > prev) toast(d.items[0].title);
    if (!$('#ndrop').classList.contains('hidden')) drawNotifs();
  } catch {}
}
function drawNotifs() {
  const d = A3.notifs;
  $('#ndrop').innerHTML = `<div class="head"><span>Notifications</span><button class="btn sm" data-act="readall">Mark all read</button></div>
    ${d.items.length ? d.items.map((n) => `<a class="notif ${n.is_read ? '' : 'unread'}" href="#/app/${esc(n.link || 'announcements')}" data-act="readn" data-id="${n.id}"><b>${esc(n.title)}</b><span>${esc(n.body || '')}</span><div class="small muted">${ago(n.created_at)}</div></a>`).join('') : emptyBlock('No notifications yet')}`;
}
ACT.bell = (d, el, e) => { const dd = $('#ndrop'); dd.classList.toggle('hidden'); if (!dd.classList.contains('hidden')) drawNotifs(); e.stopPropagation(); };
ACT.readall = async () => { await POST('/api/notifications/read'); pollNotifs(false); };
ACT.readn = async (d, el) => { $('#ndrop').classList.add('hidden'); await POST('/api/notifications/read', { id: d.id }); location.hash = el.getAttribute('href'); pollNotifs(false); };
document.addEventListener('click', (e) => { const dd = $('#ndrop'); if (dd && !e.target.closest('#bell')) dd.classList.add('hidden'); });
// let normal link navigation continue for notification anchors
document.addEventListener('click', (e) => { if (e.target.closest('a[data-act=readn]')) e.preventDefault(); }, true);

/* ====================== SHARED DATA ====================== */
const ref = {};
async function refData(force) {
  if (!ref.depts || force) [ref.depts, ref.courses] = await Promise.all([GET('/api/departments'), GET('/api/courses')]);
  return ref;
}
const courseLabel = (c) => `${c.name} (${c.department_code})`;
const annBadge = (t) => badge(t === 'exam' ? 'exam' : t);

/* ====================== PAGES ====================== */
const PAGES = { admin: {}, teacher: {}, student: {} };

/* ---------- announcements list (shared) ---------- */
function annList(items, canDelete) {
  if (!items.length) return emptyBlock('No announcements yet');
  return `<div class="list">${items.map((a) => `<div class="item"><div class="top"><div><h4>${esc(a.title)}</h4></div><div>${annBadge(a.type)}</div></div>
    <p>${esc(a.body)}</p><div class="meta"><span>${icon('user')} ${esc(a.author || 'College')}</span><span>${icon('clock')} ${ago(a.created_at)}</span>
    <span>${icon('users')} ${a.scope === 'all' ? 'Everyone' : a.scope === 'department' ? esc(a.department) : esc(a.subject)}</span>
    ${canDelete(a) ? `<button class="btn danger sm" ${P('delann', a.id)}>${icon('trash')} Delete</button>` : ''}</div></div>`).join('')}</div>`;
}

/* ---------- ADMIN DASHBOARD ---------- */
PAGES.admin.dashboard = async (v) => {
  const d = await GET('/api/dashboard');
  const at = d.attendance_today;
  const max = Math.max(...d.by_department.map((x) => x.students), 1);
  v.innerHTML = `${welcome('Here is what is happening across A3 College today.')}
  <div class="grid g4 keep2" style="margin-bottom:18px">${statCard('users', d.students, 'Total students')}${statCard('teacher', d.teachers, 'Total teachers')}${statCard('book', d.courses, 'Total courses')}${statCard('file', d.notes, 'Learning notes')}</div>
  <div class="grid g-main" style="margin-bottom:18px">
    <div class="glass card"><h3>${icon('chart')} Attendance — last ${d.trend.length || 0} school days</h3>
      ${d.trend.length ? `<div class="bars">${d.trend.map((t) => `<div class="bar"><b>${t.percentage}%</b><i style="height:${Math.max(t.percentage, 4)}%"></i><span>${fmtDate(t.date).replace(/,? \d{4}/, '')}</span></div>`).join('')}</div>` : emptyBlock('No attendance recorded yet')}</div>
    <div class="glass card"><h3>${icon('check')} Daily attendance ${d.attendance_day ? `<span class="muted small">· ${fmtDate(d.attendance_day)}</span>` : ''}</h3>
      ${at && at.total ? `<div class="row-flex"><div class="donut" style="--p:${at.percentage}"><b>${at.percentage}%</b></div><div class="legend">
        <div><i style="background:var(--em2)"></i>Present: <b>${at.present}</b></div><div><i style="background:var(--warn)"></i>Late: <b>${at.late}</b></div><div><i style="background:var(--bad)"></i>Absent: <b>${at.absent}</b></div><div class="muted small">${at.total} records</div></div></div>` : emptyBlock('No attendance marked today')}</div></div>
  <div class="grid g2" style="margin-bottom:18px">
    <div class="glass card"><h3>${icon('megaphone')} Recent announcements</h3>${d.announcements.length ? `<div class="list">${d.announcements.map((a) => `<div class="item"><div class="top"><h4>${esc(a.title)}</h4>${annBadge(a.type)}</div><div class="meta"><span>${ago(a.created_at)}</span></div></div>`).join('')}</div>` : emptyBlock('None yet')}
      <div style="margin-top:14px"><a class="btn sm" href="#/app/announcements">View all</a></div></div>
    <div class="glass card"><h3>${icon('clock')} Recent activities</h3><div class="list">${d.activities.map((a) => `<div class="item"><div><b>${esc(a.full_name || 'System')}</b> <span class="muted">· ${esc(a.action)}</span></div><div class="small muted">${esc(a.detail || '')}</div><div class="small muted">${ago(a.created_at)}</div></div>`).join('')}</div></div></div>
  <div class="grid g2"><div class="glass card"><h3>${icon('building')} Students by department</h3>${d.by_department.map((x) => hbar(x.name, Math.round((x.students / max) * 100), x.students)).join('')}</div>
    <div class="glass card"><h3>${icon('layers')} Quick actions</h3><div class="grid g2">
      <a class="btn" href="#/app/students">${icon('plus')} Register student</a><a class="btn" href="#/app/teachers">${icon('plus')} Add teacher</a>
      <a class="btn" href="#/app/announcements">${icon('megaphone')} Publish notice</a><a class="btn" href="#/app/reports">${icon('chart')} View reports</a></div></div></div>`;
};

/* ---------- STUDENTS (admin full / teacher read-only) ---------- */
PAGES.admin.students = PAGES.teacher.students = async (v) => {
  const admin = A3.me.role === 'admin';
  await refData();
  const f = { q: '', department_id: '', course_id: '', semester: '' };
  v.innerHTML = pageHead(admin ? 'Student Registration' : 'My Students', admin ? 'Register, edit and manage every student.' : 'Students enrolled in the subjects you teach.',
    admin ? `<button class="btn primary" ${P('add')}>${icon('plus')} Register student</button>` : '') +
    `<div class="glass card"><div class="toolbar"><div class="search">${icon('search')}<input id="sq" placeholder="Search name or reg. number" aria-label="Search"></div>
    ${admin ? `<select id="sd" aria-label="Department">${opts(ref.depts, 'id', 'name', 'All departments').map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('')}</select>` : ''}
    <select id="sc" aria-label="Course">${opts(ref.courses, 'id', 'name', 'All courses').map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('')}</select>
    <select id="ss" aria-label="Semester"><option value="">All semesters</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">Semester ${n}</option>`).join('')}</select></div><div id="tb"></div></div>`;
  let rows = [];
  const draw = async () => {
    rows = await GET('/api/students?' + qs(f));
    const cols = [{ h: 'Reg. No', f: (r) => `<b>${esc(r.reg_no)}</b>`, cls: 'nowrap' }, { h: 'Name', f: (r) => esc(r.full_name) }, { h: 'Course', f: (r) => esc(r.course) },
      { h: 'Sem', f: (r) => r.semester }, { h: 'Contact', f: (r) => esc(r.phone || r.email || '—') }];
    if (admin) cols.push({ h: 'Status', f: (r) => badge(r.active ? 'active' : 'disabled', r.active ? 'ok' : 'off') },
      { h: '', cls: 'right', f: (r) => `<div class="actions"><button class="btn sm icon" title="Edit" ${P('edit', r.id)}>${icon('edit')}</button><button class="btn sm icon" title="Reset password" ${P('reset', r.user_id)}>${icon('key')}</button><button class="btn sm icon danger" title="Delete" ${P('del', r.id)}>${icon('trash')}</button></div>` });
    $('#tb').innerHTML = `<div class="muted small" style="margin-bottom:10px">${rows.length} student${rows.length === 1 ? '' : 's'}</div>` + table(cols, rows, 'No students found');
  };
  let tm; $('#sq').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { f.q = e.target.value; draw(); }, 250); };
  const sel = (id, k) => { const el = $(id); if (el) el.onchange = (e) => { f[k] = e.target.value; draw(); }; };
  sel('#sd', 'department_id'); sel('#sc', 'course_id'); sel('#ss', 'semester');
  await draw();
  const form = (s = {}) => [
    { name: 'full_name', label: 'Full name', value: s.full_name, required: true, full: true },
    { name: 'course_id', label: 'Course', type: 'select', required: true, value: s.course_id, options: opts(ref.courses, 'id', courseLabel) },
    { name: 'semester', label: 'Semester', type: 'number', min: 1, max: 12, value: s.semester || 1, required: true },
    { name: 'gender', label: 'Gender', type: 'select', value: s.gender || '', options: [['', 'Select'], ['male', 'Male'], ['female', 'Female']] },
    { name: 'dob', label: 'Date of birth', type: 'date', value: s.dob },
    { name: 'email', label: 'Email', type: 'email', value: s.email }, { name: 'phone', label: 'Phone', type: 'tel', value: s.phone },
    { name: 'guardian_name', label: 'Guardian name', value: s.guardian_name }, { name: 'guardian_phone', label: 'Guardian phone', type: 'tel', value: s.guardian_phone },
    { name: 'address', label: 'Address', value: s.address, full: true },
    ...(s.id ? [] : [{ name: 'password', label: 'Initial password', type: 'password', full: true, hint: 'Leave blank to generate one automatically.' }]),
  ];
  on('add', () => formModal({ title: 'Register new student', fields: form(), submit: 'Register', wide: true, onSubmit: async (fm, m) => {
    const r = await POST('/api/students', formValues(fm)); m.close(); credModal('Student registered', r.reg_no, r.password); draw();
  } }));
  on('edit', (d) => { const s = rows.find((x) => x.id == d.id);
    formModal({ title: 'Edit student', fields: form(s), wide: true, onSubmit: async (fm, m) => { await PUT('/api/students/' + s.id, formValues(fm)); m.close(); toast('Student updated'); draw(); } }); });
  on('del', async (d) => { const s = rows.find((x) => x.id == d.id); if (await confirmBox(`Delete ${s.full_name}? Their attendance records and account will also be removed.`)) { await DEL('/api/students/' + s.id); toast('Student deleted'); draw(); } });
  on('reset', (d) => resetPw(d.id));
};
function credModal(title, user, pw) {
  const m = modal(`<h3>${icon('ok')} ${esc(title)}</h3><p class="muted">Share these login details with the user. The password is shown only once.</p>
    <div class="cred">Username: <b>${esc(user)}</b><br>Password: <b>${esc(pw)}</b></div><div class="foot"><button class="btn" id="cp">Copy</button><button class="btn primary" data-close>Done</button></div>`);
  $('#cp', m.el).onclick = () => { navigator.clipboard?.writeText(`Username: ${user}\nPassword: ${pw}`); toast('Copied to clipboard'); };
}
function resetPw(userId, after) {
  formModal({ title: 'Reset password', submit: 'Reset password', fields: [{ name: 'password', label: 'New password', type: 'password', full: true, hint: 'Leave blank to generate a random password.' }],
    onSubmit: async (fm, m) => { const r = await POST(`/api/accounts/${userId}/password`, formValues(fm)); m.close(); credModal('Password reset', 'New password set', r.password); if (after) after(); } });
}

/* ---------- TEACHERS ---------- */
PAGES.admin.teachers = async (v) => {
  await refData();
  v.innerHTML = pageHead('Teacher Management', 'Add teachers and assign them to departments.', `<button class="btn primary" ${P('add')}>${icon('plus')} Add teacher</button>`) + '<div class="glass card" id="tb"></div>';
  let rows = [];
  const draw = async () => {
    rows = await GET('/api/teachers');
    $('#tb').innerHTML = table([{ h: 'Staff ID', f: (r) => `<b>${esc(r.staff_no)}</b>`, cls: 'nowrap' }, { h: 'Name', f: (r) => esc(r.full_name) }, { h: 'Department', f: (r) => esc(r.department || '—') },
      { h: 'Specialization', f: (r) => esc(r.specialization || '—') }, { h: 'Subjects', f: (r) => r.subjects }, { h: 'Contact', f: (r) => esc(r.phone || r.email || '—') },
      { h: 'Status', f: (r) => badge(r.active ? 'active' : 'disabled', r.active ? 'ok' : 'off') },
      { h: '', cls: 'right', f: (r) => `<div class="actions"><button class="btn sm icon" ${P('edit', r.id)}>${icon('edit')}</button><button class="btn sm icon" title="Reset password" ${P('reset', r.user_id)}>${icon('key')}</button><button class="btn sm icon danger" ${P('del', r.id)}>${icon('trash')}</button></div>` }], rows, 'No teachers yet');
  };
  await draw();
  const form = (t = {}) => [
    { name: 'full_name', label: 'Full name', value: t.full_name, required: true, full: true },
    { name: 'department_id', label: 'Department', type: 'select', required: true, value: t.department_id, options: opts(ref.depts, 'id', 'name') },
    { name: 'qualification', label: 'Qualification', value: t.qualification }, { name: 'specialization', label: 'Specialization', value: t.specialization },
    { name: 'email', label: 'Email', type: 'email', value: t.email }, { name: 'phone', label: 'Phone', type: 'tel', value: t.phone },
    ...(t.id ? [] : [{ name: 'password', label: 'Initial password', type: 'password', full: true, hint: 'Leave blank to generate one automatically.' }])];
  on('add', () => formModal({ title: 'Add teacher', fields: form(), submit: 'Add teacher', onSubmit: async (fm, m) => { const r = await POST('/api/teachers', formValues(fm)); m.close(); credModal('Teacher added', r.staff_no, r.password); draw(); } }));
  on('edit', (d) => { const t = rows.find((x) => x.id == d.id); formModal({ title: 'Edit teacher', fields: form(t), onSubmit: async (fm, m) => { await PUT('/api/teachers/' + t.id, formValues(fm)); m.close(); toast('Teacher updated'); draw(); } }); });
  on('del', async (d) => { const t = rows.find((x) => x.id == d.id); if (await confirmBox(`Delete ${t.full_name}? Their subjects will become unassigned.`)) { await DEL('/api/teachers/' + t.id); toast('Teacher deleted'); draw(); } });
  on('reset', (d) => resetPw(d.id));
};

/* ---------- COURSES ---------- */
PAGES.admin.courses = async (v) => {
  await refData(true);
  const teachers = await GET('/api/teachers');
  let tab = 'departments';
  const shell = () => { v.innerHTML = pageHead('Departments & Courses', 'Manage departments, courses, subjects and teacher assignments.') +
    `<div class="tabs">${['departments', 'courses', 'subjects'].map((t) => `<button class="tab ${t === tab ? 'on' : ''}" ${P('tab', t)}>${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}</div><div id="tb"></div>`; draw(); };
  const draw = async () => {
    const box = $('#tb');
    if (tab === 'departments') {
      await refData(true);
      box.innerHTML = `<div class="grid g2">${ref.depts.map((d, i) => `<div class="glass dept"><div class="ico">${icon(DEPT_ICONS[i % 4])}</div><h3>${esc(d.name)}</h3><p>${esc(d.description || '')}</p>
        <div class="meta"><span>${icon('user')} Head: ${esc(d.head || 'Not assigned')}</span></div>
        <div class="row-flex" style="margin:14px 0 16px;gap:18px"><span><b>${d.courses}</b> <span class="muted small">courses</span></span><span><b>${d.students}</b> <span class="muted small">students</span></span><span><b>${d.teachers}</b> <span class="muted small">teachers</span></span></div>
        <div class="row-flex" style="gap:8px"><button class="btn sm primary" ${P('dept', d.id)}>${icon('eye')} Details</button><button class="btn sm" ${P('editdept', d.id)}>${icon('edit')} Edit</button></div></div>`).join('')}</div>`;
    } else if (tab === 'courses') {
      await refData(true);
      box.innerHTML = `<div class="glass card"><div class="toolbar"><div class="grow"></div><button class="btn primary" ${P('addc')}>${icon('plus')} New course</button></div>` +
        table([{ h: 'Code', f: (r) => `<b>${esc(r.code)}</b>` }, { h: 'Course', f: (r) => esc(r.name) }, { h: 'Department', f: (r) => esc(r.department) }, { h: 'Duration', f: (r) => esc(r.duration || '—') },
          { h: 'Sem.', f: (r) => r.semesters }, { h: 'Subjects', f: (r) => r.subjects }, { h: 'Students', f: (r) => r.students },
          { h: '', cls: 'right', f: (r) => `<div class="actions"><button class="btn sm icon" ${P('editc', r.id)}>${icon('edit')}</button><button class="btn sm icon danger" ${P('delc', r.id)}>${icon('trash')}</button></div>` }], ref.courses) + '</div>';
    } else {
      const subs = await GET('/api/subjects'); ref.subjects = subs;
      box.innerHTML = `<div class="glass card"><div class="toolbar"><select id="fd" aria-label="Filter department"><option value="">All departments</option>${ref.depts.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}</select><div class="grow"></div><button class="btn primary" ${P('adds')}>${icon('plus')} New subject</button></div><div id="st"></div></div>`;
      const drawS = (did) => { $('#st').innerHTML = table([{ h: 'Code', f: (r) => `<b>${esc(r.code)}</b>` }, { h: 'Subject', f: (r) => esc(r.name) }, { h: 'Course', f: (r) => esc(r.course) }, { h: 'Sem', f: (r) => r.semester },
        { h: 'Teacher', f: (r) => r.teacher ? esc(r.teacher) : '<span class="badge b-late">Unassigned</span>' }, { h: 'Students', f: (r) => r.students },
        { h: '', cls: 'right', f: (r) => `<div class="actions"><button class="btn sm icon" ${P('edits', r.id)}>${icon('edit')}</button><button class="btn sm icon danger" ${P('dels', r.id)}>${icon('trash')}</button></div>` }],
        subs.filter((s) => !did || s.department_id == did)); };
      drawS(''); $('#fd').onchange = (e) => drawS(e.target.value);
    }
  };
  on('tab', (d) => { tab = d.id; shell(); });
  on('dept', async (d) => {
    const r = await GET('/api/departments/' + d.id);
    modal(`<h3>${esc(r.department.name)} <button class="btn icon sm" data-close>${icon('x')}</button></h3><p class="muted">${esc(r.department.description || '')}</p>
      <div class="grid g4 keep2" style="margin:16px 0"><div class="glass stat"><div class="num">${r.student_count}</div><div class="lbl">Students</div></div><div class="glass stat"><div class="num">${r.teachers.length}</div><div class="lbl">Teachers</div></div>
      <div class="glass stat"><div class="num">${r.notes_count}</div><div class="lbl">Notes</div></div><div class="glass stat"><div class="num">${r.attendance.percentage ?? '—'}${r.attendance.percentage != null ? '%' : ''}</div><div class="lbl">Attendance</div></div></div>
      <h4 style="margin:12px 0 8px">Courses</h4>${r.courses.map((c) => `<div class="item" style="margin-bottom:8px"><b>${esc(c.name)}</b> <span class="muted small">· ${esc(c.duration || '')} · ${c.semesters} semesters</span><p>${esc(c.description || '')}</p></div>`).join('')}
      <h4 style="margin:14px 0 8px">Subjects & modules</h4>${table([{ h: 'Code', f: (s) => esc(s.code) }, { h: 'Subject', f: (s) => esc(s.name) }, { h: 'Sem', f: (s) => s.semester }, { h: 'Teacher', f: (s) => esc(s.teacher || 'Unassigned') }], r.subjects)}
      <h4 style="margin:14px 0 8px">Registered students (${r.students.length})</h4>${table([{ h: 'Reg. No', f: (s) => esc(s.reg_no) }, { h: 'Name', f: (s) => esc(s.full_name) }, { h: 'Sem', f: (s) => s.semester }], r.students, 'No students registered')}`, { wide: true });
  });
  on('editdept', (d) => { const x = ref.depts.find((y) => y.id == d.id);
    formModal({ title: 'Edit ' + x.name, fields: [{ name: 'head', label: 'Department head', value: x.head, type: 'select', options: [['', 'Not assigned'], ...teachers.map((t) => [t.full_name, t.full_name + (t.department ? ' — ' + t.department : '')])] },
      { name: 'description', label: 'Description', type: 'textarea', value: x.description, full: true }], onSubmit: async (fm, m) => { await PUT('/api/departments/' + x.id, formValues(fm)); m.close(); toast('Department updated'); draw(); } }); });
  const cform = (c = {}) => [{ name: 'department_id', label: 'Department', type: 'select', required: true, value: c.department_id, options: opts(ref.depts, 'id', 'name') },
    { name: 'code', label: 'Course code', value: c.code, required: true }, { name: 'name', label: 'Course name', value: c.name, required: true, full: true },
    { name: 'duration', label: 'Duration', value: c.duration, placeholder: '3 years' }, { name: 'semesters', label: 'Semesters', type: 'number', min: 1, max: 12, value: c.semesters || 6, required: true },
    { name: 'description', label: 'Description', type: 'textarea', value: c.description, full: true, rows: 3 }];
  on('addc', () => formModal({ title: 'New course', fields: cform(), onSubmit: async (fm, m) => { await POST('/api/courses', formValues(fm)); m.close(); toast('Course created'); draw(); } }));
  on('editc', (d) => { const c = ref.courses.find((x) => x.id == d.id); formModal({ title: 'Edit course', fields: cform(c), onSubmit: async (fm, m) => { await PUT('/api/courses/' + c.id, formValues(fm)); m.close(); toast('Course updated'); draw(); } }); });
  on('delc', async (d) => { if (await confirmBox('Delete this course with all its subjects and notes?')) { try { await DEL('/api/courses/' + d.id); toast('Course deleted'); draw(); } catch (e) { toast(e.message, 'err'); } } });
  const sform = (s = {}) => [{ name: 'course_id', label: 'Course', type: 'select', required: true, value: s.course_id, options: opts(ref.courses, 'id', courseLabel) },
    { name: 'semester', label: 'Semester', type: 'number', min: 1, max: 12, value: s.semester || 1, required: true }, { name: 'name', label: 'Subject / module name', value: s.name, required: true, full: true },
    { name: 'code', label: 'Subject code', value: s.code, required: true }, { name: 'credits', label: 'Credits', type: 'number', min: 0, max: 20, value: s.credits ?? 3 },
    { name: 'teacher_id', label: 'Assigned teacher', type: 'select', value: s.teacher_id || '', full: true, options: [['', 'Unassigned'], ...teachers.map((t) => [t.id, `${t.full_name} — ${t.department || ''}`])] }];
  on('adds', () => formModal({ title: 'New subject', fields: sform(), onSubmit: async (fm, m) => { await POST('/api/subjects', formValues(fm)); m.close(); toast('Subject created'); draw(); } }));
  on('edits', (d) => { const s = ref.subjects.find((x) => x.id == d.id); formModal({ title: 'Edit subject', fields: sform(s), onSubmit: async (fm, m) => { await PUT('/api/subjects/' + s.id, formValues(fm)); m.close(); toast('Subject updated'); draw(); } }); });
  on('dels', async (d) => { if (await confirmBox('Delete this subject, its attendance records and notes?')) { await DEL('/api/subjects/' + d.id); toast('Subject deleted'); draw(); } });
  shell();
};

PAGES.teacher.courses = async (v) => {
  const d = await GET('/api/dashboard');
  v.innerHTML = pageHead('My Courses & Subjects', 'Subjects assigned to you by the administration.') +
    (d.subjects.length ? `<div class="grid g3">${d.subjects.map((s) => `<div class="glass dept"><div class="ico">${icon('book')}</div><h3>${esc(s.name)}</h3><p class="muted small">${esc(s.course)} · Semester ${s.semester} · ${esc(s.code)}</p>
      <div class="row-flex" style="margin:14px 0;gap:18px"><span><b>${s.students}</b> <span class="muted small">students</span></span><span><b>${s.notes}</b> <span class="muted small">notes</span></span></div>
      <div class="row-flex" style="gap:8px"><a class="btn sm primary" href="#/app/attendance">${icon('check')} Attendance</a><a class="btn sm" href="#/app/notes">${icon('upload')} Notes</a></div></div>`).join('')}</div>` : `<div class="glass card">${emptyBlock('No subjects assigned yet. Please contact the administrator.')}</div>`);
};

/* ---------- ATTENDANCE ---------- */
PAGES.admin.attendance = PAGES.teacher.attendance = PAGES.student.attendance = async (v) => {
  const role = A3.me.role;
  if (role === 'student') return studentAttendance(v);
  await refData();
  const subjects = await GET('/api/subjects');
  const dateMax = todayStr();
  let tab = 'mark';
  const shell = () => { v.innerHTML = pageHead('Attendance Management', role === 'admin' ? 'Monitor attendance for all students or mark it yourself.' : 'Mark attendance for your subjects and view reports.') +
    `<div class="tabs">${[['mark', 'Take attendance'], ['summary', 'Percentages'], ['records', 'History']].map(([k, l]) => `<button class="tab ${k === tab ? 'on' : ''}" ${P('tab', k)}>${l}</button>`).join('')}</div><div id="tb"></div>`; draw(); };
  const subjOpts = (blank) => `${blank ? `<option value="">${blank}</option>` : ''}${subjects.map((s) => `<option value="${s.id}">${esc(s.name)} — ${esc(s.course)} (Sem ${s.semester})</option>`).join('')}`;
  const draw = () => (tab === 'mark' ? drawMark() : drawReport());
  function drawMark() {
    const box = $('#tb');
    if (!subjects.length) { box.innerHTML = `<div class="glass card">${emptyBlock('You have no subjects assigned yet.')}</div>`; return; }
    box.innerHTML = `<div class="glass card"><div class="toolbar"><select id="ms" aria-label="Subject" style="min-width:260px">${subjOpts()}</select><input type="date" id="md" value="${dateMax}" max="${dateMax}" aria-label="Date"><button class="btn" id="mload">${icon('search')} Load class</button></div><div id="sheet"></div></div>`;
    const load = async () => {
      const s = $('#ms').value, d = $('#md').value; if (!s || !d) return;
      $('#sheet').innerHTML = '<div class="spinner"></div>';
      try {
        const r = await GET(`/api/attendance/sheet?${qs({ subject_id: s, date: d })}`);
        if (!r.students.length) { $('#sheet').innerHTML = emptyBlock('No active students are enrolled in this subject (course & semester).'); return; }
        $('#sheet').innerHTML = `<div class="toolbar"><span class="muted">${r.students.length} students · ${fmtDate(d)} ${r.saved ? badge('already saved', 'info') : ''}</span><div class="grow"></div>
          <button class="btn sm" ${P('allp')}>${icon('ok')} Mark all present</button><button class="btn primary" ${P('save')}>${icon('check')} Save attendance</button></div>
          <div class="table-wrap"><table><thead><tr><th>#</th><th>Reg. No</th><th>Student</th><th>Status</th></tr></thead><tbody>${r.students.map((st, i) => `<tr data-sid="${st.id}"><td>${i + 1}</td><td class="nowrap">${esc(st.reg_no)}</td><td>${esc(st.full_name)}</td>
          <td><div class="seg">${[['present', 'Present', 'p'], ['late', 'Late', 'l'], ['absent', 'Absent', 'a']].map(([val, lab, c]) => `<label class="${c} ${st.status === val ? 'on' : ''}"><input type="radio" name="s${st.id}" value="${val}" ${st.status === val ? 'checked' : ''}>${lab}</label>`).join('')}</div></td></tr>`).join('')}</tbody></table></div><div id="tally" class="muted small" style="margin-top:12px"></div>`;
        tally();
      } catch (e) { $('#sheet').innerHTML = `<div class="err-box">${esc(e.message)}</div>`; }
    };
    const tally = () => { const t = $('#tally'); if (!t) return; const c = { present: 0, late: 0, absent: 0, none: 0 };
      $$('#sheet tbody tr').forEach((tr) => { const x = $('input:checked', tr); c[x ? x.value : 'none']++; }); t.textContent = `Present ${c.present} · Late ${c.late} · Absent ${c.absent} · Not marked ${c.none}`; };
    $('#mload').onclick = load; $('#ms').onchange = load; $('#md').onchange = load;
    $('#sheet').addEventListener('change', (e) => { const l = e.target.closest('label'); if (!l) return; $$('label', l.parentElement).forEach((x) => x.classList.remove('on')); l.classList.add('on'); tally(); });
    on('allp', () => { $$('#sheet tbody tr').forEach((tr) => { const r = $('input[value=present]', tr); r.checked = true; $$('label', tr).forEach((x) => x.classList.remove('on')); r.parentElement.classList.add('on'); }); tally(); });
    on('save', async () => {
      const records = []; let missing = 0;
      $$('#sheet tbody tr').forEach((tr) => { const x = $('input:checked', tr); if (x) records.push({ student_id: Number(tr.dataset.sid), status: x.value }); else missing++; });
      if (!records.length) return toast('Mark at least one student', 'err');
      if (missing && !(await confirmBox(`${missing} student(s) are not marked and will be skipped. Save anyway?`, 'Save'))) return;
      try { const r = await POST('/api/attendance', { subject_id: Number($('#ms').value), date: $('#md').value, records }); toast(`Attendance saved for ${r.saved} students`); load(); } catch (e) { toast(e.message, 'err'); }
    });
    load();
  }
  function drawReport() {
    const f = { department_id: '', subject_id: '', from: '', to: '', status: '' };
    $('#tb').innerHTML = `<div class="glass card"><div class="toolbar">${role === 'admin' ? `<select id="fd" aria-label="Department">${[['', 'All departments'], ...ref.depts.map((d) => [d.id, d.name])].map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('')}</select>` : ''}
      <select id="fs" aria-label="Subject">${subjOpts('All subjects')}</select><label class="small muted">From <input type="date" id="ff" style="margin-left:6px"></label><label class="small muted">To <input type="date" id="ft" style="margin-left:6px"></label>
      ${tab === 'records' ? `<select id="fx" aria-label="Status"><option value="">Any status</option><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select>` : ''}
      <div class="grow"></div><a class="btn sm" id="xp" href="#">${icon('pdf')} PDF</a><a class="btn sm" id="xx" href="#">${icon('sheet')} Excel</a></div><div id="rt"></div></div>`;
    const load = async () => {
      const kind = tab === 'records' ? 'records' : 'summary';
      const q = qs(f);
      $('#xp').href = `/api/attendance/export?${q}&kind=${kind}&format=pdf`; $('#xx').href = `/api/attendance/export?${q}&kind=${kind}&format=xlsx`;
      const rows = await GET(`/api/attendance/${kind}?${q}`);
      $('#rt').innerHTML = tab === 'records'
        ? table([{ h: 'Date', f: (r) => fmtDate(r.date), cls: 'nowrap' }, { h: 'Reg. No', f: (r) => esc(r.reg_no) }, { h: 'Student', f: (r) => esc(r.student) }, { h: 'Subject', f: (r) => esc(r.subject) }, { h: 'Status', f: (r) => badge(r.status) }], rows, 'No attendance records match')
        : table([{ h: 'Reg. No', f: (r) => esc(r.reg_no) }, { h: 'Student', f: (r) => esc(r.student) }, { h: 'Subject', f: (r) => esc(r.subject) }, { h: 'Total', f: (r) => r.total }, { h: 'Present', f: (r) => r.present }, { h: 'Late', f: (r) => r.late }, { h: 'Absent', f: (r) => r.absent },
          { h: 'Attendance', f: (r) => `<div style="min-width:120px"><div class="track"><i class="${pctClass(r.percentage)}" style="width:${r.percentage}%"></i></div><span class="small ${r.percentage < 75 ? 'badge b-low' : ''}">${r.percentage}%</span></div>` }], rows, 'No attendance records match');
    };
    const bind = (id, k) => { const el = $(id); if (el) el.onchange = (e) => { f[k] = e.target.value; load(); }; };
    bind('#fd', 'department_id'); bind('#fs', 'subject_id'); bind('#ff', 'from'); bind('#ft', 'to'); bind('#fx', 'status'); load();
  }
  on('tab', (d) => { tab = d.id; shell(); });
  shell();
};
async function studentAttendance(v) {
  const [d, hist] = await Promise.all([GET('/api/dashboard'), GET('/api/attendance/records')]);
  const a = d.attendance;
  v.innerHTML = pageHead('My Attendance', 'Your attendance history and percentages. Late arrivals count as attended.',
    `<a class="btn sm" href="/api/attendance/export?kind=summary&format=pdf">${icon('pdf')} PDF</a><a class="btn sm" href="/api/attendance/export?kind=records&format=xlsx">${icon('sheet')} Excel</a>`) +
    `<div class="grid g-main" style="margin-bottom:18px"><div class="glass card"><h3>${icon('chart')} By subject</h3>${d.by_subject.length ? d.by_subject.map((s) => hbar(s.subject, s.percentage, `${s.percentage}% <span class="muted small">(${s.present + s.late}/${s.total})</span>`)).join('') : emptyBlock('No attendance recorded yet')}</div>
    <div class="glass card"><h3>${icon('check')} Overall</h3><div class="row-flex"><div class="donut" style="--p:${a.percentage || 0}"><b>${a.percentage ?? '—'}${a.percentage != null ? '%' : ''}</b></div>
      <div class="legend"><div><i style="background:var(--em2)"></i>Present: <b>${a.present}</b></div><div><i style="background:var(--warn)"></i>Late: <b>${a.late}</b></div><div><i style="background:var(--bad)"></i>Absent: <b>${a.absent}</b></div></div></div>
      ${a.percentage != null && a.percentage < 75 ? `<div class="err-box" style="margin-top:16px">Your attendance is below 75%. Please attend classes regularly.</div>` : ''}</div></div>
    <div class="glass card"><h3>${icon('clock')} Attendance history</h3>${table([{ h: 'Date', f: (r) => fmtDate(r.date), cls: 'nowrap' }, { h: 'Subject', f: (r) => esc(r.subject) }, { h: 'Status', f: (r) => badge(r.status) }], hist, 'No records yet')}</div>`;
}

/* ---------- ANNOUNCEMENTS ---------- */
PAGES.admin.announcements = PAGES.teacher.announcements = PAGES.student.announcements = async (v) => {
  const role = A3.me.role; let type = '';
  const canWrite = role !== 'student';
  v.innerHTML = pageHead('Announcements & Notices', role === 'student' ? 'Latest news and notices from the college and your teachers.' : 'Publish notices to students.',
    canWrite ? `<button class="btn primary" ${P('add')}>${icon('plus')} New announcement</button>` : '') +
    `<div class="chips">${[['', 'All'], ['general', 'General'], ['exam', 'Examinations'], ['important', 'Important'], ['academic', 'Academic']].map(([k, l]) => `<button class="chip ${k === type ? 'on' : ''}" ${P('type', k)}>${l}</button>`).join('')}</div><div id="al"></div>`;
  const draw = async () => {
    const items = await GET('/api/announcements?' + qs({ type }));
    $('#al').innerHTML = annList(items, (a) => role === 'admin' || (role === 'teacher' && a.author_user_id === A3.me.id));
    if (role === 'student') POST('/api/notifications/read').then(() => pollNotifs(false)).catch(() => {});
  };
  on('type', (d) => { type = d.id; $$('.chip').forEach((c) => c.classList.toggle('on', c.dataset.id === type)); draw(); });
  on('delann', async (d) => { if (await confirmBox('Delete this announcement?')) { await DEL('/api/announcements/' + d.id); toast('Announcement deleted'); draw(); } });
  if (canWrite) {
    await refData();
    const subjects = role === 'teacher' ? await GET('/api/subjects') : [];
    on('add', () => {
      const fields = role === 'admin' ? [
        { name: 'title', label: 'Title', required: true, full: true, max: 150 },
        { name: 'type', label: 'Type', type: 'select', options: [['general', 'General announcement'], ['exam', 'Examination announcement'], ['important', 'Important notice'], ['academic', 'Academic']] },
        { name: 'scope', label: 'Send to', type: 'select', options: [['all', 'All students & teachers'], ['department', 'A specific department']] },
        { name: 'department_id', label: 'Department (if specific)', type: 'select', full: true, options: opts(ref.depts, 'id', 'name') },
        { name: 'body', label: 'Message', type: 'textarea', required: true, full: true }]
        : [{ name: 'title', label: 'Title', required: true, full: true, max: 150 },
          { name: 'subject_id', label: 'Send to students of', type: 'select', full: true, required: true, options: subjects.map((s) => [s.id, `${s.name} — ${s.course} (Sem ${s.semester})`]) },
          { name: 'body', label: 'Message', type: 'textarea', required: true, full: true }];
      if (role === 'teacher' && !subjects.length) return toast('You have no assigned subjects', 'err');
      formModal({ title: 'New announcement', fields, submit: 'Publish', wide: true, onSubmit: async (fm, m) => { const r = await POST('/api/announcements', formValues(fm)); m.close(); toast(`Published — ${r.notified} people notified`); draw(); } });
    });
  }
  await draw();
};

/* ---------- NOTES ---------- */
PAGES.admin.notes = PAGES.teacher.notes = PAGES.student.notes = async (v) => {
  const role = A3.me.role;
  await refData();
  const subjects = await GET('/api/subjects');
  const f = { q: '', department_id: '', course_id: '', subject_id: '', semester: '' };
  const canUpload = role !== 'student';
  v.innerHTML = pageHead(role === 'student' ? 'Learning Notes' : 'Notes & Learning Materials', 'Digital library of PDF, Word and PowerPoint notes and written materials.',
    canUpload ? `<button class="btn primary" ${P('add')}>${icon('upload')} Add notes</button>` : '') +
    `<div class="glass card" style="margin-bottom:18px"><div class="toolbar"><div class="search">${icon('search')}<input id="nq" placeholder="Search notes" aria-label="Search"></div>
    ${role === 'admin' ? `<select id="nd" aria-label="Department">${[['', 'All departments'], ...ref.depts.map((d) => [d.id, d.name])].map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('')}</select>` : ''}
    ${role === 'admin' ? `<select id="nc" aria-label="Course">${[['', 'All courses'], ...ref.courses.map((c) => [c.id, c.name])].map(([a, b]) => `<option value="${a}">${esc(b)}</option>`).join('')}</select>` : ''}
    <select id="ns" aria-label="Subject"><option value="">All subjects</option>${subjects.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
    <select id="nm" aria-label="Semester"><option value="">All semesters</option>${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">Semester ${n}</option>`).join('')}</select></div></div><div id="nl"></div>`;
  let rows = [];
  const draw = async () => {
    rows = await GET('/api/notes?' + qs(f));
    $('#nl').innerHTML = rows.length ? `<div class="grid g3">${rows.map((n) => { const [cls, lab] = fileType(n.mime, n.kind);
      return `<div class="glass note"><div class="row-flex" style="gap:14px;flex-wrap:nowrap;align-items:flex-start"><div class="ftype ${cls}">${lab}</div><div style="min-width:0"><h4 style="font-size:1rem;word-break:break-word">${esc(n.title)}</h4><div class="muted small">${esc(n.subject)} · Sem ${n.semester}</div></div></div>
      ${n.description ? `<p class="muted small">${esc(n.description)}</p>` : ''}<div class="meta"><span>${esc(n.department)}</span><span>${icon('user')} ${esc(n.teacher || '—')}</span><span>${icon('clock')} ${fmtDate(n.created_at)}</span>${n.size ? `<span>${bytes(n.size)}</span>` : ''}</div>
      <div class="row-flex" style="gap:8px;margin-top:auto">${n.kind === 'file' ? `<a class="btn sm primary" href="/api/notes/${n.id}/download">${icon('download')} Download</a>` : `<button class="btn sm primary" ${P('read', n.id)}>${icon('eye')} Read</button>`}
      ${canUpload && (role === 'admin' || n.teacher_id === A3.me.teacher?.id) ? `<button class="btn sm danger" ${P('del', n.id)}>${icon('trash')}</button>` : ''}</div></div>`; }).join('')}</div>` : `<div class="glass card">${emptyBlock('No notes found')}</div>`;
  };
  if (role === 'teacher' && !A3.me.teacher) A3.me = await GET('/api/me');
  let tm; $('#nq').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { f.q = e.target.value; draw(); }, 250); };
  [['#nd', 'department_id'], ['#nc', 'course_id'], ['#ns', 'subject_id'], ['#nm', 'semester']].forEach(([id, k]) => { const el = $(id); if (el) el.onchange = (e) => { f[k] = e.target.value; draw(); }; });
  on('read', async (d) => { const n = await GET('/api/notes/' + d.id); modal(`<h3>${esc(n.title)} <button class="btn icon sm" data-close>${icon('x')}</button></h3>${n.description ? `<p class="muted">${esc(n.description)}</p>` : ''}<div class="item" style="white-space:pre-wrap;margin-top:12px;line-height:1.75">${esc(n.content)}</div>`, { wide: true }); });
  on('del', async (d) => { if (await confirmBox('Delete these notes permanently?')) { await DEL('/api/notes/' + d.id); toast('Notes deleted'); draw(); } });
  on('add', () => {
    if (!subjects.length) return toast('You have no assigned subjects', 'err');
    formModal({ title: 'Add notes', submit: 'Publish notes', wide: true, fields: [
      { name: 'subject_id', label: 'Course / subject', type: 'select', required: true, full: true, options: subjects.map((s) => [s.id, `${s.name} — ${s.course} (Sem ${s.semester})`]) },
      { name: 'title', label: 'Title', required: true, full: true, max: 150 }, { name: 'description', label: 'Short description', full: true },
      { name: 'file', label: 'Upload file (PDF, DOC, DOCX, PPT, PPTX — max 25 MB)', type: 'file', accept: '.pdf,.doc,.docx,.ppt,.pptx', full: true },
      { name: 'content', label: 'Or write the learning material here', type: 'textarea', rows: 7, full: true, max: 50000, hint: 'Provide a file, written content, or both (the file is shared when both are given).' }],
      onSubmit: async (fm, m) => { const fd = new FormData(fm); if (!fd.get('file') || !fd.get('file').name) fd.delete('file'); await api('POST', '/api/notes', fd, true); m.close(); toast('Notes published and students notified'); draw(); } });
  });
  await draw();
};

/* ---------- STUDENT DASHBOARD ---------- */
PAGES.student.dashboard = async (v) => {
  const [d, anns, me] = await Promise.all([GET('/api/dashboard'), GET('/api/announcements?limit=5'), GET('/api/me')]);
  A3.me = me; const s = me.student; const a = d.attendance;
  v.innerHTML = `<div class="banner"><div><h2>Hello, <span class="gradient-text">${esc(me.full_name.split(' ')[0])}</span> 👋</h2><p>${esc(s.course)} · Semester ${s.semester} · ${esc(me.username)}</p></div></div>
  <div class="glass card" style="margin-bottom:18px"><h3>${icon('megaphone')} Latest announcements & notices</h3>${annList(anns, () => false)}<div style="margin-top:14px"><a class="btn sm" href="#/app/announcements">View all announcements</a></div></div>
  <div class="grid g3" style="margin-bottom:18px"><div class="glass stat"><div class="ico">${icon('check')}</div><div class="num">${a.percentage ?? '—'}${a.percentage != null ? '%' : ''}</div><div class="lbl">Overall attendance</div></div>
    <div class="glass stat"><div class="ico">${icon('book')}</div><div class="num" data-count="${d.subjects.filter((x) => x.semester === s.semester).length}">0</div><div class="lbl">Subjects this semester</div></div>
    <div class="glass stat"><div class="ico">${icon('file')}</div><div class="num" data-count="${d.notes_count}">0</div><div class="lbl">Notes available</div></div></div>
  <div class="grid g2"><div class="glass card"><h3>${icon('chart')} Attendance by subject</h3>${d.by_subject.length ? d.by_subject.map((x) => hbar(x.subject, x.percentage)).join('') : emptyBlock('No attendance yet')}</div>
    <div class="glass card"><h3>${icon('layers')} My subjects — Semester ${s.semester}</h3><div class="list">${d.subjects.filter((x) => x.semester === s.semester).map((x) => `<div class="item"><b>${esc(x.name)}</b><div class="meta"><span>${esc(x.code)}</span><span>${icon('teacher')} ${esc(x.teacher || 'To be assigned')}</span></div></div>`).join('') || emptyBlock('No subjects yet')}</div></div></div>`;
};

/* ---------- TEACHER DASHBOARD ---------- */
PAGES.teacher.dashboard = async (v) => {
  const d = await GET('/api/dashboard');
  v.innerHTML = `${welcome('Manage your classes, attendance and learning materials.')}
  <div class="grid g4 keep2" style="margin-bottom:18px">${statCard('book', d.subjects.length, 'Assigned subjects')}${statCard('users', d.students, 'My students')}${statCard('file', d.notes, 'Notes uploaded')}
    <div class="glass stat"><div class="ico">${icon('check')}</div><div class="num">${d.attendance_percentage ?? '—'}${d.attendance_percentage != null ? '%' : ''}</div><div class="lbl">Avg. class attendance</div></div></div>
  <div class="grid g-main"><div class="glass card"><h3>${icon('layers')} My classes</h3>${d.subjects.length ? `<div class="list">${d.subjects.map((s) => `<div class="item"><div class="top"><div><h4>${esc(s.name)}</h4><div class="meta"><span>${esc(s.course)}</span><span>Semester ${s.semester}</span><span>${s.students} students</span><span>${s.notes} notes</span></div></div>
    <a class="btn sm primary" href="#/app/attendance">${icon('check')} Take attendance</a></div></div>`).join('')}</div>` : emptyBlock('No subjects assigned yet')}</div>
    <div class="glass card"><h3>${icon('file')} Recent notes</h3>${d.recent_notes.length ? `<div class="list">${d.recent_notes.map((n) => `<div class="item"><b>${esc(n.title)}</b><div class="meta"><span>${esc(n.subject)}</span><span>${ago(n.created_at)}</span></div></div>`).join('')}</div>` : emptyBlock('No notes uploaded yet')}
      <div style="margin-top:14px"><a class="btn sm primary" href="#/app/notes">${icon('upload')} Upload notes</a></div></div></div>`;
};

/* ---------- REPORTS ---------- */
PAGES.admin.reports = async (v) => {
  const r = await GET('/api/reports/overview');
  const o = r.overall;
  v.innerHTML = pageHead('Reports & Analytics', 'College-wide performance, attendance and engagement.',
    `<a class="btn sm" href="/api/attendance/export?kind=summary&format=pdf">${icon('pdf')} Attendance PDF</a><a class="btn sm" href="/api/attendance/export?kind=summary&format=xlsx">${icon('sheet')} Attendance Excel</a><a class="btn sm" href="/api/attendance/export?kind=records&format=xlsx">${icon('sheet')} All records</a>`) +
    `<div class="grid g3" style="margin-bottom:18px"><div class="glass stat"><div class="ico">${icon('check')}</div><div class="num">${o.percentage ?? '—'}${o.percentage != null ? '%' : ''}</div><div class="lbl">College-wide attendance</div></div>
      <div class="glass stat"><div class="ico">${icon('ok')}</div><div class="num" data-count="${o.present + o.late}">0</div><div class="lbl">Attended sessions</div></div><div class="glass stat"><div class="ico">${icon('alert')}</div><div class="num" data-count="${o.absent}">0</div><div class="lbl">Absences</div></div></div>
    <div class="grid g2" style="margin-bottom:18px"><div class="glass card"><h3>${icon('building')} Attendance by department</h3>${r.departments.map((d) => hbar(d.name, d.attendance.percentage)).join('')}</div>
      <div class="glass card"><h3>${icon('megaphone')} Announcements by type</h3>${r.announcement_types.length ? r.announcement_types.map((a) => `<div class="hbar"><div class="row"><span>${annBadge(a.type)}</span><b>${a.n}</b></div></div>`).join('') : emptyBlock('None yet')}</div></div>
    <div class="glass card" style="margin-bottom:18px"><h3>${icon('layers')} Department overview</h3>${table([{ h: 'Department', f: (d) => esc(d.name) }, { h: 'Students', f: (d) => d.students }, { h: 'Teachers', f: (d) => d.teachers }, { h: 'Notes', f: (d) => d.notes }, { h: 'Attendance', f: (d) => d.attendance.percentage != null ? d.attendance.percentage + '%' : '—' }], r.departments)}</div>
    <div class="glass card"><h3>${icon('alert')} Students with attendance below 75%</h3>${table([{ h: 'Reg. No', f: (s) => esc(s.reg_no) }, { h: 'Student', f: (s) => esc(s.student) }, { h: 'Department', f: (s) => esc(s.department) }, { h: 'Sessions', f: (s) => s.total }, { h: 'Attendance', f: (s) => badge(s.percentage + '%', 'low') }], r.low_attendance, 'Great news — no students are below 75%.')}</div>`;
};

/* ---------- ACCOUNTS ---------- */
PAGES.admin.accounts = async (v) => {
  const f = { q: '', role: '' };
  v.innerHTML = pageHead('User Accounts & Passwords', 'Reset passwords, enable or disable accounts and manage administrators.', `<button class="btn primary" ${P('addadmin')}>${icon('plus')} Add administrator</button>`) +
    `<div class="glass card"><div class="toolbar"><div class="search">${icon('search')}<input id="aq" placeholder="Search accounts" aria-label="Search"></div>
    <select id="ar" aria-label="Role"><option value="">All roles</option><option value="admin">Administrators</option><option value="teacher">Teachers</option><option value="student">Students</option></select></div><div id="tb"></div></div>`;
  let rows = [];
  const draw = async () => {
    rows = await GET('/api/accounts?' + qs(f));
    $('#tb').innerHTML = table([{ h: 'Username', f: (r) => `<b>${esc(r.username)}</b>`, cls: 'nowrap' }, { h: 'Name', f: (r) => esc(r.full_name) }, { h: 'Role', f: (r) => badge(r.role, r.role === 'admin' ? 'important' : r.role === 'teacher' ? 'academic' : 'general') },
      { h: 'Last login', f: (r) => (r.last_login ? ago(r.last_login) : 'Never') }, { h: 'Status', f: (r) => badge(r.active ? 'active' : 'disabled', r.active ? 'ok' : 'off') },
      { h: '', cls: 'right', f: (r) => `<div class="actions"><button class="btn sm" ${P('reset', r.id)}>${icon('key')} Reset</button>${r.id !== A3.me.id ? `<button class="btn sm" ${P('toggle', r.id)}>${r.active ? 'Disable' : 'Enable'}</button>` : ''}${r.role === 'admin' && r.id !== A3.me.id ? `<button class="btn sm icon danger" ${P('del', r.id)}>${icon('trash')}</button>` : ''}</div>` }], rows, 'No accounts found');
  };
  let tm; $('#aq').oninput = (e) => { clearTimeout(tm); tm = setTimeout(() => { f.q = e.target.value; draw(); }, 250); };
  $('#ar').onchange = (e) => { f.role = e.target.value; draw(); };
  on('reset', (d) => resetPw(d.id));
  on('toggle', async (d) => { const r = rows.find((x) => x.id == d.id); await POST(`/api/accounts/${r.id}/active`, { active: !r.active }); toast(r.active ? 'Account disabled' : 'Account enabled'); draw(); });
  on('del', async (d) => { if (await confirmBox('Delete this administrator account?')) { await DEL('/api/accounts/' + d.id); toast('Administrator deleted'); draw(); } });
  on('addadmin', () => formModal({ title: 'Add administrator', fields: [{ name: 'full_name', label: 'Full name', required: true, full: true }, { name: 'username', label: 'Username', required: true }, { name: 'password', label: 'Password', type: 'password', required: true, hint: 'At least 6 characters' },
    { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Phone', type: 'tel' }], onSubmit: async (fm, m) => { await POST('/api/admins', formValues(fm)); m.close(); toast('Administrator created'); draw(); } }));
  await draw();
};

/* ---------- PROFILE ---------- */
PAGES.admin.profile = PAGES.teacher.profile = PAGES.student.profile = async (v) => {
  const me = await GET('/api/me'); A3.me = me; const role = me.role; const s = me.student, t = me.teacher;
  const info = role === 'student' ? `<div class="glass card"><h3>${icon('book')} Course & academic information</h3><div class="list">
    ${[['Registration no.', me.username], ['Department', s.department], ['Course', `${s.course} (${s.course_code})`], ['Duration', s.duration], ['Current semester', `${s.semester} of ${s.semesters}`], ['Admission date', fmtDate(s.admission_date)], ['Gender', s.gender || '—'], ['Date of birth', s.dob ? fmtDate(s.dob) : '—']]
      .map(([a, b]) => `<div class="item row-flex" style="justify-content:space-between;gap:10px"><span class="muted">${a}</span><b style="text-transform:capitalize">${esc(b)}</b></div>`).join('')}</div></div>`
    : role === 'teacher' ? `<div class="glass card"><h3>${icon('teacher')} Staff information</h3><div class="list">${[['Staff ID', me.username], ['Department', t.department || '—']].map(([a, b]) => `<div class="item row-flex" style="justify-content:space-between"><span class="muted">${a}</span><b>${esc(b)}</b></div>`).join('')}</div></div>`
    : `<div class="glass card"><h3>${icon('shield')} Administrator</h3><div class="item row-flex" style="justify-content:space-between"><span class="muted">Username</span><b>${esc(me.username)}</b></div></div>`;
  const fields = [
    { name: 'full_name', label: 'Full name', value: me.full_name, full: true, required: role !== 'student', ...(role === 'student' ? { hint: 'Name changes are made by the administration.' } : {}) },
    { name: 'email', label: 'Email', type: 'email', value: me.email }, { name: 'phone', label: 'Phone', type: 'tel', value: me.phone },
    ...(role === 'teacher' ? [{ name: 'qualification', label: 'Qualification', value: t.qualification }, { name: 'specialization', label: 'Specialization', value: t.specialization }, { name: 'bio', label: 'About me', type: 'textarea', value: t.bio, full: true, rows: 3 }] : []),
    ...(role === 'student' ? [{ name: 'address', label: 'Address', value: s.address, full: true }, { name: 'guardian_name', label: 'Guardian name', value: s.guardian_name }, { name: 'guardian_phone', label: 'Guardian phone', type: 'tel', value: s.guardian_phone }] : [])];
  v.innerHTML = pageHead('My Profile', 'View and update your personal details.') + `<div class="grid g2" style="margin-bottom:18px">${info}
    <div class="glass card"><h3>${icon('user')} Personal details</h3><form id="pf" novalidate><div class="form-grid">${fields.map((f) => (role === 'student' && f.name === 'full_name' ? fieldHtml({ ...f }).replace('<input', '<input disabled') : fieldHtml(f))).join('')}</div><div class="err-box hidden" id="pe" style="margin-top:12px"></div><button class="btn primary" style="margin-top:16px">${icon('check')} Save changes</button></form></div></div>
    <div class="glass card" style="max-width:560px"><h3>${icon('lock')} Change password</h3><form id="pw" novalidate><div class="form-grid">${fieldHtml({ name: 'current', label: 'Current password', type: 'password', required: true, full: true })}${fieldHtml({ name: 'next', label: 'New password', type: 'password', required: true, hint: 'At least 6 characters' })}${fieldHtml({ name: 'again', label: 'Confirm new password', type: 'password', required: true })}</div>
      <div class="err-box hidden" id="pwe" style="margin-top:12px"></div><button class="btn primary" style="margin-top:16px">${icon('key')} Update password</button></form></div>`;
  $('#pf').onsubmit = async (e) => { e.preventDefault(); const er = $('#pe'); er.classList.add('hidden'); try { await PUT('/api/me/profile', formValues(e.target)); toast('Profile updated'); } catch (x) { er.textContent = x.message; er.classList.remove('hidden'); } };
  $('#pw').onsubmit = async (e) => { e.preventDefault(); const er = $('#pwe'); er.classList.add('hidden'); const f = formValues(e.target);
    try { if (f.next !== f.again) throw new Error('New passwords do not match'); await POST('/api/me/password', { current: f.current, next: f.next }); e.target.reset(); toast('Password changed'); } catch (x) { er.textContent = x.message; er.classList.remove('hidden'); } };
};
