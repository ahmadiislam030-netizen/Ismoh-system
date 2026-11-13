'use strict';
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { db, hash, log, bcrypt } = require('./db');

const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads'); // outside /public: only served through authenticated route
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- session secret & store ----------
const secretFile = path.join(__dirname, 'data', '.session_secret');
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, crypto.randomBytes(48).toString('hex'), { mode: 0o600 });
  SECRET = fs.readFileSync(secretFile, 'utf8');
}
class SqliteStore extends session.Store {
  get(sid, cb) {
    try {
      const r = db.prepare('SELECT sess FROM sessions WHERE sid=? AND expires>?').get(sid, Date.now());
      cb(null, r ? JSON.parse(r.sess) : null);
    } catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try {
      const exp = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 86400000;
      db.prepare('INSERT INTO sessions (sid, sess, expires) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expires=excluded.expires')
        .run(sid, JSON.stringify(sess), exp);
      cb && cb(null);
    } catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
}
setInterval(() => { try { db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); } catch {} }, 3600000).unref();

const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(express.json({ limit: '200kb' }));
app.use(session({
  name: 'a3.sid', secret: SECRET, resave: false, saveUninitialized: false, store: new SqliteStore(),
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === '1', maxAge: 8 * 3600 * 1000 },
}));

// CSRF defence in depth: SameSite cookie + required custom header on all state-changing API calls
app.use('/api', (req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('x-requested-with') !== 'A3') return res.status(403).json({ error: 'Forbidden' });
  next();
});

// ---------- helpers ----------
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (msg) => new HttpError(400, msg);
const wrap = (fn) => (req, res, next) => { try { const r = fn(req, res, next); if (r && r.catch) r.catch(next); } catch (e) { next(e); } };

const str = (v, name, { min = 1, max = 200, optional = false } = {}) => {
  if (v === undefined || v === null || String(v).trim() === '') { if (optional) return null; throw bad(`${name} is required`); }
  const s = String(v).trim();
  if (s.length < min || s.length > max) throw bad(`${name} must be ${min}-${max} characters`);
  return s;
};
const int = (v, name, { min = 0, max = 1e9, optional = false } = {}) => {
  if (v === undefined || v === null || v === '') { if (optional) return null; throw bad(`${name} is required`); }
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw bad(`${name} is invalid`);
  return n;
};
const oneOf = (v, name, list, optional = false) => {
  if ((v === undefined || v === null || v === '') && optional) return null;
  if (!list.includes(v)) throw bad(`${name} is invalid`);
  return v;
};
const date = (v, name, optional = false) => {
  if ((v === undefined || v === null || v === '') && optional) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v)) || isNaN(Date.parse(v))) throw bad(`${name} must be a valid date (YYYY-MM-DD)`);
  return String(v);
};
const email = (v) => {
  const s = str(v, 'Email', { optional: true, max: 120 });
  if (s && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw bad('Email is invalid');
  return s;
};
const phone = (v) => {
  const s = str(v, 'Phone', { optional: true, max: 25 });
  if (s && !/^[0-9+\-\s()]{6,25}$/.test(s)) throw bad('Phone is invalid');
  return s;
};
const password = (v) => {
  const s = String(v || '');
  if (s.length < 6 || s.length > 100) throw bad('Password must be 6-100 characters');
  return s;
};
const genPassword = () => crypto.randomBytes(6).toString('base64').replace(/[^A-Za-z0-9]/g, 'x').slice(0, 8) + '7';

const auth = (req, res, next) => {
  if (!req.session.uid) return res.status(401).json({ error: 'Please sign in' });
  const u = db.prepare('SELECT id, username, role, full_name, email, phone, active FROM users WHERE id=?').get(req.session.uid);
  if (!u || !u.active) { req.session.destroy(() => {}); return res.status(401).json({ error: 'Account unavailable' }); }
  req.user = u;
  if (u.role === 'teacher') req.teacher = db.prepare('SELECT * FROM teachers WHERE user_id=?').get(u.id);
  if (u.role === 'student') req.student = db.prepare('SELECT * FROM students WHERE user_id=?').get(u.id);
  next();
};
const role = (...roles) => (req, res, next) => (roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'You do not have permission to do this' }));
const notify = (userIds, title, body, link) => {
  const ins = db.prepare('INSERT INTO notifications (user_id, title, body, link) VALUES (?,?,?,?)');
  db.transaction(() => userIds.forEach((id) => ins.run(id, title, body || null, link || null)))();
};
const myTeacherSubjectIds = (t) => db.prepare('SELECT id FROM subjects WHERE teacher_id=?').all(t.id).map((r) => r.id);
const subjectIsMine = (req, subjectId) => req.user.role === 'admin' ||
  !!(req.teacher && db.prepare('SELECT 1 FROM subjects WHERE id=? AND teacher_id=?').get(subjectId, req.teacher.id));

// ---------- AUTH ----------
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again later.' } });
const DUMMY = bcrypt.hashSync('dummy-password', 10);

app.post('/api/login', loginLimiter, wrap((req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim().slice(0, 60);
  const pw = String(b.password || '').slice(0, 100);
  const wanted = ['admin', 'teacher', 'student'].includes(b.role) ? b.role : null;
  if (!username || !pw) throw bad('Enter your username and password');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (u && u.locked_until > Date.now()) {
    throw new HttpError(429, `Account temporarily locked. Try again in ${Math.ceil((u.locked_until - Date.now()) / 60000)} minute(s).`);
  }
  const ok = bcrypt.compareSync(pw, u ? u.password_hash : DUMMY);
  if (!u || !ok || !u.active || (wanted && u.role !== wanted)) {
    if (u && !ok) {
      const f = u.failed_attempts + 1;
      db.prepare('UPDATE users SET failed_attempts=?, locked_until=? WHERE id=?').run(f >= 5 ? 0 : f, f >= 5 ? Date.now() + 15 * 60000 : 0, u.id);
    }
    throw new HttpError(401, u && u.active === 0 && ok ? 'This account has been disabled' : 'Invalid credentials for this portal');
  }
  db.prepare("UPDATE users SET failed_attempts=0, locked_until=0, last_login=datetime('now') WHERE id=?").run(u.id);
  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.uid = u.id;
    log(u.id, 'login', `${u.role} signed in`);
    res.json({ ok: true, role: u.role });
  });
}));

app.post('/api/logout', (req, res) => req.session.destroy(() => { res.clearCookie('a3.sid'); res.json({ ok: true }); }));

function profileOf(req) {
  const u = req.user;
  const out = { id: u.id, username: u.username, role: u.role, full_name: u.full_name, email: u.email, phone: u.phone };
  if (u.role === 'teacher') {
    out.teacher = db.prepare(`SELECT t.id, t.qualification, t.specialization, t.bio, t.department_id, d.name AS department
      FROM teachers t LEFT JOIN departments d ON d.id=t.department_id WHERE t.id=?`).get(req.teacher.id);
  }
  if (u.role === 'student') {
    out.student = db.prepare(`SELECT s.id, s.semester, s.gender, s.dob, s.guardian_name, s.guardian_phone, s.address, s.admission_date,
      c.id AS course_id, c.name AS course, c.code AS course_code, c.duration, c.semesters, d.id AS department_id, d.name AS department
      FROM students s JOIN courses c ON c.id=s.course_id JOIN departments d ON d.id=c.department_id WHERE s.id=?`).get(req.student.id);
  }
  return out;
}
app.get('/api/me', auth, wrap((req, res) => res.json(profileOf(req))));

