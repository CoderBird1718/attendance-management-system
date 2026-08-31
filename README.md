# Attendify — Employee Attendance Management System

**Full-stack attendance tracking application** with automated working-hours calculation, leave deduction, and role-based dashboards for Employees and HR.

Prepared for: **MT — Developer Assignment, Inner Eye Consultancy Services LLP**

This repository contains the complete deliverable for the assignment : full source code (backend + frontend), database schema and seed scripts, environment configuration, setup instructions, and API documentation — everything required to install and run the application locally.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Database Schema](#5-database-schema)
6. [Business Rules](#6-business-rules-working-hours--leave-deduction)
7. [Prerequisites](#7-prerequisites)
8. [Setup & Run Instructions](#8-setup--run-instructions)
9. [Demo Accounts](#9-demo-accounts)
10. [API Reference](#10-api-reference)
11. [Security Notes](#11-security-notes)
12. [Project Structure](#12-project-structure)
13. [Publishing to GitHub](#13-publishing-to-github)
14. [Future Enhancements](#14-future-enhancements)

---

## 1. Overview

Attendify lets employees check in and out with a single click, automatically calculates working hours and leave deductions based on configurable business rules, and gives HR a live, org-wide view of attendance — including search, filtering, and bulk actions. The system is built as a single Node.js/Express service that serves both the REST API and the static frontend, backed by a file-based SQLite database that requires no separate installation.

## 2. Features

| Assignment Requirement | Implementation |
|---|---|
| Employee login & registration | JWT-based authentication, bcrypt-hashed passwords, self-service registration as Employee or HR |
| Attendance check-in / check-out | One-click, timestamped, one check-in/out pair per day |
| Working hours calculation | Computed automatically from check-in/out timestamps |
| Leave deduction calculation | Automatic rule engine (see §6) deducts from leave balance for half days, absences, and approved leave |
| HR dashboard | Org-wide stats, employee management, attendance search & filters, bulk "mark absentees" action |
| Employee dashboard | Live punch clock, today's status, leave balance, monthly history, self-service leave application |
| Attendance status tracking | Every day tagged **Present / Late / Half Day / On Leave / Absent** with colour-coded status indicators |

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express.js |
| Database | SQLite via `better-sqlite3` (single-file database, no server to install) |
| Authentication | JSON Web Tokens (JWT), `bcryptjs` password hashing |
| Frontend | Vanilla HTML, CSS, JavaScript (no build step required) |
| Security middleware | `helmet`, `cors`, `express-rate-limit` |

This stack was chosen deliberately for the assignment: it requires **zero external services** — no MongoDB/MySQL server and no build tooling — so the project can be cloned and running on any machine with Node.js in under two minutes, while still using a real relational schema with prepared statements.

## 4. System Architecture

```
Browser (HTML / CSS / JS)
        │  fetch() → JSON
        ▼
Express REST API   (/api/auth, /api/attendance, /api/hr)
        │  JWT middleware → role check (employee / hr)
        ▼
better-sqlite3      (backend/database/attendance.db)
```

The Express server also serves the frontend as static files, so the entire application runs from a **single process on a single port**.

## 5. Database Schema

**`users`**

| Column | Type | Notes |
|---|---|---|
| id | INTEGER (PK) | |
| name, email, password | TEXT | Password is bcrypt-hashed |
| role | TEXT | `employee` \| `hr` |
| department, designation | TEXT | |
| leave_balance | REAL | Defaults to 12 days |
| is_active | INTEGER | Soft-delete flag |

**`attendance`**

| Column | Type | Notes |
|---|---|---|
| id | INTEGER (PK) | |
| user_id | INTEGER (FK → users.id) | |
| date | TEXT | `YYYY-MM-DD`, unique per user |
| check_in, check_out | TEXT | `HH:MM:SS` |
| working_hours | REAL | Auto-calculated |
| status | TEXT | `Present` \| `Late` \| `Half Day` \| `On Leave` \| `Absent` |
| leave_deducted | REAL | Days deducted from leave balance for this record |

Both the schema definition and seed data are included as executable scripts under `backend/database/` (see [Project Structure](#12-project-structure)).

## 6. Business Rules (Working Hours & Leave Deduction)

Configurable in `backend/utils/calculations.js`:

- Shift starts at **09:30**, with a grace period until **09:45**.
- Checking in after 09:45 is flagged **Late** (still counts as a full present day if hours are met).
- **≥ 8 hours** worked → `Present` (or `Late` if arrival was late) — no leave deducted.
- **4–8 hours** worked → `Half Day` — **0.5 day** deducted from leave balance.
- **< 4 hours** worked → `Absent` — **1 day** deducted from leave balance.
- Employees can self-apply for a future date's leave (`On Leave`, 1 day deducted).
- HR can run **"Mark absentees"** for any date — every active employee without an attendance record for that date is marked `Absent`, with 1 day deducted (capped so balance never goes negative).

## 7. Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (v22 used to build and test this project)
- npm (bundled with Node.js)
- No database installation required — SQLite runs from a local file.

## 8. Setup & Run Instructions

```bash
# 1. Open the terminal
cd desktop
cd attendance-management-system

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
cp .env.example .env
# Open .env and set a real JWT_SECRET (any long random string)

# 4. Seed demo accounts and sample data
npm run seed

# 5. Start the server
npm start
```

The application is now running at **http://localhost:5000** — open that URL in your browser. The Express server serves both the API and the frontend, so nothing else needs to be started separately.

For development with auto-restart on file changes:

```bash
npm run dev
```

## 9. Demo Accounts

Created automatically by `npm run seed`:

| Role | Email | Password |
|---|---|---|
| HR Administrator | `hr@company.com` | `Hr@12345` |
| Employee | `asha@company.com` | `Employee@123` |
| Employee | `rohit@company.com` | `Employee@123` |

New accounts (either role) can also be created directly from the login page.

## 10. API Reference

All endpoints are prefixed with `/api`. Protected endpoints require the header `Authorization: Bearer <token>`.

**Auth**

| Method | Endpoint | Body |
|---|---|---|
| POST | `/auth/register` | `{ name, email, password, role, department }` |
| POST | `/auth/login` | `{ email, password }` → returns `{ token, user }` |

**Employee** *(self-service, any authenticated user)*

| Method | Endpoint | Description |
|---|---|---|
| POST | `/attendance/check-in` | Record check-in for today |
| POST | `/attendance/check-out` | Record check-out for today |
| GET | `/attendance/today` | Get today's attendance status |
| GET | `/attendance/history?month=YYYY-MM` | Monthly attendance history |
| POST | `/attendance/apply-leave` | `{ date, remarks }` |
| GET | `/attendance/me` | Current user's profile and leave balance |

**HR only** *(requires `role: hr`)*

| Method | Endpoint | Description |
|---|---|---|
| GET | `/hr/dashboard?date=YYYY-MM-DD` | Org-wide attendance summary |
| GET | `/hr/employees` | List all employees |
| POST | `/hr/employees` | Add a new employee |
| PUT | `/hr/employees/:id` | Update department, designation, leave balance, or active status |
| DELETE | `/hr/employees/:id` | Deactivate an employee (soft delete) |
| GET | `/hr/attendance?date=&from=&to=&user_id=&status=` | Search / filter attendance records |
| POST | `/hr/mark-absentees` | `{ date }` — bulk-mark absentees for a given date |

## 11. Security Notes

- Passwords are hashed with bcrypt (10 salt rounds) — never stored in plain text.
- Authentication uses short-lived (8-hour) JWTs; all attendance/HR routes verify the token and, for HR routes, the user's role server-side.
- All SQL queries use `better-sqlite3` prepared statements — no string-concatenated SQL, eliminating SQL injection risk.
- The login endpoint is rate-limited (20 attempts / 15 minutes) to reduce brute-force risk.
- `helmet` sets standard secure HTTP headers; CORS is enabled for API access.
- **Before any real deployment**, change `JWT_SECRET` in `.env` — the checked-in `.env.example` value is a placeholder only.

## 12. Project Structure

```
attendance-management-system/
├── backend/
│   ├── database/
│   │   ├── db.js            # SQLite connection + schema definition
│   │   └── seed.js          # Demo data seed script
│   ├── middleware/
│   │   └── auth.js          # JWT verification + role-based access guard
│   ├── routes/
│   │   ├── auth.js
│   │   ├── attendance.js
│   │   └── hr.js
│   ├── utils/
│   │   └── calculations.js  # Working-hours / leave-deduction rule engine
│   ├── server.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── index.html            # Login / registration
│   ├── employee.html         # Employee dashboard
│   ├── hr.html                # HR dashboard
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── api.js
│       ├── employee.js
│       └── hr.js
├── .gitignore
└── README.md
```

**Deliverables covered by this repository:**

- ✅ Complete source code — backend (Node.js/Express) and frontend (HTML/CSS/JS)
- ✅ Database scripts — schema definition (`db.js`) and seed data (`seed.js`)
- ✅ Setup instructions — see [§8](#8-setup--run-instructions)
- ✅ Environment configuration template — `.env.example`
- ✅ API documentation — see [§10](#10-api-reference)
- ✅ This README as the primary project documentation

## 13. Publishing to GitHub

```bash
git init
git add .
git commit -m "first submission"
git branch -M main
git remote add origin https://github.com/CoderBird1718/attendance-management-system.git
git push -u origin main
```

Submit the resulting repository URL — `https://github.com/CoderBird1718/attendance-management-system` — as the assignment deliverable.

> **Note:** `backend/database/attendance.db` is intentionally excluded via `.gitignore`. Anyone who clones the repository generates a fresh database by running `npm run seed`, so no personal or demo data is committed to version control.

## 14. Future Enhancements

- Multi-level leave approval workflow (currently self-service, auto-approved)
- Email notifications for late arrivals or low leave balance
- CSV / Excel export of attendance reports
- Geofenced or biometric check-in
- Automated daily cron job to run "mark absentees" instead of manual trigger
