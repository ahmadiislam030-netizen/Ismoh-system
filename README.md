# A3 College Management System

Radiology · Pharmacy · Nursing · Journalism — Admin, Teacher and Student portals.

## Run
    npm install
    npm start          # http://localhost:3000

Requires Node 18+. First start creates `data/a3.db` (SQLite) and seeds the four departments, courses, subjects and the admin account.

## Admin login
Username `0610128446` · Password `Ismoh12`  (change it under *My Profile* after first login)

## Demo data
By default a few demo teachers, students, attendance and announcements are created so you can explore.
Demo logins (password `Demo1234`): teachers `T-RAD-001`, `T-PHA-001`, `T-NUR-001`, `T-JOU-001`; students like `A3-NUR-2026-001`.
**Before real use:** start with `SEED_DEMO=0 npm start` on a fresh `data/` folder (or delete the demo accounts under *User Accounts*).

## Environment variables
PORT · ADMIN_USERNAME / ADMIN_PASSWORD (first run only) · SEED_DEMO=0 · SESSION_SECRET · COOKIE_SECURE=1 (when served over HTTPS) · TRUST_PROXY=1 (behind a reverse proxy)

## Security
bcrypt hashed passwords · server-side role checks on every route · teachers limited to their assigned subjects · session cookies (httpOnly, SameSite) + CSRF header · login rate limit and 5-attempt account lockout · parameterised SQL · all input validated · uploads limited to PDF/DOC/DOCX/PPT/PPTX, content-type checked, stored outside the web root under random names and served only to authorised users · helmet CSP headers.

## Notes
Attendance % = (Present + Late) / total sessions. Students are enrolled in a subject by course + semester. Student reg. numbers (`A3-<DEPT>-<YEAR>-<NNN>`) and staff IDs (`T-<DEPT>-<NNN>`) are auto-generated; initial passwords are shown once to the admin.
Back up `data/` and `uploads/` to back up the system.
