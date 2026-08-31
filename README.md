# Attendify — Employee Attendance Management System

Built for: **MT — Developer Assignment, Inner Eye Consultancy Services LLP**

A full-stack web application for tracking employee attendance — check-in/check-out,
automatic working-hours and leave calculation, and separate dashboards for
Employees and HR.

---

## 1. Features

| Requirement (from assignment)   | Implementation |
|----------------------------------|-----------------|
| Employee Login & Registration    | JWT-based auth, bcrypt-hashed passwords, self-service registration as Employee or HR |
| Attendance Check-In / Check-Out  | One click, timestamped, one check-in/out pair per day |
| Working Hours Calculation        | Computed automatically from check-in/out timestamps |
| Leave Deduction Calculation      | Automatic rule engine (see §4) deducts from leave balance for half days / absences / leave |
| HR Dashboard                     | Org-wide stats, employee management, attendance search & filters, bulk "mark absentees" |
| Employee Dashboard               | Live punch clock, today's status, leave balance, monthly history, self-service leave application |
| Attendance Status Tracking       | Every day is tagged **Present / Late / Half Day / On Leave / Absent** with colour-coded status pills |

## 2. Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** SQLite via `better-sqlite3` — a single file database, **no separate database server to install**
- **Auth:** JSON Web Tokens (JWT) + `bcryptjs` password hashing
- **Frontend:** Vanilla HTML / CSS / JavaScript (no build step — open and run)
- **Security middleware:** `helmet`, `cors`, `express-rate-limit` on the login endpoint

This stack was chosen deliberately for this assignment: it needs **zero external
services** (no MongoDB/MySQL server to install, no build tooling) so it can be
cloned and run on any machine with Node.js in under two minutes, while still
using a real relational schema with prepared statements.

## 3. Architecture

```
Browser (HTML/CSS/JS)
        │  fetch() → JSON
        ▼
Express REST API  (/api/auth, /api/attendance, /api/hr)
        │  JWT middleware → role check (employee / hr)
        ▼
better-sqlite3  (backend/database/attendance.db)
```

The Express server also serves the frontend as static files, so the whole
app runs from a **single process on a single port**.

### Database schema

**users**

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| name, email, password | TEXT | password is bcrypt-hashed |
| role | TEXT | `employee` \| `hr` |
| department, designation | TEXT | |
| leave_balance | REAL | defaults to 12 days |
| is_active | INTEGER | soft-delete flag |

**attendance**

| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| user_id | INTEGER FK → users.id | |
| date | TEXT | `YYYY-MM-DD`, unique per user |
| check_in, check_out | TEXT | `HH:MM:SS` |
| working_hours | REAL | auto-calculated |
| status | TEXT | `Present` \| `Late` \| `Half Day` \| `On Leave` \| `Absent` |
| leave_deducted | REAL | days deducted from balance for this record |

## 4. Business rules (working hours & leave deduction)

Configurable in `backend/utils/calculations.js`:

- Shift starts at **09:30**; a grace period runs until **09:45**.
- Checking in after 09:45 is flagged **Late** (still counts as a full present day if hours are met).
- **≥ 8 hours** worked → `Present` (or `Late` if arrival was late) — **no leave deducted**.
- **4–8 hours** worked → `Half Day` — **0.5 day** deducted from leave balance.
- **< 4 hours** worked → `Absent` — **1 day** deducted from leave balance.
- Employees can self-apply for a future date's leave (`On Leave`, 1 day deducted).
- HR can run **"Mark absentees"** for any date — every active employee with no
  attendance record for that date is marked `Absent` and has 1 day deducted
  (capped so balance never goes negative).

## 5. Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (v22 was used to build/test this project)
- npm (comes with Node.js)
- No database installation needed — SQLite runs from a local file.

## 6. Setup & run instructions

