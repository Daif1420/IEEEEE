const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./db/iems.db');

const password = 'P@ssw0rd123';
const hash = bcrypt.hashSync(password, 10);

const result = db.prepare(`
  UPDATE employees
  SET password_hash = ?, must_change_password = 0
  WHERE id = 0 AND role = 'admin'
`).run(hash);

console.log(`Updated admin password. Rows changed: ${result.changes}`);

db.close();