app.put('/api/me/profile', auth, wrap((req, res) => {
  const b = req.body || {};
  const u = req.user;
  db.transaction(() => {
    db.prepare('UPDATE users SET full_name=?, email=?, phone=? WHERE id=?')
      .run(u.role === 'student' ? u.full_name : str(b.full_name, 'Name', { max: 100 }), email(b.email), phone(b.phone), u.id);
    if (u.role === 'teacher') {
      db.prepare('UPDATE teachers SET qualification=?, specialization=?, bio=? WHERE id=?')
        .run(str(b.qualification, 'Qualification', { optional: true, max: 120 }), str(b.specialization, 'Specialization', { optional: true, max: 120 }), str(b.bio, 'Bio', { optional: true, max: 600 }), req.teacher.id);
    }
    if (u.role === 'student') {
      db.prepare('UPDATE students SET address=?, guardian_name=?, guardian_phone=? WHERE id=?')
        .run(str(b.address, 'Address', { optional: true, max: 200 }), str(b.guardian_name, 'Guardian', { optional: true, max: 100 }), phone(b.guardian_phone), req.student.id);
    }
  })();
  log(u.id, 'profile', 'Updated own profile');
  res.json({ ok: true });
}));

app.post('/api/me/password', auth, wrap((req, res) => {
  const b = req.body || {};
  const row = db.prepare('SELECT password_hash FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(String(b.current || ''), row.password_hash)) throw bad('Current password is incorrect');
  db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash(password(b.next)), req.user.id);
  log(req.user.id, 'password', 'Changed own password');
  res.json({ ok: true });
}));

// ---------- DEPARTMENTS / COURSES / SUBJECTS ----------
app.get('/api/departments', auth, wrap((req, res) => {
  res.json(db.prepare(`SELECT d.*,
    (SELECT COUNT(*) FROM courses c WHERE c.department_id=d.id) AS courses,
    (SELECT COUNT(*) FROM students s JOIN courses c ON c.id=s.course_id WHERE c.department_id=d.id) AS students,
    (SELECT COUNT(*) FROM teachers t WHERE t.department_id=d.id) AS teachers
    FROM departments d ORDER BY d.id`).all());
}));

app.get('/api/departments/:id', auth, role('admin', 'teacher', 'student'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  const d = db.prepare('SELECT * FROM departments WHERE id=?').get(id);
  if (!d) throw new HttpError(404, 'Department not found');
  const out = { department: d };
  out.courses = db.prepare('SELECT * FROM courses WHERE department_id=?').all(id);
  out.subjects = db.prepare(`SELECT sb.*, c.name AS course, u.full_name AS teacher FROM subjects sb JOIN courses c ON c.id=sb.course_id
    LEFT JOIN teachers t ON t.id=sb.teacher_id LEFT JOIN users u ON u.id=t.user_id WHERE c.department_id=? ORDER BY sb.semester, sb.name`).all(id);
  out.teachers = db.prepare(`SELECT t.id, u.full_name, u.email, t.specialization FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.department_id=?`).all(id);
  out.students = req.user.role === 'student' ? [] : db.prepare(`SELECT s.id, u.full_name, u.username AS reg_no, s.semester FROM students s JOIN users u ON u.id=s.user_id
    JOIN courses c ON c.id=s.course_id WHERE c.department_id=? ORDER BY u.full_name`).all(id);
  out.student_count = db.prepare('SELECT COUNT(*) n FROM students s JOIN courses c ON c.id=s.course_id WHERE c.department_id=?').get(id).n;
  out.notes_count = db.prepare('SELECT COUNT(*) n FROM notes n JOIN subjects sb ON sb.id=n.subject_id JOIN courses c ON c.id=sb.course_id WHERE c.department_id=?').get(id).n;
  out.attendance = attendanceOverall({ department_id: id });
  res.json(out);
}));

app.put('/api/departments/:id', auth, role('admin'), wrap((req, res) => {
  const b = req.body || {};
  const id = int(req.params.id, 'id');
  db.prepare('UPDATE departments SET description=?, head=? WHERE id=?').run(str(b.description, 'Description', { optional: true, max: 500 }), str(b.head, 'Head', { optional: true, max: 100 }), id);
  log(req.user.id, 'department', `Updated department #${id}`);
  res.json({ ok: true });
}));

app.get('/api/courses', auth, wrap((req, res) => {
  res.json(db.prepare(`SELECT c.*, d.name AS department, d.code AS department_code,
    (SELECT COUNT(*) FROM students s WHERE s.course_id=c.id) AS students,
    (SELECT COUNT(*) FROM subjects sb WHERE sb.course_id=c.id) AS subjects
    FROM courses c JOIN departments d ON d.id=c.department_id ORDER BY d.id, c.name`).all());
}));
const courseBody = (b) => ({
  department_id: int(b.department_id, 'Department', { min: 1 }), name: str(b.name, 'Course name', { max: 120 }),
  code: str(b.code, 'Course code', { max: 20 }).toUpperCase(), duration: str(b.duration, 'Duration', { optional: true, max: 40 }),
  semesters: int(b.semesters, 'Semesters', { min: 1, max: 12 }), description: str(b.description, 'Description', { optional: true, max: 500 }),
});
app.post('/api/courses', auth, role('admin'), wrap((req, res) => {
  const c = courseBody(req.body || {});
  if (!db.prepare('SELECT 1 FROM departments WHERE id=?').get(c.department_id)) throw bad('Department not found');
  try {
    const id = db.prepare('INSERT INTO courses (department_id, name, code, duration, semesters, description) VALUES (?,?,?,?,?,?)')
      .run(c.department_id, c.name, c.code, c.duration, c.semesters, c.description).lastInsertRowid;
    log(req.user.id, 'course', `Created course ${c.name}`);
    res.json({ id });
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw bad('Course code already exists'); throw e; }
}));
app.put('/api/courses/:id', auth, role('admin'), wrap((req, res) => {
  const c = courseBody(req.body || {});
  try {
    db.prepare('UPDATE courses SET department_id=?, name=?, code=?, duration=?, semesters=?, description=? WHERE id=?')
      .run(c.department_id, c.name, c.code, c.duration, c.semesters, c.description, int(req.params.id, 'id'));
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw bad('Course code already exists'); throw e; }
  log(req.user.id, 'course', `Updated course ${c.name}`);
  res.json({ ok: true });
}));
app.delete('/api/courses/:id', auth, role('admin'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  if (db.prepare('SELECT 1 FROM students WHERE course_id=?').get(id)) throw bad('Cannot delete a course that has registered students');
  removeCourseFiles(id);
  db.prepare('DELETE FROM courses WHERE id=?').run(id);
  log(req.user.id, 'course', `Deleted course #${id}`);
  res.json({ ok: true });
}));