```bash
# 1. Clone the repository
git clone <YOUR_GITHUB_REPO_URL>
cd attendance-management-system

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
cp .env.example .env
# Open .env and set a real JWT_SECRET (any long random string)

# 4. (Optional but recommended) Seed demo accounts
npm run seed

# 5. Start the server
npm start
```

The app is now running at **http://localhost:5000** — open that URL in your
browser. The Express server serves both the API and the frontend, so there is
nothing else to start.

For development with auto-restart on file changes:
```bash
npm run dev
```

### Demo accounts (created by `npm run seed`)

| Role | Email | Password |
|---|---|---|
| HR Administrator | `hr@company.com` | `Hr@12345` |
| Employee | `asha@company.com` | `Employee@123` |
| Employee | `rohit@company.com` | `Employee@123` |

You can also register new accounts (either role) directly from the login page.

## 7. API reference

All endpoints are prefixed with `/api`. Protected endpoints require
`Authorization: Bearer <token>`.

**Auth**
- `POST /auth/register` — `{ name, email, password, role, department }`
- `POST /auth/login` — `{ email, password }` → `{ token, user }`

**Employee (self-service, any logged-in user)**
- `POST /attendance/check-in`
- `POST /attendance/check-out`
- `GET  /attendance/today`
- `GET  /attendance/history?month=YYYY-MM`
- `POST /attendance/apply-leave` — `{ date, remarks }`
- `GET  /attendance/me`

**HR only** (`role: hr`)
- `GET    /hr/dashboard?date=YYYY-MM-DD`
- `GET    /hr/employees`
- `POST   /hr/employees` — add employee
- `PUT    /hr/employees/:id` — update department/designation/leave balance/active
- `DELETE /hr/employees/:id` — deactivate
- `GET    /hr/attendance?date=&from=&to=&user_id=&status=`
- `POST   /hr/mark-absentees` — `{ date }`

## 8. Security notes

- Passwords are hashed with bcrypt (10 salt rounds) — never stored in plain text.
- Authentication uses short-lived (8h) JWTs; all attendance/HR routes verify the token and, for HR routes, the user's role server-side.
- SQL queries use `better-sqlite3` prepared statements throughout — no string-concatenated SQL, so the app is not vulnerable to SQL injection.
- The login endpoint is rate-limited (20 attempts / 15 minutes) to reduce brute-force risk.
- `helmet` sets standard secure HTTP headers; CORS is enabled for API access.
- Change `JWT_SECRET` in `.env` before any real deployment — the checked-in `.env.example` value is a placeholder only.

## 9. Project structure

```
attendance-management-system/
├── backend/
│   ├── database/
│   │   ├── db.js          # SQLite connection + schema
│   │   └── seed.js        # demo data
│   ├── middleware/
│   │   └── auth.js        # JWT + role-based guard
│   ├── routes/
│   │   ├── auth.js
│   │   ├── attendance.js
│   │   └── hr.js
│   ├── utils/
│   │   └── calculations.js # working-hours / leave-deduction rules
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html          # login / registration
│   ├── employee.html       # employee dashboard
│   ├── hr.html              # HR dashboard
│   ├── css/style.css
│   └── js/{api,employee,hr}.js
├── .gitignore
└── README.md
```

## 10. Publishing to GitHub

```bash
cd attendance-management-system
git add .
git commit -m "Employee Attendance Management System - initial submission"

# Create a new empty repository on GitHub first (via github.com), then:
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

Submit the resulting repository URL (e.g.
`https://github.com/<your-username>/attendance-management-system`) as your
assignment deliverable. The `database/attendance.db` file is intentionally
excluded via `.gitignore` — anyone who clones the repo generates a fresh
database by running `npm run seed`, so no personal/demo data is committed.

## 11. Possible future enhancements

- Multi-level leave approval workflow (currently self-service, auto-approved)
- Email notifications for late arrivals / low leave balance
- CSV/Excel export of attendance reports
- Geofenced or biometric check-in
- Automated daily cron job to run "mark absentees" instead of manual trigger
