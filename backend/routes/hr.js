const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate, requireRole('hr'));

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- DASHBOARD SUMMARY ----------
router.get('/dashboard', (req, res) => {
  const date = req.query.date || todayDate();

  const totalEmployees = db.prepare(`SELECT COUNT(*) c FROM users WHERE role='employee' AND is_active=1`).get().c;

  const presentToday = db.prepare(`
    SELECT COUNT(*) c FROM attendance
    WHERE date = ? AND status IN ('Present','Late')
  `).get(date).c;

  const onLeaveToday = db.prepare(`SELECT COUNT(*) c FROM attendance WHERE date = ? AND status = 'On Leave'`).get(date).c;
  const halfDayToday = db.prepare(`SELECT COUNT(*) c FROM attendance WHERE date = ? AND status = 'Half Day'`).get(date).c;
  const lateToday = db.prepare(`SELECT COUNT(*) c FROM attendance WHERE date = ? AND status = 'Late'`).get(date).c;

  const markedAbsentToday = db.prepare(`SELECT COUNT(*) c FROM attendance WHERE date = ? AND status = 'Absent'`).get(date).c;
  const markedToday = db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM attendance WHERE date = ?`).get(date).c;
  const unmarkedToday = Math.max(0, totalEmployees - markedToday);
  const absentToday = markedAbsentToday + unmarkedToday;

  res.json({
    date,
    totalEmployees,
    presentToday,
    lateToday,
    halfDayToday,
    onLeaveToday,
    absentToday,
  });
});

// ---------- LIST ALL EMPLOYEES ----------
router.get('/employees', (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, role, department, designation, leave_balance, is_active, created_at
    FROM users WHERE role = 'employee' ORDER BY name ASC
  `).all();
  res.json({ employees: rows });
});

// ---------- ADD EMPLOYEE ----------
router.post('/employees', (req, res) => {
  const { name, email, password, department, designation, leave_balance } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ message: 'An account with this email already exists.' });

  const hashed = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO users (name, email, password, role, department, designation, leave_balance)
    VALUES (?, ?, ?, 'employee', ?, ?, ?)
  `).run(name.trim(), email.toLowerCase().trim(), hashed, department || 'General', designation || 'Employee', leave_balance ?? 12);

  const user = db.prepare('SELECT id, name, email, department, designation, leave_balance FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ message: 'Employee added.', user });
});

// ---------- UPDATE EMPLOYEE (department/designation/leave balance/active) ----------
router.put('/employees/:id', (req, res) => {
  const { department, designation, leave_balance, is_active } = req.body;
  const employee = db.prepare(`SELECT * FROM users WHERE id = ? AND role='employee'`).get(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });

  db.prepare(`
    UPDATE users SET
      department = COALESCE(?, department),
      designation = COALESCE(?, designation),
      leave_balance = COALESCE(?, leave_balance),
      is_active = COALESCE(?, is_active)
    WHERE id = ?
  `).run(department ?? null, designation ?? null, leave_balance ?? null, is_active ?? null, req.params.id);

  const updated = db.prepare('SELECT id, name, email, department, designation, leave_balance, is_active FROM users WHERE id = ?').get(req.params.id);
  res.json({ message: 'Employee updated.', user: updated });
});

// ---------- DELETE (deactivate) EMPLOYEE ----------
router.delete('/employees/:id', (req, res) => {
  const employee = db.prepare(`SELECT * FROM users WHERE id = ? AND role='employee'`).get(req.params.id);
  if (!employee) return res.status(404).json({ message: 'Employee not found.' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Employee deactivated.' });
});

// ---------- ATTENDANCE RECORDS (filterable) ----------
router.get('/attendance', (req, res) => {
  const { date, from, to, user_id, status } = req.query;
  let query = `
    SELECT a.*, u.name AS employee_name, u.department
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE 1=1
  `;
  const params = [];

  if (date) { query += ' AND a.date = ?'; params.push(date); }
  if (from) { query += ' AND a.date >= ?'; params.push(from); }
  if (to) { query += ' AND a.date <= ?'; params.push(to); }
  if (user_id) { query += ' AND a.user_id = ?'; params.push(user_id); }
  if (status) { query += ' AND a.status = ?'; params.push(status); }

  query += ' ORDER BY a.date DESC, u.name ASC';
  const rows = db.prepare(query).all(...params);
  res.json({ records: rows });
});

// ---------- MARK ABSENTEES FOR A GIVEN DATE ----------
// For every active employee with no attendance row on that date, insert 'Absent' and deduct 1 leave (capped at available balance).
router.post('/mark-absentees', (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ message: 'A date is required.' });

  const employees = db.prepare(`SELECT id, leave_balance FROM users WHERE role='employee' AND is_active=1`).all();
  const already = new Set(
    db.prepare('SELECT user_id FROM attendance WHERE date = ?').all(date).map(r => r.user_id)
  );

  let markedCount = 0;
  const tx = db.transaction(() => {
    for (const emp of employees) {
      if (already.has(emp.id)) continue;
      const deduction = Math.min(1, Math.max(0, emp.leave_balance));
      db.prepare(`
        INSERT INTO attendance (user_id, date, status, leave_deducted) VALUES (?, ?, 'Absent', ?)
      `).run(emp.id, date, deduction);
      if (deduction > 0) {
        db.prepare('UPDATE users SET leave_balance = leave_balance - ? WHERE id = ?').run(deduction, emp.id);
      }
      markedCount++;
    }
  });
  tx();

  res.json({ message: `Marked ${markedCount} employee(s) absent for ${date}.` });
});

module.exports = router;
