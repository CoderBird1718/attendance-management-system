/**
 * Seeds the database with a default HR account and a couple of sample
 * employees so the app can be explored immediately after setup.
 * Run with: npm run seed
 */
const bcrypt = require('bcryptjs');
const db = require('./db');

function upsertUser({ name, email, password, role, department, designation }) {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    console.log(`- Skipping (already exists): ${email}`);
    return;
  }
  const hashed = bcrypt.hashSync(password, 10);
  db.prepare(`
    INSERT INTO users (name, email, password, role, department, designation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, email, hashed, role, department, designation);
  console.log(`- Created ${role}: ${email} / ${password}`);
}

console.log('Seeding database...');

upsertUser({
  name: 'HR Admin',
  email: 'hr@company.com',
  password: 'Hr@12345',
  role: 'hr',
  department: 'Human Resources',
  designation: 'HR Manager',
});

upsertUser({
  name: 'Asha Verma',
  email: 'asha@company.com',
  password: 'Employee@123',
  role: 'employee',
  department: 'Engineering',
  designation: 'Software Developer',
});

upsertUser({
  name: 'Rohit Sharma',
  email: 'rohit@company.com',
  password: 'Employee@123',
  role: 'employee',
  department: 'Sales',
  designation: 'Sales Executive',
});

console.log('Seeding complete.');
