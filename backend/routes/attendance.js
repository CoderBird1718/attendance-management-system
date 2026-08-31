const express = require('express');
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');
const { calculateWorkingHours, evaluateAttendance } = require('../utils/calculations');

const router = express.Router();
router.use(authenticate);

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function nowTime() {
  return new Date().toTimeString().slice(0, 8); // HH:MM:SS
}

// ---------- CHECK-IN ----------
router.post('/check-in', (req, res) => {
  const userId = req.user.id;
  const date = todayDate();

  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
  if (existing && existing.check_in) {
    return res.status(409).json({ message: 'You have already checked in today.' });
  }

  const time = nowTime();
  if (existing) {
    db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?').run(time, 'Present', existing.id);
  } else {
    db.prepare(`
      INSERT INTO attendance (user_id, date, check_in, status) VALUES (?, ?, ?, 'Present')
    `).run(userId, date, time);
  }
  const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
  res.json({ message: `Checked in at ${time}.`, record });
});

// ---------- CHECK-OUT ----------
router.post('/check-out', (req, res) => {
  const userId = req.user.id;
  const date = todayDate();

  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
  if (!existing || !existing.check_in) {
    return res.status(400).json({ message: 'You must check in before checking out.' });
  }
  if (existing.check_out) {
    return res.status(409).json({ message: 'You have already checked out today.' });
  }

  const time = nowTime();
  const workingHours = calculateWorkingHours(existing.check_in, time);
  const { status, leaveDeducted } = evaluateAttendance(existing.check_in, workingHours);

  const user = db.prepare('SELECT leave_balance FROM users WHERE id = ?').get(userId);
  const actualDeduction = Math.min(leaveDeducted, Math.max(0, user.leave_balance));

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE attendance
      SET check_out = ?, working_hours = ?, status = ?, leave_deducted = ?
      WHERE id = ?
    `).run(time, workingHours, status, actualDeduction, existing.id);

    if (actualDeduction > 0) {
      db.prepare('UPDATE users SET leave_balance = leave_balance - ? WHERE id = ?').run(actualDeduction, userId);
    }
  });
  tx();

  const record = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
  res.json({ message: `Checked out at ${time}. Worked ${workingHours} hours.`, record });
});

// ---------- TODAY'S STATUS ----------
router.get('/today', (req, res) => {
  const record = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(req.user.id, todayDate());
  res.json({ record: record || null });
});

// ---------- MY ATTENDANCE HISTORY ----------
router.get('/history', (req, res) => {
  const { month } = req.query; // format YYYY-MM (optional)
  let rows;
  if (month) {
    rows = db.prepare(`
      SELECT * FROM attendance WHERE user_id = ? AND date LIKE ? ORDER BY date DESC
    `).all(req.user.id, `${month}%`);
  } else {
    rows = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 60').all(req.user.id);
  }
  res.json({ records: rows });
});

// ---------- APPLY LEAVE (self-service, auto-approved) ----------
router.post('/apply-leave', (req, res) => {
  const { date, remarks } = req.body;
  if (!date) return res.status(400).json({ message: 'A date is required to apply for leave.' });

  const userId = req.user.id;
  const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?').get(userId, date);
  if (existing && existing.check_in) {
    return res.status(409).json({ message: 'Cannot apply leave on a day you already checked in.' });
  }

  const user = db.prepare('SELECT leave_balance FROM users WHERE id = ?').get(userId);
  if (user.leave_balance < 1) {
    return res.status(400).json({ message: 'Insufficient leave balance.' });
  }

  const tx = db.transaction(() => {
    if (existing) {
      db.prepare(`UPDATE attendance SET status='On Leave', leave_deducted=1, remarks=? WHERE id=?`).run(remarks || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO attendance (user_id, date, status, leave_deducted, remarks)
        VALUES (?, ?, 'On Leave', 1, ?)
      `).run(userId, date, remarks || null);
    }
    db.prepare('UPDATE users SET leave_balance = leave_balance - 1 WHERE id = ?').run(userId);
  });
  tx();

  res.json({ message: `Leave applied for ${date}.` });
});

// ---------- MY PROFILE / LEAVE BALANCE ----------
router.get('/me', (req, res) => {
  const user = db.prepare('SELECT id, name, email, role, department, designation, leave_balance, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

module.exports = router;