app.get('/api/subjects', auth, wrap((req, res) => {
  const q = req.query;
  let where = ['1=1']; const p = [];
  if (req.user.role === 'teacher') { where.push('sb.teacher_id=?'); p.push(req.teacher.id); }
  if (req.user.role === 'student') { where.push('sb.course_id=?'); p.push(req.student.course_id); }
  if (q.course_id) { where.push('sb.course_id=?'); p.push(int(q.course_id, 'course')); }
  if (q.department_id) { where.push('c.department_id=?'); p.push(int(q.department_id, 'department')); }
  if (q.semester) { where.push('sb.semester=?'); p.push(int(q.semester, 'semester')); }
  res.json(db.prepare(`SELECT sb.*, c.name AS course, c.department_id, d.name AS department, u.full_name AS teacher,
    (SELECT COUNT(*) FROM students s WHERE s.course_id=sb.course_id AND s.semester=sb.semester) AS students,
    (SELECT COUNT(*) FROM notes n WHERE n.subject_id=sb.id) AS notes
    FROM subjects sb JOIN courses c ON c.id=sb.course_id JOIN departments d ON d.id=c.department_id
    LEFT JOIN teachers t ON t.id=sb.teacher_id LEFT JOIN users u ON u.id=t.user_id
    WHERE ${where.join(' AND ')} ORDER BY d.id, sb.semester, sb.name`).all(...p));
}));
const subjectBody = (b) => ({
  course_id: int(b.course_id, 'Course', { min: 1 }), name: str(b.name, 'Subject name', { max: 120 }),
  code: str(b.code, 'Subject code', { max: 20 }).toUpperCase(), semester: int(b.semester, 'Semester', { min: 1, max: 12 }),
  credits: int(b.credits === '' ? 3 : b.credits, 'Credits', { min: 0, max: 20 }), teacher_id: int(b.teacher_id, 'Teacher', { optional: true, min: 1 }),
});
const checkSubject = (s) => {
  const c = db.prepare('SELECT department_id, semesters FROM courses WHERE id=?').get(s.course_id);
  if (!c) throw bad('Course not found');
  if (s.semester > c.semesters) throw bad(`This course has only ${c.semesters} semesters`);
  if (s.teacher_id && !db.prepare('SELECT 1 FROM teachers WHERE id=?').get(s.teacher_id)) throw bad('Teacher not found');
};
app.post('/api/subjects', auth, role('admin'), wrap((req, res) => {
  const s = subjectBody(req.body || {}); checkSubject(s);
  try {
    const id = db.prepare('INSERT INTO subjects (course_id, name, code, semester, credits, teacher_id) VALUES (?,?,?,?,?,?)')
      .run(s.course_id, s.name, s.code, s.semester, s.credits, s.teacher_id).lastInsertRowid;
    log(req.user.id, 'subject', `Created subject ${s.name}`);
    res.json({ id });
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw bad('Subject code already exists'); throw e; }
}));
app.put('/api/subjects/:id', auth, role('admin'), wrap((req, res) => {
  const s = subjectBody(req.body || {}); checkSubject(s);
  try {
    db.prepare('UPDATE subjects SET course_id=?, name=?, code=?, semester=?, credits=?, teacher_id=? WHERE id=?')
      .run(s.course_id, s.name, s.code, s.semester, s.credits, s.teacher_id, int(req.params.id, 'id'));
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw bad('Subject code already exists'); throw e; }
  log(req.user.id, 'subject', `Updated subject ${s.name}`);
  res.json({ ok: true });
}));
app.delete('/api/subjects/:id', auth, role('admin'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  removeNoteFiles('SELECT stored_name FROM notes WHERE subject_id=?', id);
  db.prepare('DELETE FROM subjects WHERE id=?').run(id);
  log(req.user.id, 'subject', `Deleted subject #${id}`);
  res.json({ ok: true });
}));

function removeNoteFiles(sql, id) {
  for (const r of db.prepare(sql).all(id)) if (r.stored_name) fs.rm(path.join(UPLOAD_DIR, path.basename(r.stored_name)), { force: true }, () => {});
}
function removeCourseFiles(courseId) {
  removeNoteFiles('SELECT n.stored_name FROM notes n JOIN subjects s ON s.id=n.subject_id WHERE s.course_id=?', courseId);
}

// ---------- STUDENTS ----------
const studentSelect = `SELECT s.id, s.user_id, u.username AS reg_no, u.full_name, u.email, u.phone, u.active, s.course_id, s.semester, s.gender, s.dob,
  s.guardian_name, s.guardian_phone, s.address, s.admission_date, c.name AS course, c.code AS course_code, d.id AS department_id, d.name AS department
  FROM students s JOIN users u ON u.id=s.user_id JOIN courses c ON c.id=s.course_id JOIN departments d ON d.id=c.department_id`;

app.get('/api/students', auth, role('admin', 'teacher'), wrap((req, res) => {
  const q = req.query; const where = ['1=1']; const p = [];
  if (req.user.role === 'teacher') {
    where.push('EXISTS (SELECT 1 FROM subjects sb WHERE sb.teacher_id=? AND sb.course_id=s.course_id AND sb.semester=s.semester)'); p.push(req.teacher.id);
  }
  if (q.course_id) { where.push('s.course_id=?'); p.push(int(q.course_id, 'course')); }
  if (q.department_id) { where.push('d.id=?'); p.push(int(q.department_id, 'department')); }
  if (q.semester) { where.push('s.semester=?'); p.push(int(q.semester, 'semester')); }
  if (q.q) { where.push('(u.full_name LIKE ? OR u.username LIKE ?)'); const l = `%${String(q.q).slice(0, 50)}%`; p.push(l, l); }
  let rows = db.prepare(`${studentSelect} WHERE ${where.join(' AND ')} ORDER BY d.id, u.full_name`).all(...p);
  if (req.user.role === 'teacher') rows = rows.map(({ dob, guardian_name, guardian_phone, address, ...r }) => r);
  res.json(rows);
}));

function nextRegNo(courseId) {
  const row = db.prepare('SELECT d.code FROM courses c JOIN departments d ON d.id=c.department_id WHERE c.id=?').get(courseId);
  const year = new Date().getFullYear();
  const prefix = `A3-${row.code}-${year}-`;
  const last = db.prepare("SELECT username FROM users WHERE username LIKE ? ORDER BY username DESC LIMIT 1").get(prefix + '%');
  const n = last ? parseInt(last.username.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}
const studentBody = (b) => ({
  full_name: str(b.full_name, 'Full name', { max: 100 }), email: email(b.email), phone: phone(b.phone),
  course_id: int(b.course_id, 'Course', { min: 1 }), semester: int(b.semester, 'Semester', { min: 1, max: 12 }),
  gender: oneOf(b.gender, 'Gender', ['male', 'female'], true), dob: date(b.dob, 'Date of birth', true),
  guardian_name: str(b.guardian_name, 'Guardian', { optional: true, max: 100 }), guardian_phone: phone(b.guardian_phone),
  address: str(b.address, 'Address', { optional: true, max: 200 }),
});
const checkCourseSem = (courseId, sem) => {
  const c = db.prepare('SELECT semesters FROM courses WHERE id=?').get(courseId);
  if (!c) throw bad('Course not found');
  if (sem > c.semesters) throw bad(`This course has only ${c.semesters} semesters`);
};

app.post('/api/students', auth, role('admin'), wrap((req, res) => {
  const s = studentBody(req.body || {}); checkCourseSem(s.course_id, s.semester);
  const pw = req.body.password ? password(req.body.password) : genPassword();
  const result = db.transaction(() => {
    const reg = nextRegNo(s.course_id);
    const uid = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email, phone) VALUES (?,?,'student',?,?,?)")
      .run(reg, hash(pw), s.full_name, s.email, s.phone).lastInsertRowid;
    const id = db.prepare('INSERT INTO students (user_id, course_id, semester, gender, dob, guardian_name, guardian_phone, address) VALUES (?,?,?,?,?,?,?,?)')
      .run(uid, s.course_id, s.semester, s.gender, s.dob, s.guardian_name, s.guardian_phone, s.address).lastInsertRowid;
    notify([uid], 'Welcome to A3 College', 'Your student account is ready. Check announcements and your course notes.');
    log(req.user.id, 'student', `Registered student ${s.full_name} (${reg})`);
    return { id, reg_no: reg };
  })();
  res.json({ ...result, password: pw });
}));
app.put('/api/students/:id', auth, role('admin'), wrap((req, res) => {
  const s = studentBody(req.body || {}); checkCourseSem(s.course_id, s.semester);
  const id = int(req.params.id, 'id');
  const st = db.prepare('SELECT user_id FROM students WHERE id=?').get(id);
  if (!st) throw new HttpError(404, 'Student not found');
  db.transaction(() => {
    db.prepare('UPDATE users SET full_name=?, email=?, phone=? WHERE id=?').run(s.full_name, s.email, s.phone, st.user_id);
    db.prepare('UPDATE students SET course_id=?, semester=?, gender=?, dob=?, guardian_name=?, guardian_phone=?, address=? WHERE id=?')
      .run(s.course_id, s.semester, s.gender, s.dob, s.guardian_name, s.guardian_phone, s.address, id);
  })();
  log(req.user.id, 'student', `Updated student ${s.full_name}`);
  res.json({ ok: true });
}));
app.delete('/api/students/:id', auth, role('admin'), wrap((req, res) => {
  const st = db.prepare('SELECT s.user_id, u.full_name FROM students s JOIN users u ON u.id=s.user_id WHERE s.id=?').get(int(req.params.id, 'id'));
  if (!st) throw new HttpError(404, 'Student not found');
  db.prepare('DELETE FROM users WHERE id=?').run(st.user_id);
  log(req.user.id, 'student', `Deleted student ${st.full_name}`);
  res.json({ ok: true });
}));

