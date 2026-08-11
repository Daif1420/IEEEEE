const token = sessionStorage.getItem('iems_token');
const userRaw = sessionStorage.getItem('iems_user');
if (!token || !userRaw) window.location.href = '/index.html';
const user = JSON.parse(userRaw);
if (user.role !== 'admin') window.location.href = '/dashboard.html';

const $ = id => document.getElementById(id);
function authHeaders() { return { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }; }
async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { ...authHeaders(), ...(opts.headers || {}) } });
  if (res.status === 401) { sessionStorage.clear(); window.location.href = '/index.html'; throw new Error('انتهت الجلسة'); }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'حدث خطأ');
  return data;
}
function escapeHtml(v) { return String(v ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }
function fmtNumber(v) { return Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }

// Theme
const savedTheme = localStorage.getItem('iems-theme') || 'dark';
document.documentElement.dataset.theme = savedTheme;
function updateThemeIcon() { $('theme-toggle').textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾'; }
$('theme-toggle').addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('iems-theme', next);
  updateThemeIcon();
});
updateThemeIcon();

$('chip-name').textContent = user.name;
$('chip-role').textContent = `ID: ${user.id} · مدير`;
$('chip-avatar').textContent = (user.name || '?').trim()[0] || '?';
$('logout-btn').addEventListener('click', () => { sessionStorage.clear(); window.location.href = '/index.html'; });

let allEmployees = [];

function renderTable(list) {
  $('emp-count').textContent = `${list.length} موظف`;
  if (!list.length) { $('emp-table-body').innerHTML = '<tr><td colspan="7"><div class="empty-state">لا توجد نتائج.</div></td></tr>'; return; }
  $('emp-table-body').innerHTML = list.map(e => `
    <tr data-id="${escapeHtml(e.id)}">
      <td>${escapeHtml(e.id)}</td>
      <td class="emp-name-cell">${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.company || '—')}</td>
      <td>${escapeHtml(e.shift || '—')}</td>
      <td>${escapeHtml(e.department || '—')}</td>
      <td>${escapeHtml(e.education || '—')}</td>
      <td class="emp-actions-cell">
        <button class="row-icon-btn info-btn" data-action="view" title="عرض بيانات الموظف كما تظهر له">ⓘ</button>
        <button class="row-icon-btn" data-action="edit" title="تعديل الـID / الاسم">✎</button>
        <button class="row-icon-btn" data-action="pw" title="تغيير كلمة المرور">🔑</button>
        <button class="row-icon-btn" data-action="reset" title="كلمة مرور افتراضية جديدة">↺</button>
        <button class="row-icon-btn danger-icon" data-action="delete" title="حذف الموظف">🗑</button>
      </td>
    </tr>`).join('');
}

async function loadEmployees() {
  try {
    const { employees } = await api('/api/admin/employees');
    allEmployees = employees;
    renderTable(allEmployees);
  } catch (e) {
    $('emp-table-body').innerHTML = `<tr><td colspan="7"><div class="empty-state">${escapeHtml(e.message)}</div></td></tr>`;
  }
}

$('emp-search').addEventListener('input', () => {
  const q = $('emp-search').value.trim().toLowerCase();
  if (!q) return renderTable(allEmployees);
  renderTable(allEmployees.filter(e => String(e.name).toLowerCase().includes(q) || String(e.id).includes(q)));
});

