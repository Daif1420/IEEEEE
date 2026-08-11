const token = sessionStorage.getItem('iems_token');
const userRaw = sessionStorage.getItem('iems_user');
if (!token || !userRaw) window.location.href = '/index.html';
const user = JSON.parse(userRaw);

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
function fmtDate(v) { if (!v) return '—'; const [y,m,d] = v.split('-'); return `${d}/${m}/${y}`; }

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
$('chip-role').textContent = `ID: ${user.id} · ${user.role === 'admin' ? 'مدير' : 'Shift ' + (user.shift || '-')}`;
$('chip-avatar').textContent = (user.name || '?').trim()[0] || '?';
$('logout-btn').addEventListener('click', () => { sessionStorage.clear(); window.location.href = '/index.html'; });
if (user.role === 'admin') $('nav-employees').style.display = 'inline-flex';

// ---- Force password change (must_change_password) ----
const pwModal = $('pw-modal');
function openPwModal(forced) {
  pwModal.classList.add('open');
  $('pw-error').style.display = 'none';
  $('pw-force-note').style.display = forced ? 'block' : 'none';
  $('pw-cancel').style.display = forced ? 'none' : 'inline-block';
}
function closePwModal() { pwModal.classList.remove('open'); }
if (user.must_change_password) { $('pw-banner').style.display = 'flex'; openPwModal(true); }
$('pw-open-btn').addEventListener('click', () => openPwModal(false));
$('pw-banner-btn').addEventListener('click', () => openPwModal(false));
$('pw-cancel').addEventListener('click', closePwModal);
$('pw-save').addEventListener('click', async () => {
  const errEl = $('pw-error');
  try {
    await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword: $('pw-current').value, newPassword: $('pw-new').value }) });
    user.must_change_password = false; sessionStorage.setItem('iems_user', JSON.stringify(user));
    $('pw-banner').style.display = 'none'; closePwModal();
  } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
});

let availableDates = [];
async function initFilters() {
  const [{ stages }, { dates }] = await Promise.all([api('/api/employee/stages'), api('/api/employee/dates')]);
  availableDates = dates || [];

  const stageSel = $('f-stage');
  const performanceStages = (stages || []).filter(s => String(s).trim() !== 'الحضور');
  stageSel.innerHTML = '<option value="__ALL__">كل المراحل</option>' + performanceStages.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');

  if (availableDates.length) {
    $('f-from').min = availableDates[0]; $('f-from').max = availableDates[availableDates.length - 1];
    $('f-to').min = availableDates[0]; $('f-to').max = availableDates[availableDates.length - 1];
    $('f-from').value = availableDates[0];
    $('f-to').value = availableDates[availableDates.length - 1];
  }
}

$('apply-btn').addEventListener('click', refreshDashboard);
$('f-from').addEventListener('change', () => { if ($('f-to').value && $('f-from').value > $('f-to').value) $('f-to').value = $('f-from').value; });
$('reset-btn').addEventListener('click', async () => {
  $('f-stage').value = '__ALL__';
  if (availableDates.length) { $('f-from').value = availableDates[0]; $('f-to').value = availableDates[availableDates.length - 1]; }
  await refreshDashboard();
});

// ---- Admin: company-wide overview ----
async function renderOverview() {
  if (user.role !== 'admin') return;
  try {
    const o = await api('/api/admin/overview');
    const cards = [
      ['إجمالي الموظفين', o.total, 'blue', 'TOTAL EMPLOYEES'],
      ['موظفو سمارت', o.smart, 'teal', 'SMART BUSINESS'],
      ['موظفو برافوس', o.bravos, 'amber', 'BRAVOS'],
      ['إجمالي الطلاب', o.students, 'blue', 'STUDENTS'],
      ['إجمالي الخريجين', o.graduates, 'teal', 'GRADUATES'],
    ];
    $('overview-grid').style.display = 'grid';
    $('overview-grid').innerHTML = cards.map(([label,val,cls,mini]) => `<div class="stat-card ${cls}"><div class="stat-icon">●</div><div><div class="stat-mini">${mini}</div><div class="label">${label}</div><div class="value">${fmtNumber(val)}</div></div></div>`).join('');
  } catch (e) { /* silent - admin-only widget */ }
}