// ---------- TEACHERS ----------
const teacherSelect = `SELECT t.id, t.user_id, u.username AS staff_no, u.full_name, u.email, u.phone, u.active, t.department_id, d.name AS department,
  t.qualification, t.specialization, (SELECT COUNT(*) FROM subjects sb WHERE sb.teacher_id=t.id) AS subjects
  FROM teachers t JOIN users u ON u.id=t.user_id LEFT JOIN departments d ON d.id=t.department_id`;
app.get('/api/teachers', auth, role('admin', 'teacher', 'student'), wrap((req, res) => {
  const rows = db.prepare(`${teacherSelect} ORDER BY t.department_id, u.full_name`).all();
  res.json(req.user.role === 'admin' ? rows : rows.map(({ id, full_name, department, department_id, specialization, qualification }) => ({ id, full_name, department, department_id, specialization, qualification })));
}));
const teacherBody = (b) => ({
  full_name: str(b.full_name, 'Full name', { max: 100 }), email: email(b.email), phone: phone(b.phone),
  department_id: int(b.department_id, 'Department', { min: 1 }),
  qualification: str(b.qualification, 'Qualification', { optional: true, max: 120 }), specialization: str(b.specialization, 'Specialization', { optional: true, max: 120 }),
});
app.post('/api/teachers', auth, role('admin'), wrap((req, res) => {
  const t = teacherBody(req.body || {});
  const d = db.prepare('SELECT code FROM departments WHERE id=?').get(t.department_id);
  if (!d) throw bad('Department not found');
  const pw = req.body.password ? password(req.body.password) : genPassword();
  const out = db.transaction(() => {
    const prefix = `T-${d.code}-`;
    const last = db.prepare('SELECT username FROM users WHERE username LIKE ? ORDER BY username DESC LIMIT 1').get(prefix + '%');
    const staff = prefix + String((last ? parseInt(last.username.slice(prefix.length), 10) : 0) + 1).padStart(3, '0');
    const uid = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email, phone) VALUES (?,?,'teacher',?,?,?)")
      .run(staff, hash(pw), t.full_name, t.email, t.phone).lastInsertRowid;
    const id = db.prepare('INSERT INTO teachers (user_id, department_id, qualification, specialization) VALUES (?,?,?,?)')
      .run(uid, t.department_id, t.qualification, t.specialization).lastInsertRowid;
    log(req.user.id, 'teacher', `Added teacher ${t.full_name} (${staff})`);
    return { id, staff_no: staff };
  })();
  res.json({ ...out, password: pw });
}));
app.put('/api/teachers/:id', auth, role('admin'), wrap((req, res) => {
  const t = teacherBody(req.body || {});
  if (!db.prepare('SELECT 1 FROM departments WHERE id=?').get(t.department_id)) throw bad('Department not found');
  const id = int(req.params.id, 'id');
  const row = db.prepare('SELECT user_id FROM teachers WHERE id=?').get(id);
  if (!row) throw new HttpError(404, 'Teacher not found');
  db.transaction(() => {
    db.prepare('UPDATE users SET full_name=?, email=?, phone=? WHERE id=?').run(t.full_name, t.email, t.phone, row.user_id);
    db.prepare('UPDATE teachers SET department_id=?, qualification=?, specialization=? WHERE id=?').run(t.department_id, t.qualification, t.specialization, id);
  })();
  log(req.user.id, 'teacher', `Updated teacher ${t.full_name}`);
  res.json({ ok: true });
}));
app.delete('/api/teachers/:id', auth, role('admin'), wrap((req, res) => {
  const row = db.prepare('SELECT t.user_id, u.full_name FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.id=?').get(int(req.params.id, 'id'));
  if (!row) throw new HttpError(404, 'Teacher not found');
  db.prepare('DELETE FROM users WHERE id=?').run(row.user_id); // subjects.teacher_id -> NULL
  log(req.user.id, 'teacher', `Deleted teacher ${row.full_name}`);
  res.json({ ok: true });
}));