// ---- View-as-employee modal (exactly what the employee sees) ----
const viewModal = $('view-modal');
function renderMyRankBanner(el, ranks, isSelf) {
  if (!ranks || !ranks.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const subject = isSelf ? 'أنت' : 'هذا الموظف';
  el.innerHTML = '🏆 ' + ranks.map(r => `${subject} ضمن <b>Top 5</b> في مرحلة <b>${escapeHtml(r.stage)}</b> — المركز <b>${escapeHtml(r.rank)}</b>`).join(' &nbsp;|&nbsp; ');
}

async function openViewModal(id) {
  viewModal.classList.add('open');
  $('view-modal-title').textContent = 'جاري التحميل...';
  $('view-emp-info').innerHTML = '';
  $('view-detail-head').innerHTML = '';
  $('view-detail-body').innerHTML = '';
  try {
    const data = await api(`/api/employee/${encodeURIComponent(id)}`);
    const emp = data.employee, s = data.summary || {}, a = data.attendance || {};
    $('view-modal-title').textContent = `بيانات ${emp.name}`;
    $('view-emp-info').innerHTML = `
      <div class="info-item"><span>الاسم</span><b>${escapeHtml(emp.name)}</b></div>
      <div class="info-item"><span>ID</span><b>${escapeHtml(emp.id)}</b></div>
      <div class="info-item"><span>الشركة</span><b>${escapeHtml(emp.company || '—')}</b></div>
      <div class="info-item"><span>الوردية</span><b>${escapeHtml(emp.shift || '—')}</b></div>
      <div class="info-item"><span>القسم</span><b>${escapeHtml(emp.department || '—')}</b></div>
      <div class="info-item"><span>أيام الحضور</span><b class="accent-value">${fmtNumber(a.present_days)}</b></div>
      <div class="info-item"><span>نسبة التارجت</span><b class="accent-value">${s.percentage !== null && s.percentage !== undefined ? fmtNumber(s.percentage) + '%' : '—'}</b></div>
      <div class="info-item"><span>رقم الشريحة</span><b>${escapeHtml(s.bonus_tier ?? '—')}</b></div>
      <div class="info-item"><span>إجمالي طبيعة العمل</span><b>${fmtNumber(s.work_nature_allowance)}</b></div>
      <div class="info-item"><span>الغياب بدون إذن</span><b class="danger-value">${fmtNumber(s.unauthorized_absence)}</b></div>
      <div class="info-item"><span>إجمالي الغياب</span><b class="danger-value">${fmtNumber(s.total_absence)}</b></div>`;

    renderMyRankBanner($('view-rank-banner'), data.myRanks, false);

    const stageEntries = Object.entries(data.stages || {});
    const dateSet = new Set(); stageEntries.forEach(([,rows]) => rows.forEach(r => dateSet.add(r.date)));
    const dates = [...dateSet].sort();
    $('view-detail-head').innerHTML = '<th>المرحلة</th>' + dates.map(d => `<th>${escapeHtml(d.slice(5))}</th>`).join('') + '<th>الإجمالي</th>';
    if (!stageEntries.length || !dates.length) {
      $('view-detail-body').innerHTML = `<tr><td colspan="${dates.length + 2}"><div class="empty-state">لا توجد بيانات مطابقة.</div></td></tr>`;
      return;
    }
    $('view-detail-body').innerHTML = stageEntries.map(([stageName, rows]) => {
      const byDate = Object.fromEntries(rows.map(r => [r.date, r.value])); let sum = 0, hasNum = false;
      const cells = dates.map(d => { const v = byDate[d]; if (v === undefined || v === null || v === '') return '<td class="cell-empty">—</td>'; if (typeof v === 'number') { sum += v; hasNum = true; return `<td class="cell-present">${fmtNumber(v)}</td>`; } return `<td class="cell-present">${escapeHtml(v)}</td>`; }).join('');
      return `<tr><td>${escapeHtml(stageName)}</td>${cells}<td>${hasNum ? fmtNumber(sum) : '—'}</td></tr>`;
    }).join('');
  } catch (e) {
    $('view-modal-title').textContent = 'خطأ';
    $('view-emp-info').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`;
  }
}
$('view-modal-close').addEventListener('click', () => viewModal.classList.remove('open'));
viewModal.addEventListener('click', (e) => { if (e.target === viewModal) viewModal.classList.remove('open'); });

// ---- Result modal helper ----
const resultModal = $('result-modal');
function showResult(title, text) {
  $('result-title').textContent = title;
  $('result-text').textContent = text;
  resultModal.classList.add('open');
}
$('result-ok').addEventListener('click', () => resultModal.classList.remove('open'));

// ---- Edit ID / name modal ----
const editModal = $('edit-modal');
let editTarget = null;
function openEditModal(emp) {
  editTarget = emp;
  $('edit-id').value = emp.id;
  $('edit-name').value = emp.name;
  $('edit-error').style.display = 'none';
  editModal.classList.add('open');
}
$('edit-cancel').addEventListener('click', () => editModal.classList.remove('open'));
$('edit-save').addEventListener('click', async () => {
  const errEl = $('edit-error');
  if (!editTarget) return;
  const newId = $('edit-id').value.trim();
  const name = $('edit-name').value.trim();
  try {
    const body = {};
    if (String(newId) !== String(editTarget.id)) body.newId = newId;
    if (name && name !== editTarget.name) body.name = name;
    await api(`/api/admin/employee/${encodeURIComponent(editTarget.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
    editModal.classList.remove('open');
    await loadEmployees();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
});

// ---- Change password modal ----
const pwModal = $('pw-modal');
let pwTarget = null;
function openPwModal(emp) {
  pwTarget = emp;
  $('pw-new').value = '';
  $('pw-error').style.display = 'none';
  pwModal.classList.add('open');
}
$('pw-cancel').addEventListener('click', () => pwModal.classList.remove('open'));
$('pw-save').addEventListener('click', async () => {
  const errEl = $('pw-error');
  if (!pwTarget) return;
  const newPassword = $('pw-new').value.trim();
  try {
    const body = newPassword ? { newPassword } : {};
    const data = await api(`/api/admin/employee/${encodeURIComponent(pwTarget.id)}/reset-password`, { method: 'POST', body: JSON.stringify(body) });
    pwModal.classList.remove('open');
    showResult('تم تغيير كلمة المرور', data.password ? `كلمة المرور الجديدة لـ ${pwTarget.name}: ${data.password}` : 'تم تغيير كلمة المرور بنجاح.');
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
});

// ---- Delete modal ----
const deleteModal = $('delete-modal');
let deleteTarget = null;
function openDeleteModal(emp) {
  deleteTarget = emp;
  $('delete-text').textContent = `هل أنت متأكد من حذف "${emp.name}"؟ سيتم حذف كل بياناته نهائيًا ولا يمكن التراجع.`;
  $('delete-error').style.display = 'none';
  deleteModal.classList.add('open');
}
$('delete-cancel').addEventListener('click', () => deleteModal.classList.remove('open'));
$('delete-confirm').addEventListener('click', async () => {
  const errEl = $('delete-error');
  if (!deleteTarget) return;
  try {
    await api(`/api/admin/employee/${encodeURIComponent(deleteTarget.id)}`, { method: 'DELETE' });
    deleteModal.classList.remove('open');
    await loadEmployees();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
});

// ---- Row action dispatch ----
$('emp-table-body').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id = row.dataset.id;
  const emp = allEmployees.find(x => String(x.id) === String(id));
  if (!emp) return;
  const action = btn.dataset.action;
  if (action === 'view') return openViewModal(id);
  if (action === 'edit') return openEditModal(emp);
  if (action === 'pw') return openPwModal(emp);
  if (action === 'delete') return openDeleteModal(emp);
  if (action === 'reset') {
    api(`/api/admin/employee/${encodeURIComponent(id)}/reset-default`, { method: 'POST' })
      .then(data => showResult('تم إنشاء كلمة مرور افتراضية', `كلمة المرور الجديدة لـ ${emp.name}: ${data.password}\nسيُطلب من الموظف تغييرها عند أول تسجيل دخول.`))
      .catch(err => showResult('خطأ', err.message));
  }
});

// clicking anywhere on the row (not on an action button) opens the "view" modal too
$('emp-table-body').addEventListener('click', (e) => {
  if (e.target.closest('button[data-action]')) return;
  const row = e.target.closest('tr[data-id]');
  if (row) openViewModal(row.dataset.id);
});

loadEmployees();
