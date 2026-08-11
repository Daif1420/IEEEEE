const Database = require('better-sqlite3');
const db = new Database('./db/iems.db');

const result = db.prepare(`
  DELETE FROM employees
  WHERE role != 'admin'
`).run();

console.log(`Deleted rows: ${result.changes}`);

db.close();