// ---------- ACCOUNTS (admin) ----------
app.get('/api/accounts', auth, role('admin'), wrap((req, res) => {
  const p = []; const where = ['1=1'];
  if (['admin', 'teacher', 'student'].includes(req.query.role)) { where.push('role=?'); p.push(req.query.role); }
  if (req.query.q) { where.push('(full_name LIKE ? OR username LIKE ?)'); const l = `%${String(req.query.q).slice(0, 50)}%`; p.push(l, l); }
  res.json(db.prepare(`SELECT id, username, role, full_name, email, active, last_login, created_at FROM users WHERE ${where.join(' AND ')} ORDER BY role, full_name LIMIT 500`).all(...p));
}));
app.post('/api/accounts/:id/password', auth, role('admin'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  const pw = req.body && req.body.password ? password(req.body.password) : genPassword();
  const u = db.prepare('SELECT username FROM users WHERE id=?').get(id);
  if (!u) throw new HttpError(404, 'User not found');
  db.prepare('UPDATE users SET password_hash=?, failed_attempts=0, locked_until=0 WHERE id=?').run(hash(pw), id);
  log(req.user.id, 'account', `Reset password for ${u.username}`);
  res.json({ ok: true, password: pw });
}));
app.post('/api/accounts/:id/active', auth, role('admin'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  if (id === req.user.id) throw bad('You cannot disable your own account');
  const active = req.body && req.body.active ? 1 : 0;
  const u = db.prepare('SELECT username FROM users WHERE id=?').get(id);
  if (!u) throw new HttpError(404, 'User not found');
  db.prepare('UPDATE users SET active=? WHERE id=?').run(active, id);
  if (!active) db.prepare("DELETE FROM sessions WHERE json_extract(sess,'$.uid')=?").run(id);
  log(req.user.id, 'account', `${active ? 'Enabled' : 'Disabled'} account ${u.username}`);
  res.json({ ok: true });
}));
app.post('/api/admins', auth, role('admin'), wrap((req, res) => {
  const b = req.body || {};
  const username = str(b.username, 'Username', { min: 4, max: 40 });
  if (!/^[A-Za-z0-9._-]+$/.test(username)) throw bad('Username may only contain letters, numbers, dot, dash and underscore');
  const pw = password(b.password);
  try {
    const id = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email, phone) VALUES (?,?,'admin',?,?,?)")
      .run(username, hash(pw), str(b.full_name, 'Full name', { max: 100 }), email(b.email), phone(b.phone)).lastInsertRowid;
    db.prepare('INSERT INTO admins (user_id) VALUES (?)').run(id);
    log(req.user.id, 'account', `Created administrator ${username}`);
    res.json({ id });
  } catch (e) { if (String(e.message).includes('UNIQUE')) throw bad('Username already exists'); throw e; }
}));
app.delete('/api/accounts/:id', auth, role('admin'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  const u = db.prepare('SELECT role, username FROM users WHERE id=?').get(id);
  if (!u) throw new HttpError(404, 'User not found');
  if (u.role !== 'admin') throw bad('Delete students and teachers from their own pages');
  if (id === req.user.id) throw bad('You cannot delete your own account');
  db.prepare('DELETE FROM users WHERE id=?').run(id);
  log(req.user.id, 'account', `Deleted administrator ${u.username}`);
  res.json({ ok: true });
}));

// ---------- ATTENDANCE ----------
const STATUSES = ['present', 'absent', 'late'];

function sheetStudents(subject) {
  return db.prepare(`SELECT s.id, u.full_name, u.username AS reg_no FROM students s JOIN users u ON u.id=s.user_id
    WHERE s.course_id=? AND s.semester=? AND u.active=1 ORDER BY u.full_name`).all(subject.course_id, subject.semester);
}
app.get('/api/attendance/sheet', auth, role('admin', 'teacher'), wrap((req, res) => {
  const subjectId = int(req.query.subject_id, 'Subject', { min: 1 });
  const d = date(req.query.date, 'Date');
  if (!subjectIsMine(req, subjectId)) throw new HttpError(403, 'You can only manage attendance for your assigned subjects');
  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subjectId);
  if (!subject) throw new HttpError(404, 'Subject not found');
  const existing = new Map(db.prepare('SELECT student_id, status FROM attendance WHERE subject_id=? AND date=?').all(subjectId, d).map((r) => [r.student_id, r.status]));
  res.json({ subject, date: d, saved: existing.size > 0, students: sheetStudents(subject).map((s) => ({ ...s, status: existing.get(s.id) || null })) });
}));
app.post('/api/attendance', auth, role('admin', 'teacher'), wrap((req, res) => {
  const b = req.body || {};
  const subjectId = int(b.subject_id, 'Subject', { min: 1 });
  const d = date(b.date, 'Date');
  if (d > new Date(Date.now() + 86400000).toISOString().slice(0, 10)) throw bad('Cannot mark attendance for a future date');
  if (!subjectIsMine(req, subjectId)) throw new HttpError(403, 'You can only manage attendance for your assigned subjects');
  const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subjectId);
  if (!subject) throw new HttpError(404, 'Subject not found');
  if (!Array.isArray(b.records) || b.records.length > 500) throw bad('Invalid attendance records');
  const valid = new Set(sheetStudents(subject).map((s) => s.id));
  const up = db.prepare(`INSERT INTO attendance (student_id, subject_id, date, status, marked_by) VALUES (?,?,?,?,?)
    ON CONFLICT(student_id, subject_id, date) DO UPDATE SET status=excluded.status, marked_by=excluded.marked_by, updated_at=datetime('now')`);
  let n = 0;
  db.transaction(() => {
    for (const r of b.records) {
      const sid = int(r.student_id, 'Student', { min: 1 });
      if (!valid.has(sid)) throw bad('A student in the list is not enrolled in this subject');
      up.run(sid, subjectId, d, oneOf(r.status, 'Status', STATUSES), req.user.id); n++;
    }
  })();
  log(req.user.id, 'attendance', `Marked ${n} students for ${subject.name} on ${d}`);
  res.json({ ok: true, saved: n });
}));

function attendanceFilters(req) {
  const q = req.query; const where = ['1=1']; const p = [];
  if (req.user.role === 'student') { where.push('a.student_id=?'); p.push(req.student.id); }
  if (req.user.role === 'teacher') { where.push('sb.teacher_id=?'); p.push(req.teacher.id); }
  if (q.subject_id) { where.push('a.subject_id=?'); p.push(int(q.subject_id, 'subject')); }
  if (q.student_id && req.user.role !== 'student') { where.push('a.student_id=?'); p.push(int(q.student_id, 'student')); }
  if (q.department_id) { where.push('c.department_id=?'); p.push(int(q.department_id, 'department')); }
  if (q.course_id) { where.push('sb.course_id=?'); p.push(int(q.course_id, 'course')); }
  if (q.status) { where.push('a.status=?'); p.push(oneOf(q.status, 'status', STATUSES)); }
  if (q.from) { where.push('a.date>=?'); p.push(date(q.from, 'from')); }
  if (q.to) { where.push('a.date<=?'); p.push(date(q.to, 'to')); }
  return { where: where.join(' AND '), p };
}
const ATT_FROM = `FROM attendance a JOIN students s ON s.id=a.student_id JOIN users u ON u.id=s.user_id
  JOIN subjects sb ON sb.id=a.subject_id JOIN courses c ON c.id=sb.course_id JOIN departments d ON d.id=c.department_id`;
const attRecords = (req, limit) => {
  const f = attendanceFilters(req);
  return db.prepare(`SELECT a.date, u.full_name AS student, u.username AS reg_no, sb.name AS subject, c.name AS course, d.name AS department, a.status
    ${ATT_FROM} WHERE ${f.where} ORDER BY a.date DESC, u.full_name LIMIT ${limit}`).all(...f.p);
};
const attSummary = (req) => {
  const f = attendanceFilters(req);
  return db.prepare(`SELECT s.id AS student_id, u.full_name AS student, u.username AS reg_no, d.name AS department, sb.name AS subject,
    COUNT(*) AS total, SUM(a.status='present') AS present, SUM(a.status='absent') AS absent, SUM(a.status='late') AS late,
    ROUND(100.0*SUM(a.status!='absent')/COUNT(*),1) AS percentage
    ${ATT_FROM} WHERE ${f.where} GROUP BY s.id, sb.id ORDER BY u.full_name, sb.name`).all(...f.p);
};
app.get('/api/attendance/records', auth, wrap((req, res) => res.json(attRecords(req, 1000))));
app.get('/api/attendance/summary', auth, wrap((req, res) => res.json(attSummary(req))));

