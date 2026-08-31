const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../database/db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: 'Too many login attempts. Please try again later.' },
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- REGISTER ----------
router.post('/register', (req, res) => {
  const { name, email, password, role, department, designation } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Please provide a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
  }
  const safeRole = role === 'hr' ? 'hr' : 'employee';

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'An account with this email already exists.' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password, role, department, designation)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    name.trim(),
    email.toLowerCase().trim(),
    hashed,
    safeRole,
    department || 'General',
    designation || (safeRole === 'hr' ? 'HR Manager' : 'Employee')
  );

  const user = db.prepare('SELECT id, name, email, role, department, designation, leave_balance FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

  res.status(201).json({ message: 'Registration successful.', token, user });
});

// ---------- LOGIN ----------
router.post('/login', loginLimiter, (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !user.is_active) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const match = bcrypt.compareSync(password, user.password);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  const { password: _pw, ...safeUser } = user;

  res.json({ message: 'Login successful.', token, user: safeUser });
});

module.exports = router;
