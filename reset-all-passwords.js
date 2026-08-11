const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('./db/iems.db');

// الباسورد الموحد
const password = 'P@ssw0rd123';

// عمل hash
const hash = bcrypt.hashSync(password, 10);

// تحديث كل المستخدمين
const result = db.prepare(`
  UPDATE employees
  SET password_hash = ?, must_change_password = 1
`).run(hash);

console.log(`Updated all users. Rows changed: ${result.changes}`);

db.close();