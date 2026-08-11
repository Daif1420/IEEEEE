// Seeds the SQLite database from db/employees_source.json (extracted from the Master sheet).
// Generates a random password per employee, hashes it with bcrypt, and writes the
// plaintext credentials to db/credentials_TO_DISTRIBUTE.csv so an admin can hand them out.
// Re-running this script wipes and rebuilds the DB (fresh random passwords each time).

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./init');

const SOURCE = path.join(__dirname, 'employees_source.json');
const CSV_OUT = path.join(__dirname, 'credentials_TO_DISTRIBUTE.csv');

function randomPassword() {
  // 6-digit numeric PIN - easy for employees to type, good enough for an internal tool.
  // Swap for a stronger scheme (letters+digits) if the dashboard will be internet-facing.
  return String(Math.floor(100000 + Math.random() * 900000));
}

function main() {
  const employees = JSON.parse(fs.readFileSync(SOURCE, 'utf-8'));

  db.exec('DELETE FROM stage_daily; DELETE FROM employee_summary; DELETE FROM employees;');

  const insertEmp = db.prepare(`
    INSERT INTO employees (id, emp_num, name, education, residence, company, shift, department, password_hash, role, must_change_password)
    VALUES (@id, @emp_num, @name, @education, @residence, @company, @shift, @department, @password_hash, @role, 1)
  `);
  const insertSummary = db.prepare(`
    INSERT INTO employee_summary (employee_id, total_achievement, total_target, percentage, bonus_tier, unauthorized_absence, total_absence, work_nature_allowance)
    VALUES (@employee_id, @total_achievement, @total_target, @percentage, @bonus_tier, @unauthorized_absence, @total_absence, @work_nature_allowance)
  `);
  const insertDaily = db.prepare(`
    INSERT OR IGNORE INTO stage_daily (employee_id, stage, entry_date, value_num, value_text)
    VALUES (@employee_id, @stage, @entry_date, @value_num, @value_text)
  `);

  const csvRows = ['id,name,password,note'];
  const tx = db.transaction((emps) => {
    const usedIds = new Set();
    for (const e of emps) {
      // A few source rows have a blank/0 ID in the spreadsheet (data entry gap).
      // Give them a synthetic login ID so they can still get an account, and flag it.
      let idNote = '';
      if (!e.id || usedIds.has(e.id)) {
        e.id = 900000 + e.num;
        idNote = 'ID مفقود في الملف الأصلي - تم توليد رقم مؤقت، يُفضّل تصحيحه من HR';
      }
      usedIds.add(e.id);
      const plainPassword = randomPassword();
      const hash = bcrypt.hashSync(plainPassword, 10);

      insertEmp.run({
        id: e.id,
        emp_num: e.num,
        name: e.name,
        education: e.edu || null,
        residence: e.residence || null,
        company: e.company || null,
        shift: e.shift || null,
        department: (e.summary && e.summary['القسم']) || null,
        password_hash: hash,
        role: 'employee',
      });

      const s = e.summary || {};
      insertSummary.run({
        employee_id: e.id,
        total_achievement: s['اجمالي الانجاز'] ?? null,
        total_target: s['اجمالي التارجت'] ?? null,
        percentage: s['النسبة'] ?? null,
        bonus_tier: s['رقم شريحة المكافأه'] != null ? String(s['رقم شريحة المكافأه']) : null,
        unauthorized_absence: s[' اجمالي الغياب بدون اذن'] ?? null,
        total_absence: s['اجمالي الغياب'] ?? null,
        work_nature_allowance: s[' اجمالي بدل طبيعة العمل'] ?? null,
      });

      for (const stage of e.stages) {
        if (stage.role === 'TOTAL TARGET %') continue; // derived/summary row, not a real stage
        for (const [date, val] of Object.entries(stage.daily)) {
          const isNum = typeof val === 'number';
          insertDaily.run({
            employee_id: e.id,
            stage: stage.role,
            entry_date: date,
            value_num: isNum ? val : null,
            value_text: isNum ? null : String(val),
          });
        }
      }

      csvRows.push(`${e.id},"${e.name}",${plainPassword},"${idNote}"`);
    }
  });

  tx(employees);

  // one admin account (username: admin / id 0) who can view all employees
  const adminPass = process.env.ADMIN_PASSWORD || 'ChangeMe_' + randomPassword();
  const adminHash = bcrypt.hashSync(adminPass, 10);
  db.prepare(`
    INSERT OR REPLACE INTO employees (id, emp_num, name, education, residence, company, shift, department, password_hash, role, must_change_password)
    VALUES (0, 0, 'مدير النظام', NULL, NULL, NULL, NULL, NULL, ?, 'admin', 1)
  `).run(adminHash);
  csvRows.push(`0,"مدير النظام (admin)",${adminPass},""`);

  fs.writeFileSync(CSV_OUT, csvRows.join('\n'), 'utf-8');

  console.log(`Seeded ${employees.length} employees + 1 admin.`);
  console.log(`Plaintext credentials written to: ${CSV_OUT}`);
  console.log('IMPORTANT: distribute this file securely and delete it afterwards.');

  // Also echo to stdout so credentials are recoverable from platform logs
  // (useful on hosts where the container's disk isn't easy to download from,
  // e.g. Render/Railway without shell access on lower tiers).
  console.log('----- CREDENTIALS (also saved to CSV above) -----');
  console.log(csvRows.join('\n'));
  console.log('---------------------------------------------------');
}

main();