// ---- Top 5 (admin only) ----
function renderTop5(data) {
  if (user.role !== 'admin') { $('top5-panel').style.display = 'none'; return; }
  $('top5-panel').style.display = 'block';
  const stage = $('f-stage').value;
  const groups = stage !== '__ALL__' ? { [stage]: data.selectedTop5 || [] } : data.top5ByStage || {};
  const entries = Object.entries(groups).filter(([, rows]) => rows && rows.length);
  $('top5-range').textContent = `${fmtDate(data.range.from)} → ${fmtDate(data.range.to)}`;
  if (!entries.length) { $('top5-container').innerHTML = '<div class="empty-state">لا توجد بيانات أداء في الفترة المختارة.</div>'; return; }

  $('top5-container').innerHTML = entries.map(([stageName, rows]) => `
    <article class="stage-card">
      <div class="stage-card-head"><span class="stage-name">${escapeHtml(stageName)}</span><span class="count-badge">TOP 5</span></div>
      <div class="ranking-list">
        ${rows.map(r => `<div class="rank-row"><div class="rank-badge rank-${r.rank}">${r.rank}</div><div class="rank-person"><b>${escapeHtml(r.name)}</b><span>ID #${escapeHtml(r.id)} · ${escapeHtml(r.shift || '—')}</span></div><strong>${fmtNumber(r.achieved)}</strong></div>`).join('')}
      </div>
    </article>`).join('');
}

function renderMyRankBanner(ranks) {
  const el = $('my-rank-banner');
  if (!ranks || !ranks.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = '🏆 ' + ranks.map(r => `أنت ضمن <b>Top 5</b> في مرحلة <b>${escapeHtml(r.stage)}</b> — المركز <b>${escapeHtml(r.rank)}</b>`).join(' &nbsp;|&nbsp; ');
}

// ---- Self view (employee role only) ----
async function loadSelfView(dashData) {
  if (user.role === 'admin') { $('self-view-grid').style.display = 'none'; $('detail-panel').style.display = 'none'; return; }
  $('self-view-grid').style.display = 'grid';
  $('detail-panel').style.display = 'block';

  const params = new URLSearchParams();
  if ($('f-from').value) params.set('from', $('f-from').value);
  if ($('f-to').value) params.set('to', $('f-to').value);
  if ($('f-stage').value) params.set('stage', $('f-stage').value);

  try {
    const data = await api(`/api/employee/${encodeURIComponent(user.id)}?${params}`);
    const emp = data.employee, s = data.summary || {}, a = data.attendance || {};
    $('emp-info-card').innerHTML = `
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
    $('attendance-big').textContent = fmtNumber(a.present_days);

    renderMyRankBanner(data.myRanks);

    const stageEntries = Object.entries(data.stages || {});
    const dateSet = new Set(); stageEntries.forEach(([,rows]) => rows.forEach(r => dateSet.add(r.date)));
    const dates = [...dateSet].sort();
    $('detail-head').innerHTML = '<th>المرحلة</th>' + dates.map(d => `<th>${escapeHtml(d.slice(5))}</th>`).join('') + '<th>الإجمالي</th>';
    if (!stageEntries.length || !dates.length) { $('detail-body').innerHTML = `<tr><td colspan="${dates.length + 2}"><div class="empty-state">لا توجد بيانات مطابقة.</div></td></tr>`; return; }
    $('detail-body').innerHTML = stageEntries.map(([stageName, rows]) => {
      const byDate = Object.fromEntries(rows.map(r => [r.date, r.value])); let sum = 0, hasNum = false;
      const cells = dates.map(d => { const v = byDate[d]; if (v === undefined || v === null || v === '') return '<td class="cell-empty">—</td>'; if (typeof v === 'number') { sum += v; hasNum = true; return `<td class="cell-present">${fmtNumber(v)}</td>`; } return `<td class="cell-present">${escapeHtml(v)}</td>`; }).join('');
      return `<tr><td>${escapeHtml(stageName)}</td>${cells}<td>${hasNum ? fmtNumber(sum) : '—'}</td></tr>`;
    }).join('');
  } catch (e) { $('emp-info-card').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}

async function refreshDashboard() {
  const from = $('f-from').value, to = $('f-to').value;
  if (from && to && from > to) { alert('تاريخ البداية يجب أن يسبق تاريخ النهاية.'); return; }
  const params = new URLSearchParams(); if (from) params.set('from', from); if (to) params.set('to', to); params.set('stage', $('f-stage').value || '__ALL__');
  try {
    const data = await api(`/api/employee/dashboard?${params}`);
    renderTop5(data);
    await Promise.all([renderOverview(), loadSelfView(data)]);
  } catch (e) { $('top5-container').innerHTML = `<div class="empty-state">${escapeHtml(e.message)}</div>`; }
}

(async function boot() {
  await initFilters();
  await refreshDashboard();
})();

// Admin Master upload
const adminUploadCard = $('admin-upload-card');
const masterFile = $('master-file');
const masterUploadBtn = $('master-upload-btn');
const masterUploadStatus = $('master-upload-status');
const masterUploadCredentials = $('master-upload-credentials');
if (user.role === 'admin' && adminUploadCard) adminUploadCard.style.display = 'block';
if (masterUploadBtn) masterUploadBtn.addEventListener('click', async () => {
  const file = masterFile.files[0];
  if (!file) { masterUploadStatus.className = 'upload-status error'; masterUploadStatus.textContent = 'اختر ملف Excel أولاً.'; return; }
  if (!/\.xlsx$/i.test(file.name)) { masterUploadStatus.className = 'upload-status error'; masterUploadStatus.textContent = 'الملف يجب أن يكون بصيغة .xlsx'; return; }
  if (file.size > 8 * 1024 * 1024) { masterUploadStatus.className = 'upload-status error'; masterUploadStatus.textContent = 'حجم الملف يجب ألا يتجاوز 8MB.'; return; }
  masterUploadBtn.disabled = true; masterUploadStatus.className = 'upload-status'; masterUploadStatus.textContent = 'جاري تحديث Master...'; masterUploadCredentials.style.display = 'none';
  try {
    const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('تعذر قراءة الملف.')); reader.readAsDataURL(file); });
    const data = await api('/api/admin/import-master', { method: 'POST', body: JSON.stringify({ filename: file.name, data: String(dataUrl) }) });
    masterUploadStatus.className = 'upload-status success'; masterUploadStatus.textContent = data.message || 'تم التحديث بنجاح.';
    if (Array.isArray(data.newCredentials) && data.newCredentials.length) {
      masterUploadCredentials.style.display = 'block';
      masterUploadCredentials.innerHTML = `<b>كلمات مرور جديدة لموظفين جدد:</b><table><thead><tr><th>ID</th><th>الاسم</th><th>كلمة المرور</th></tr></thead><tbody>${data.newCredentials.map(x => `<tr><td>${escapeHtml(x.id)}</td><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.password)}</td></tr>`).join('')}</tbody></table>`;
    }
    await refreshDashboard();
  } catch (err) { masterUploadStatus.className = 'upload-status error'; masterUploadStatus.textContent = err.message || 'فشل تحديث Master.'; }
  finally { masterUploadBtn.disabled = false; }
});
