'use strict';
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(process.env.DB_FILE || path.join(DATA_DIR, 'a3.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','teacher','student')),
  full_name TEXT NOT NULL,
  email TEXT, phone TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Administrator'
);
CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE,
  description TEXT, head TEXT, icon TEXT
);
CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  duration TEXT, semesters INTEGER NOT NULL DEFAULT 6, description TEXT
);
CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  qualification TEXT, specialization TEXT, bio TEXT
);
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id),
  semester INTEGER NOT NULL DEFAULT 1,
  gender TEXT, dob TEXT, guardian_name TEXT, guardian_phone TEXT, address TEXT,
  admission_date TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL, code TEXT NOT NULL UNIQUE,
  semester INTEGER NOT NULL DEFAULT 1,
  credits INTEGER NOT NULL DEFAULT 3,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late')),
  marked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (student_id, subject_id, date)
);
CREATE INDEX IF NOT EXISTS idx_att_date ON attendance(date);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, body TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('general','exam','important','academic')),
  scope TEXT NOT NULL CHECK (scope IN ('all','department','subject')),
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
  author_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL, description TEXT,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('file','article')),
  content TEXT,
  original_name TEXT, stored_name TEXT, mime TEXT, size INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT, link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
CREATE TABLE IF NOT EXISTS activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  sid TEXT PRIMARY KEY, sess TEXT NOT NULL, expires INTEGER NOT NULL
);
`);

const hash = (pw) => bcrypt.hashSync(pw, 10);
const log = (userId, action, detail) =>
  db.prepare('INSERT INTO activities (user_id, action, detail) VALUES (?,?,?)').run(userId || null, action, detail || null);

function seed() {
  // ---- Departments & courses (always ensured) ----
  if (!db.prepare('SELECT 1 FROM departments LIMIT 1').get()) {
    const D = db.prepare('INSERT INTO departments (name, code, description, head, icon) VALUES (?,?,?,?,?)');
    const C = db.prepare('INSERT INTO courses (department_id, name, code, duration, semesters, description) VALUES (?,?,?,?,?,?)');
    const S = db.prepare('INSERT INTO subjects (course_id, name, code, semester, credits) VALUES (?,?,?,?,?)');
    const depts = [
      ['Radiology Department', 'RAD', 'Medical imaging and radiographic sciences: X-ray, CT, MRI, ultrasound and radiation safety.', 'radiology',
        ['Diploma in Medical Radiology', 'DMR', '3 years', 6, 'Hands-on training in diagnostic imaging and patient care.'],
        [['Anatomy & Physiology', 1], ['Radiographic Physics', 1], ['Radiation Protection', 2], ['Radiographic Positioning', 2], ['CT & MRI Techniques', 3], ['Ultrasound Imaging', 4]]],
      ['Pharmacy Department', 'PHA', 'Pharmaceutical sciences, dispensing, pharmacology and clinical pharmacy practice.', 'pharmacy',
        ['Diploma in Pharmacy', 'DPH', '3 years', 6, 'Comprehensive training in medicines, dispensing and pharmacy practice.'],
        [['Pharmaceutics I', 1], ['Pharmaceutical Chemistry', 1], ['Pharmacology I', 2], ['Pharmacognosy', 2], ['Clinical Pharmacy', 3], ['Pharmacy Law & Ethics', 4]]],
      ['Nursing Department', 'NUR', 'Professional nursing education covering patient care, community health and clinical practice.', 'nursing',
        ['Diploma in Nursing', 'DNU', '3 years', 6, 'Clinical and theoretical nursing education for compassionate healthcare professionals.'],
        [['Fundamentals of Nursing', 1], ['Anatomy & Physiology', 1], ['Medical-Surgical Nursing', 2], ['Community Health Nursing', 2], ['Maternal & Child Health', 3], ['Mental Health Nursing', 4]]],
      ['Journalism Department', 'JOU', 'Modern media, reporting, broadcasting, digital storytelling and media ethics.', 'journalism',
        ['Diploma in Journalism & Mass Communication', 'DJM', '2 years', 4, 'Practical newsroom skills across print, broadcast and digital media.'],
        [['Introduction to Journalism', 1], ['News Writing & Reporting', 1], ['Media Law & Ethics', 2], ['Broadcast Journalism', 2], ['Digital & Social Media', 3], ['Investigative Reporting', 4]]],
    ];
    db.transaction(() => {
      for (const [name, code, desc, icon, c, subs] of depts) {
        const d = D.run(name, code, desc, null, icon).lastInsertRowid;
        const cid = C.run(d, c[0], c[1], c[2], c[3], c[4]).lastInsertRowid;
        subs.forEach(([sn, sem], i) => S.run(cid, sn, `${c[1]}-${sem}0${i + 1}`, sem, 3));
      }
    })();
  }

  // ---- Default admin ----
  if (!db.prepare("SELECT 1 FROM users WHERE role='admin' LIMIT 1").get()) {
    const u = process.env.ADMIN_USERNAME || '0610128446';
    const p = process.env.ADMIN_PASSWORD || 'Ismoh12';
    const id = db.prepare("INSERT INTO users (username, password_hash, role, full_name) VALUES (?,?, 'admin', ?)")
      .run(u, hash(p), 'System Administrator').lastInsertRowid;
    db.prepare('INSERT INTO admins (user_id, title) VALUES (?, ?)').run(id, 'Super Administrator');
    log(id, 'system', 'Default administrator account created');
  }

  // ---- Optional demo data (SEED_DEMO=0 to disable) ----
  if (process.env.SEED_DEMO !== '0' && !db.prepare("SELECT 1 FROM users WHERE role='teacher' LIMIT 1").get()) seedDemo();
}

function seedDemo() {
  const demoPw = hash('Demo1234');
  const depts = db.prepare('SELECT d.id, d.code, c.id AS course_id FROM departments d JOIN courses c ON c.department_id=d.id').all();
  const T = [
    ['RAD', 'Dr. Amina Yusuf', 'MSc Medical Imaging', 'CT & MRI'],
    ['PHA', 'Dr. Daniel Mwangi', 'PharmD', 'Clinical Pharmacy'],
    ['NUR', 'Sr. Grace Achieng', 'BSc Nursing', 'Community Health'],
    ['JOU', 'Mr. Hassan Warsame', 'MA Mass Communication', 'Broadcast & Digital Media'],
  ];
  const names = [
    ['Fatuma Ali', 'female'], ['Omar Hussein', 'male'], ['Zainab Noor', 'female'],
    ['Abdi Rahman', 'male'], ['Halima Abdi', 'female'], ['Yusuf Ibrahim', 'male'],
    ['Mariam Said', 'female'], ['Ahmed Warsame', 'male'], ['Hawa Mohamed', 'female'],
    ['Ismail Farah', 'male'], ['Sofia Juma', 'female'], ['Khalid Osman', 'male'],
  ];
  const tx = db.transaction(() => {
    const UI = db.prepare("INSERT INTO users (username, password_hash, role, full_name, email, phone) VALUES (?,?,?,?,?,?)");
    const TI = db.prepare('INSERT INTO teachers (user_id, department_id, qualification, specialization) VALUES (?,?,?,?)');
    const SI = db.prepare('INSERT INTO students (user_id, course_id, semester, gender, admission_date) VALUES (?,?,?,?,?)');
    const teacherByDept = {};
    T.forEach(([code, name, qual, spec], i) => {
      const d = depts.find((x) => x.code === code);
      const uid = UI.run(`T-${code}-001`, demoPw, 'teacher', name, `${code.toLowerCase()}.teacher@a3college.edu`, `+254700000${i}0${i}`).lastInsertRowid;
      const tid = TI.run(uid, d.id, qual, spec).lastInsertRowid;
      teacherByDept[code] = tid;
      db.prepare('UPDATE subjects SET teacher_id=? WHERE course_id=?').run(tid, d.course_id);
      db.prepare('UPDATE departments SET head=? WHERE id=?').run(name, d.id);
    });
    const counters = {};
    names.forEach(([name, gender], i) => {
      const d = depts[i % 4];
      counters[d.code] = (counters[d.code] || 0) + 1;
      const reg = `A3-${d.code}-2026-${String(counters[d.code]).padStart(3, '0')}`;
      const uid = UI.run(reg, demoPw, 'student', name, `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@student.a3college.edu`, `+25471100${String(i).padStart(4, '0')}`).lastInsertRowid;
      SI.run(uid, d.course_id, 1, gender, '2026-09-01');
    });

    // attendance for the last 10 weekdays in semester-1 subjects
    const rows = db.prepare(`SELECT st.id AS student_id, sb.id AS subject_id, t.user_id AS marker
      FROM students st JOIN subjects sb ON sb.course_id = st.course_id AND sb.semester = st.semester
      JOIN teachers t ON t.id = sb.teacher_id`).all();
    const AI = db.prepare('INSERT OR IGNORE INTO attendance (student_id, subject_id, date, status, marked_by) VALUES (?,?,?,?,?)');
    const days = [];
    for (let k = 0; days.length < 10; k++) {
      const d = new Date(Date.now() - k * 86400000);
      if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
    }
    let seedN = 7;
    const rnd = () => { seedN = (seedN * 9301 + 49297) % 233280; return seedN / 233280; };
    for (const r of rows) for (const day of days) {
      const x = rnd();
      AI.run(r.student_id, r.subject_id, day, x < 0.78 ? 'present' : x < 0.88 ? 'late' : 'absent', r.marker);
    }

    const admin = db.prepare("SELECT id FROM users WHERE role='admin' LIMIT 1").get().id;
    const A = db.prepare('INSERT INTO announcements (title, body, type, scope, department_id, author_user_id) VALUES (?,?,?,?,?,?)');
    A.run('Welcome to A3 College', 'Welcome to the new academic term. Please check your timetable and attend all orientation sessions. We wish every student a successful semester.', 'general', 'all', null, admin);
    A.run('Mid-Semester Examinations', 'Mid-semester examinations begin in three weeks. The detailed timetable will be posted on the notice board and in this portal.', 'exam', 'all', null, admin);
    A.run('Clinical Placement Briefing', 'All Nursing, Radiology and Pharmacy students must attend the compulsory clinical placement briefing on Monday at 9:00 AM.', 'important', 'department', depts.find((x) => x.code === 'NUR').id, admin);
    log(admin, 'system', 'Demo data loaded');
  });
  tx();
}

seed();
module.exports = { db, hash, log, bcrypt };
