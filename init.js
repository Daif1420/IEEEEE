const path = require('path');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, 'iems.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id            INTEGER PRIMARY KEY,      -- employee ID (also login username)
  emp_num       INTEGER,
  name          TEXT NOT NULL,
  education     TEXT,
  residence     TEXT,
  company       TEXT,
  shift         TEXT,
  department    TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'employee', -- 'employee' or 'admin'
  must_change_password INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS employee_summary (
  employee_id             INTEGER PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  total_achievement       REAL,
  total_target            REAL,
  percentage              REAL,
  bonus_tier              TEXT,
  unauthorized_absence    REAL,
  total_absence           REAL,
  work_nature_allowance   REAL
);

CREATE TABLE IF NOT EXISTS stage_daily (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  stage       TEXT NOT NULL,
  entry_date  TEXT NOT NULL,     -- YYYY-MM-DD
  value_num   REAL,              -- numeric value if applicable
  value_text  TEXT,              -- raw text value (e.g. 'ا' for attendance)
  UNIQUE(employee_id, stage, entry_date)
);

CREATE INDEX IF NOT EXISTS idx_stage_daily_emp ON stage_daily(employee_id);
CREATE INDEX IF NOT EXISTS idx_stage_daily_date ON stage_daily(entry_date);
CREATE INDEX IF NOT EXISTS idx_stage_daily_stage ON stage_daily(stage);

CREATE TABLE IF NOT EXISTS login_audit (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER,
  success     INTEGER NOT NULL,
  ip          TEXT,
  ts          TEXT DEFAULT (datetime('now'))
);
`);

module.exports = db;
