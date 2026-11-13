'use strict';
/* ---------- tiny helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const utc = (s) => new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
const fmtDate = (s) => (s ? new Date(String(s).length === 10 ? s + 'T00:00:00' : utc(s)).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const ago = (s) => {
  const m = Math.round((Date.now() - utc(s).getTime()) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
  if (m < 1440) return Math.round(m / 60) + ' h ago'; if (m < 10080) return Math.round(m / 1440) + ' d ago';
  return fmtDate(s);
};
const bytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const todayStr = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const pctClass = (p) => (p == null ? '' : p >= 85 ? '' : p >= 75 ? 'mid' : 'low');
const qs = (o) => Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');

/* ---------- icons (feather-style) ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  teacher: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 2.5 9 2.5 12 0v-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  check: '<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h3l8 5V5L7 10H4a1 1 0 0 0-1 1z"/><path d="M19 8a5 5 0 0 1 0 8"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  ok: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h2l2-4 2 8 2-4h2"/>',
  pill: '<path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z"/><path d="m8.5 8.5 7 7"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
  sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M12 11v10"/>',
  pdf: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- toast ---------- */
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'err' ? 'err' : '');
  t.innerHTML = icon(type === 'err' ? 'alert' : 'ok') + `<span>${esc(msg)}</span>`;
  $('#toasts').appendChild(t);
  setTimeout(() => { t.style.transition = '.3s'; t.style.opacity = 0; setTimeout(() => t.remove(), 300); }, type === 'err' ? 5000 : 3200);
}

/* ---------- api ---------- */
async function api(method, url, body, isForm) {
  const opt = { method, headers: { 'X-Requested-With': 'A3' }, credentials: 'same-origin' };
  if (body && !isForm) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  if (isForm) opt.body = body;
  let res;
  try { res = await fetch(url, opt); } catch { throw new Error('Network error. Check your connection.'); }
  let data = null; try { data = await res.json(); } catch {}
  if (res.status === 401 && !url.startsWith('/api/login') && window.A3 && A3.me) { A3.me = null; location.hash = '#/login'; }
  if (!res.ok) throw new Error((data && data.error) || 'Request failed');
  return data;
}
const GET = (u) => api('GET', u);
const POST = (u, b) => api('POST', u, b || {});
const PUT = (u, b) => api('PUT', u, b || {});
const DEL = (u) => api('DELETE', u);

/* ---------- modal ---------- */
function modal(html, { wide = false } = {}) {
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  document.body.appendChild(ov);
  const first = $('input:not([type=hidden]),select,textarea', ov); if (first) setTimeout(() => first.focus(), 50);
  return { el: ov, close };
}
function confirmBox(message, okLabel = 'Delete') {
  return new Promise((resolve) => {
    const m = modal(`<h3>${icon('alert')} Please confirm</h3><p class="muted">${esc(message)}</p>
      <div class="foot"><button class="btn" data-close>Cancel</button><button class="btn danger" id="cf-ok">${esc(okLabel)}</button></div>`);
    $('#cf-ok', m.el).onclick = () => { m.close(); resolve(true); };
    m.el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) resolve(false); });
    m.el.addEventListener('mousedown', (e) => { if (e.target === m.el) resolve(false); });
  });
}
/* field: {name,label,type,options:[[v,l]],value,required,hint,full,placeholder,min,max,accept} */
function fieldHtml(f) {
  const id = 'f_' + f.name; const v = f.value ?? '';
  let input;
  if (f.type === 'select') input = `<select id="${id}" name="${f.name}" ${f.required ? 'required' : ''}>${(f.options || []).map(([ov, ol]) => `<option value="${esc(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${esc(ol)}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') input = `<textarea id="${id}" name="${f.name}" rows="${f.rows || 4}" maxlength="${f.max || 4000}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>`;
  else input = `<input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(v)}" ${f.required ? 'required' : ''} placeholder="${esc(f.placeholder || '')}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.accept ? `accept="${f.accept}"` : ''} ${f.type === 'password' ? 'autocomplete="new-password"' : ''}>`;
  return `<div class="field ${f.full ? 'full' : ''}"><label for="${id}">${esc(f.label)}${f.required ? ' *' : ''}</label>${input}${f.hint ? `<span class="hint">${esc(f.hint)}</span>` : ''}</div>`;
}
function formModal({ title, fields, submit = 'Save', wide, onSubmit, extra = '' }) {
  const m = modal(`<h3>${esc(title)} <button class="btn icon sm" data-close aria-label="Close">${icon('x')}</button></h3>
    <form id="mf" novalidate><div class="form-grid">${fields.map(fieldHtml).join('')}</div>${extra}
    <div class="err-box hidden" id="mf-err" style="margin-top:14px"></div>
    <div class="foot"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">${esc(submit)}</button></div></form>`, { wide });
  const form = $('#mf', m.el);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#mf-err', m.el); err.classList.add('hidden');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try { await onSubmit(form, m); } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); btn.disabled = false; }
  });
  return m;
}
const formValues = (form) => Object.fromEntries(new FormData(form).entries());
const opts = (list, v, l, blank) => (blank ? [['', blank]] : []).concat(list.map((x) => [x[v], typeof l === 'function' ? l(x) : x[l]]));

/* ---------- components ---------- */
function table(cols, rows, emptyMsg = 'Nothing to show yet') {
  if (!rows.length) return `<div class="empty">${icon('layers')}<div>${esc(emptyMsg)}</div></div>`;
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th class="${c.cls || ''}">${esc(c.h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c.cls || ''}">${c.f(r)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
const badge = (t, cls) => `<span class="badge b-${cls || t}">${esc(t)}</span>`;
const hbar = (label, pct, right) => `<div class="hbar"><div class="row"><span>${esc(label)}</span><b>${right ?? (pct == null ? '—' : pct + '%')}</b></div><div class="track"><i class="${pctClass(pct)}" style="width:${pct || 0}%"></i></div></div>`;
const statCard = (ic, num, label) => `<div class="glass stat"><div class="ico">${icon(ic)}</div><div class="num" data-count="${num}">${num}</div><div class="lbl">${esc(label)}</div></div>`;
const emptyBlock = (msg) => `<div class="empty">${icon('layers')}<div>${esc(msg)}</div></div>`;
const fileType = (mime, kind) => (kind === 'article' ? ['ft-txt', 'TXT'] : /pdf/.test(mime) ? ['ft-pdf', 'PDF'] : /word/.test(mime) ? ['ft-doc', 'DOC'] : ['ft-ppt', 'PPT']);

const ACT = {}; // click handlers by data-act
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-act]');
  if (t && ACT[t.dataset.act]) { e.preventDefault(); ACT[t.dataset.act](t.dataset, t, e); }
});