function attendanceOverall(filter = {}) {
  const where = ['1=1']; const p = [];
  if (filter.department_id) { where.push('c.department_id=?'); p.push(filter.department_id); }
  if (filter.date) { where.push('a.date=?'); p.push(filter.date); }
  const r = db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(a.status='present'),0) present, COALESCE(SUM(a.status='absent'),0) absent, COALESCE(SUM(a.status='late'),0) late
    ${ATT_FROM} WHERE ${where.join(' AND ')}`).get(...p);
  return { ...r, percentage: r.total ? Math.round((1000 * (r.present + r.late)) / r.total) / 10 : null };
}

app.get('/api/attendance/export', auth, wrap(async (req, res) => {
  const kind = req.query.kind === 'records' ? 'records' : 'summary';
  const format = req.query.format === 'pdf' ? 'pdf' : 'xlsx';
  const rows = kind === 'records' ? attRecords(req, 20000) : attSummary(req);
  const cols = kind === 'records'
    ? [['Date', 'date', 12], ['Reg No', 'reg_no', 20], ['Student', 'student', 24], ['Subject', 'subject', 26], ['Status', 'status', 10]]
    : [['Reg No', 'reg_no', 20], ['Student', 'student', 24], ['Subject', 'subject', 26], ['Total', 'total', 8], ['Present', 'present', 9], ['Late', 'late', 7], ['Absent', 'absent', 9], ['Attend %', 'percentage', 10]];
  const title = kind === 'records' ? 'Attendance Records' : 'Attendance Summary';
  log(req.user.id, 'export', `Exported ${title} as ${format}`);
  const fname = `a3-${kind}-${new Date().toISOString().slice(0, 10)}.${format}`;
  if (format === 'xlsx') {
    const wb = new ExcelJS.Workbook(); wb.creator = 'A3 College Management System';
    const ws = wb.addWorksheet(title);
    ws.columns = cols.map(([h, k, w]) => ({ header: h, key: k, width: w }));
    rows.forEach((r) => ws.addRow(r));
    const head = ws.getRow(1); head.font = { bold: true, color: { argb: 'FF04130D' } };
    head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF34D399' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    await wb.xlsx.write(res); return res.end();
  }
  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: kind === 'summary' ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  doc.pipe(res);
  const W = doc.page.width - 72; const tot = cols.reduce((a, c) => a + c[2], 0);
  const widths = cols.map((c) => (c[2] / tot) * W);
  const header = () => {
    doc.rect(36, 30, W, 46).fill('#07140f');
    doc.fillColor('#34d399').font('Helvetica-Bold').fontSize(16).text('A3 COLLEGE MANAGEMENT SYSTEM', 48, 40);
    doc.fillColor('#d1fae5').font('Helvetica').fontSize(10).text(`${title}  |  Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}  |  ${rows.length} rows`, 48, 60);
    doc.y = 90;
  };
  const rowDraw = (vals, bold, fill) => {
    const y = doc.y; const h = 18;
    if (y + h > doc.page.height - 40) { doc.addPage(); header(); return rowDraw(vals, bold, fill); }
    if (fill) doc.rect(36, y, W, h).fill(fill);
    let x = 36; doc.fillColor(bold ? '#04130d' : '#111').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5);
    vals.forEach((v, i) => { doc.text(String(v ?? ''), x + 4, y + 5, { width: widths[i] - 8, height: 12, ellipsis: true, lineBreak: false }); x += widths[i]; });
    doc.y = y + h;
  };
  header();
  rowDraw(cols.map((c) => c[0]), true, '#34d399');
  rows.forEach((r, i) => rowDraw(cols.map((c) => (c[1] === 'percentage' && r[c[1]] != null ? r[c[1]] + '%' : r[c[1]])), false, i % 2 ? '#ecfdf5' : null));
  if (!rows.length) { doc.fillColor('#555').text('No records match the selected filters.', 40, doc.y + 8); }
  doc.end();
}));

// ---------- ANNOUNCEMENTS ----------
const annVisibleSql = (req) => {
  if (req.user.role === 'admin') return { where: '1=1', p: [] };
  if (req.user.role === 'student') {
    return { where: `(a.scope='all' OR (a.scope='department' AND a.department_id=?) OR (a.scope='subject' AND a.subject_id IN (SELECT id FROM subjects WHERE course_id=? AND semester=?)))`,
      p: [db.prepare('SELECT department_id FROM courses WHERE id=?').get(req.student.course_id).department_id, req.student.course_id, req.student.semester] };
  }
  return { where: `(a.scope='all' OR (a.scope='department' AND a.department_id=?) OR a.author_user_id=?)`, p: [req.teacher.department_id, req.user.id] };
};
app.get('/api/announcements', auth, wrap((req, res) => {
  const v = annVisibleSql(req); const p = [...v.p]; let where = v.where;
  if (['general', 'exam', 'important', 'academic'].includes(req.query.type)) { where += ' AND a.type=?'; p.push(req.query.type); }
  const limit = Math.min(int(req.query.limit || 100, 'limit', { min: 1, max: 200 }), 200);
  res.json(db.prepare(`SELECT a.id, a.title, a.body, a.type, a.scope, a.created_at, a.author_user_id, u.full_name AS author, u.role AS author_role,
    d.name AS department, sb.name AS subject
    FROM announcements a LEFT JOIN users u ON u.id=a.author_user_id LEFT JOIN departments d ON d.id=a.department_id LEFT JOIN subjects sb ON sb.id=a.subject_id
    WHERE ${where} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit}`).all(...p));
}));
app.post('/api/announcements', auth, role('admin', 'teacher'), wrap((req, res) => {
  const b = req.body || {};
  const title = str(b.title, 'Title', { max: 150 }); const body = str(b.body, 'Message', { max: 4000 });
  let type, scope, department_id = null, subject_id = null;
  if (req.user.role === 'admin') {
    type = oneOf(b.type, 'Type', ['general', 'exam', 'important', 'academic']);
    scope = oneOf(b.scope, 'Audience', ['all', 'department']);
    if (scope === 'department') {
      department_id = int(b.department_id, 'Department', { min: 1 });
      if (!db.prepare('SELECT 1 FROM departments WHERE id=?').get(department_id)) throw bad('Department not found');
    }
  } else {
    type = 'academic'; scope = 'subject';
    subject_id = int(b.subject_id, 'Subject', { min: 1 });
    if (!subjectIsMine(req, subject_id)) throw new HttpError(403, 'You can only announce to students of your assigned subjects');
  }
  const out = db.transaction(() => {
    const id = db.prepare('INSERT INTO announcements (title, body, type, scope, department_id, subject_id, author_user_id) VALUES (?,?,?,?,?,?,?)')
      .run(title, body, type, scope, department_id, subject_id, req.user.id).lastInsertRowid;
    let ids;
    if (scope === 'all') ids = db.prepare("SELECT id FROM users WHERE role IN ('student','teacher') AND active=1").all();
    else if (scope === 'department') ids = db.prepare(`SELECT u.id FROM students s JOIN users u ON u.id=s.user_id JOIN courses c ON c.id=s.course_id WHERE c.department_id=? AND u.active=1
      UNION SELECT u.id FROM teachers t JOIN users u ON u.id=t.user_id WHERE t.department_id=? AND u.active=1`).all(department_id, department_id);
    else { const sb = db.prepare('SELECT course_id, semester FROM subjects WHERE id=?').get(subject_id);
      ids = db.prepare('SELECT u.id FROM students s JOIN users u ON u.id=s.user_id WHERE s.course_id=? AND s.semester=? AND u.active=1').all(sb.course_id, sb.semester); }
    const targets = ids.map((r) => r.id).filter((x) => x !== req.user.id);
    notify(targets, `${type === 'exam' ? 'Exam notice' : type === 'important' ? 'Important notice' : 'New announcement'}: ${title}`, body.slice(0, 140), 'announcements');
    log(req.user.id, 'announcement', `Published "${title}" (${scope})`);
    return { id, notified: targets.length };
  })();
  res.json(out);
}));
app.delete('/api/announcements/:id', auth, role('admin', 'teacher'), wrap((req, res) => {
  const id = int(req.params.id, 'id');
  const a = db.prepare('SELECT author_user_id, title FROM announcements WHERE id=?').get(id);
  if (!a) throw new HttpError(404, 'Announcement not found');
  if (req.user.role !== 'admin' && a.author_user_id !== req.user.id) throw new HttpError(403, 'You can only delete your own announcements');
  db.prepare('DELETE FROM announcements WHERE id=?').run(id);
  log(req.user.id, 'announcement', `Deleted "${a.title}"`);
  res.json({ ok: true });
}));

// ---------- NOTES ----------
const ALLOWED = { '.pdf': 'application/pdf', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.ppt': 'application/vnd.ms-powerpoint', '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(20).toString('hex') + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => (ALLOWED[path.extname(file.originalname).toLowerCase()] ? cb(null, true) : cb(bad('Only PDF, DOC, DOCX, PPT and PPTX files are allowed'))),
});
function validMagic(file) {
  const fd = fs.openSync(file.path, 'r'); const buf = Buffer.alloc(8); fs.readSync(fd, buf, 0, 8, 0); fs.closeSync(fd);
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.pdf') return buf.slice(0, 4).toString() === '%PDF';
  if (ext === '.docx' || ext === '.pptx') return buf[0] === 0x50 && buf[1] === 0x4b;
  return buf.slice(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0])); // legacy OLE (.doc/.ppt)
}
const noteSelect = `SELECT n.id, n.title, n.description, n.kind, n.original_name, n.mime, n.size, n.created_at, n.subject_id, n.teacher_id,
  sb.name AS subject, sb.semester, c.id AS course_id, c.name AS course, d.id AS department_id, d.name AS department, u.full_name AS teacher
  FROM notes n JOIN subjects sb ON sb.id=n.subject_id JOIN courses c ON c.id=sb.course_id JOIN departments d ON d.id=c.department_id
  LEFT JOIN teachers t ON t.id=n.teacher_id LEFT JOIN users u ON u.id=t.user_id`;
function noteScope(req) {
  if (req.user.role === 'student') return { where: 'c.id=?', p: [req.student.course_id] };
  if (req.user.role === 'teacher') return { where: 'n.teacher_id=?', p: [req.teacher.id] };
  return { where: '1=1', p: [] };
}
function canSeeNote(req, noteId) {
  const s = noteScope(req);
  return db.prepare(`SELECT n.* FROM notes n JOIN subjects sb ON sb.id=n.subject_id JOIN courses c ON c.id=sb.course_id WHERE n.id=? AND ${s.where}`).get(noteId, ...s.p);
}
app.get('/api/notes', auth, wrap((req, res) => {
  const q = req.query; const s = noteScope(req); const where = [s.where]; const p = [...s.p];
  if (q.department_id) { where.push('d.id=?'); p.push(int(q.department_id, 'department')); }
  if (q.course_id) { where.push('c.id=?'); p.push(int(q.course_id, 'course')); }
  if (q.subject_id) { where.push('n.subject_id=?'); p.push(int(q.subject_id, 'subject')); }
  if (q.semester) { where.push('sb.semester=?'); p.push(int(q.semester, 'semester')); }
  if (q.q) { where.push('(n.title LIKE ? OR n.description LIKE ?)'); const l = `%${String(q.q).slice(0, 50)}%`; p.push(l, l); }
  res.json(db.prepare(`${noteSelect} WHERE ${where.join(' AND ')} ORDER BY n.created_at DESC, n.id DESC LIMIT 300`).all(...p));
}));
app.get('/api/notes/:id', auth, wrap((req, res) => {
  const n = canSeeNote(req, int(req.params.id, 'id'));
  if (!n) throw new HttpError(404, 'Note not found');
  res.json({ id: n.id, title: n.title, description: n.description, content: n.content, kind: n.kind, created_at: n.created_at });
}));
app.post('/api/notes', auth, role('teacher', 'admin'), (req, res, next) => upload.single('file')(req, res, (err) => {
  if (err) return next(err.code === 'LIMIT_FILE_SIZE' ? bad('File is too large (max 25 MB)') : err);
  next();
}), wrap((req, res) => {
  const cleanup = () => { if (req.file) fs.rm(req.file.path, { force: true }, () => {}); };
  try {
    const b = req.body || {};
    const subjectId = int(b.subject_id, 'Subject', { min: 1 });
    if (!subjectIsMine(req, subjectId)) throw new HttpError(403, 'You can only add notes to your assigned subjects');
    const subject = db.prepare('SELECT * FROM subjects WHERE id=?').get(subjectId);
    if (!subject) throw bad('Subject not found');
    const title = str(b.title, 'Title', { max: 150 }); const description = str(b.description, 'Description', { optional: true, max: 500 });
    const content = str(b.content, 'Content', { optional: true, max: 50000 });
    if (!req.file && !content) throw bad('Upload a file or write the learning material');
    if (req.file && !validMagic(req.file)) throw bad('The file content does not match its type');
    const teacherId = req.user.role === 'teacher' ? req.teacher.id : subject.teacher_id;
    const id = db.prepare('INSERT INTO notes (title, description, subject_id, teacher_id, kind, content, original_name, stored_name, mime, size) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(title, description, subjectId, teacherId, req.file ? 'file' : 'article', req.file ? null : content,
        req.file ? path.basename(req.file.originalname).slice(0, 150) : null, req.file ? req.file.filename : null,
        req.file ? ALLOWED[path.extname(req.file.originalname).toLowerCase()] : null, req.file ? req.file.size : null).lastInsertRowid;
    const ids = db.prepare('SELECT u.id FROM students s JOIN users u ON u.id=s.user_id WHERE s.course_id=? AND s.semester=? AND u.active=1').all(subject.course_id, subject.semester).map((r) => r.id);
    notify(ids, `New notes: ${title}`, `${subject.name} — new learning material is available.`, 'notes');
    log(req.user.id, 'notes', `Added notes "${title}" to ${subject.name}`);
    res.json({ id });
  } catch (e) { cleanup(); throw e; }
}));
app.get('/api/notes/:id/download', auth, wrap((req, res) => {
  const n = canSeeNote(req, int(req.params.id, 'id'));
  if (!n || n.kind !== 'file') throw new HttpError(404, 'File not found');
  const file = path.join(UPLOAD_DIR, path.basename(n.stored_name));
  if (!fs.existsSync(file)) throw new HttpError(404, 'File missing on server');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(file, n.original_name);
}));
app.delete('/api/notes/:id', auth, role('teacher', 'admin'), wrap((req, res) => {
  const n = db.prepare('SELECT * FROM notes WHERE id=?').get(int(req.params.id, 'id'));
  if (!n) throw new HttpError(404, 'Note not found');
  if (req.user.role === 'teacher' && n.teacher_id !== req.teacher.id) throw new HttpError(403, 'You can only delete your own notes');
  if (n.stored_name) fs.rm(path.join(UPLOAD_DIR, path.basename(n.stored_name)), { force: true }, () => {});
  db.prepare('DELETE FROM notes WHERE id=?').run(n.id);
  log(req.user.id, 'notes', `Deleted notes "${n.title}"`);
  res.json({ ok: true });
}));

// ---------- NOTIFICATIONS ----------
app.get('/api/notifications', auth, wrap((req, res) => {
  res.json({
    unread: db.prepare('SELECT COUNT(*) n FROM notifications WHERE user_id=? AND is_read=0').get(req.user.id).n,
    items: db.prepare('SELECT id, title, body, link, is_read, created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40').all(req.user.id),
  });
}));
app.post('/api/notifications/read', auth, wrap((req, res) => {
  const id = req.body && req.body.id;
  if (id) db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(int(id, 'id'), req.user.id);
  else db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user.id);
  res.json({ ok: true });
}));

// ---------- DASHBOARDS & REPORTS ----------
const today = () => new Date().toISOString().slice(0, 10);
app.get('/api/dashboard', auth, wrap((req, res) => {
  const u = req.user;
  if (u.role === 'admin') {
    const c = (sql) => db.prepare(sql).get().n;
    const trend = db.prepare(`SELECT date, COUNT(*) total, SUM(status!='absent') attended FROM attendance GROUP BY date ORDER BY date DESC LIMIT 7`).all().reverse()
      .map((r) => ({ date: r.date, percentage: Math.round((1000 * r.attended) / r.total) / 10 }));
    // "daily" stats: today, falling back to the most recent day with records
    const lastDay = db.prepare('SELECT MAX(date) d FROM attendance').get().d;
    const day = db.prepare('SELECT 1 FROM attendance WHERE date=? LIMIT 1').get(today()) ? today() : lastDay;
    return res.json({
      students: c('SELECT COUNT(*) n FROM students'), teachers: c('SELECT COUNT(*) n FROM teachers'), courses: c('SELECT COUNT(*) n FROM courses'),
      subjects: c('SELECT COUNT(*) n FROM subjects'), notes: c('SELECT COUNT(*) n FROM notes'),
      attendance_day: day, attendance_today: day ? attendanceOverall({ date: day }) : null, trend,
      by_department: db.prepare(`SELECT d.name, d.code, (SELECT COUNT(*) FROM students s JOIN courses c ON c.id=s.course_id WHERE c.department_id=d.id) AS students FROM departments d`).all(),
      announcements: db.prepare(`SELECT a.id, a.title, a.type, a.scope, a.created_at FROM announcements a ORDER BY a.created_at DESC, a.id DESC LIMIT 5`).all(),
      activities: db.prepare(`SELECT ac.action, ac.detail, ac.created_at, u.full_name FROM activities ac LEFT JOIN users u ON u.id=ac.user_id ORDER BY ac.id DESC LIMIT 8`).all(),
    });
  }
  if (u.role === 'teacher') {
    const subjects = db.prepare(`SELECT sb.id, sb.name, sb.code, sb.semester, c.name AS course,
      (SELECT COUNT(*) FROM students s WHERE s.course_id=sb.course_id AND s.semester=sb.semester) AS students,
      (SELECT COUNT(*) FROM notes n WHERE n.subject_id=sb.id) AS notes
      FROM subjects sb JOIN courses c ON c.id=sb.course_id WHERE sb.teacher_id=? ORDER BY sb.semester, sb.name`).all(req.teacher.id);
    const my = subjects.map((s) => s.id);
    const ph = my.map(() => '?').join(',') || 'NULL';
    const studentCount = db.prepare(`SELECT COUNT(DISTINCT s.id) n FROM students s JOIN subjects sb ON sb.course_id=s.course_id AND sb.semester=s.semester WHERE sb.teacher_id=?`).get(req.teacher.id).n;
    const att = db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(status!='absent'),0) attended FROM attendance WHERE subject_id IN (${ph})`).get(...my);
    return res.json({
      subjects, students: studentCount, notes: db.prepare('SELECT COUNT(*) n FROM notes WHERE teacher_id=?').get(req.teacher.id).n,
      attendance_percentage: att.total ? Math.round((1000 * att.attended) / att.total) / 10 : null,
      recent_notes: db.prepare(`${noteSelect} WHERE n.teacher_id=? ORDER BY n.created_at DESC LIMIT 5`).all(req.teacher.id),
    });
  }
  // student
  const sid = req.student.id;
  const overall = db.prepare(`SELECT COUNT(*) total, COALESCE(SUM(status='present'),0) present, COALESCE(SUM(status='late'),0) late, COALESCE(SUM(status='absent'),0) absent FROM attendance WHERE student_id=?`).get(sid);
  const bySubject = db.prepare(`SELECT sb.name AS subject, COUNT(*) total, SUM(a.status='present') present, SUM(a.status='late') late, SUM(a.status='absent') absent,
    ROUND(100.0*SUM(a.status!='absent')/COUNT(*),1) AS percentage FROM attendance a JOIN subjects sb ON sb.id=a.subject_id WHERE a.student_id=? GROUP BY sb.id ORDER BY sb.name`).all(sid);
  const subjects = db.prepare(`SELECT sb.name, sb.code, sb.semester, sb.credits, u.full_name AS teacher FROM subjects sb LEFT JOIN teachers t ON t.id=sb.teacher_id LEFT JOIN users u ON u.id=t.user_id
    WHERE sb.course_id=? ORDER BY sb.semester, sb.name`).all(req.student.course_id);
  res.json({
    attendance: { ...overall, percentage: overall.total ? Math.round((1000 * (overall.present + overall.late)) / overall.total) / 10 : null },
    by_subject: bySubject, subjects, notes_count: db.prepare(`SELECT COUNT(*) n FROM notes n JOIN subjects sb ON sb.id=n.subject_id WHERE sb.course_id=?`).get(req.student.course_id).n,
  });
}));

