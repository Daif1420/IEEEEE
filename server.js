require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const db = require('./db/init');

// Auto-seed on first boot only (fresh DB with no employees yet). This lets the
// app come up ready-to-use on platforms where you can't easily run `npm run seed`
// by hand (e.g. a managed host with no shell access on the free/starter tier).
// Re-running the seed script manually later (npm run seed) still wipes and
// regenerates everything, including passwords - that's for a deliberate re-import.
const employeeCount = db.prepare('SELECT COUNT(*) AS c FROM employees').get().c;
if (employeeCount === 0) {
  console.log('No employees found in DB - running initial seed...');
  require('./db/seed');
}

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employee');
const adminRoutes = require('./routes/admin');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/employee', employeeRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`IEMS dashboard backend running on http://localhost:${PORT}`);
});
