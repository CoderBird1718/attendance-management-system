/**
 * Database connection + schema initialization.
 * Uses SQLite via better-sqlite3 - a single file database, zero setup required.
 */
const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'attendance.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  password        TEXT NOT NULL,
  role            TEXT NOT NULL CHECK(role IN ('employee','hr')) DEFAULT 'employee',
  department      TEXT DEFAULT 'General',
  designation     TEXT DEFAULT 'Employee',
  leave_balance   REAL NOT NULL DEFAULT 12,
  is_active       INTEGER NOT NULL DEFAULT 1,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS attendance (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,                 -- YYYY-MM-DD
  check_in        TEXT,                          -- HH:MM:SS
  check_out       TEXT,                          -- HH:MM:SS
  working_hours   REAL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Absent'
                    CHECK(status IN ('Present','Late','Half Day','Absent','On Leave')),
  leave_deducted  REAL NOT NULL DEFAULT 0,
  remarks         TEXT,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
`);

module.exports = db;