app.get('/api/reports/overview', auth, role('admin'), wrap((req, res) => {
  const departments = db.prepare('SELECT id, name, code FROM departments').all().map((d) => ({
    ...d,
    students: db.prepare('SELECT COUNT(*) n FROM students s JOIN courses c ON c.id=s.course_id WHERE c.department_id=?').get(d.id).n,
    teachers: db.prepare('SELECT COUNT(*) n FROM teachers WHERE department_id=?').get(d.id).n,
    notes: db.prepare('SELECT COUNT(*) n FROM notes n JOIN subjects sb ON sb.id=n.subject_id JOIN courses c ON c.id=sb.course_id WHERE c.department_id=?').get(d.id).n,
    attendance: attendanceOverall({ department_id: d.id }),
  }));
  const low = db.prepare(`SELECT u.full_name AS student, u.username AS reg_no, d.name AS department, COUNT(*) total,
    ROUND(100.0*SUM(a.status!='absent')/COUNT(*),1) AS percentage
    ${ATT_FROM} GROUP BY s.id HAVING percentage < 75 ORDER BY percentage ASC LIMIT 20`).all();
  const annTypes = db.prepare('SELECT type, COUNT(*) n FROM announcements GROUP BY type').all();
  res.json({ departments, low_attendance: low, announcement_types: annTypes, overall: attendanceOverall() });
}));

// ---------- static & errors ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', index: 'index.html' }));
app.use((err, req, res, next) => { // eslint-disable-line
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request' });
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});

if (require.main === module) app.listen(PORT, () => console.log(`A3 College Management System running on http://localhost:${PORT}`));
module.exports = app;
