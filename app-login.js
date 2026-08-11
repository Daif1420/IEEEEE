const btn = document.getElementById('login-btn');
const errBox = document.getElementById('login-error');

async function doLogin() {
  const id = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-pass').value;
  errBox.style.display = 'none';

  if (!id || !password) {
    errBox.textContent = 'من فضلك أدخل الـID وكلمة المرور';
    errBox.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'جارِ الدخول...';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'حدث خطأ');

    sessionStorage.setItem('iems_token', data.token);
    sessionStorage.setItem('iems_user', JSON.stringify(data.user));
    window.location.href = '/dashboard.html';
  } catch (e) {
    errBox.textContent = e.message;
    errBox.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

btn.addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

// if already logged in, skip straight to dashboard
if (sessionStorage.getItem('iems_token')) {
  window.location.href = '/dashboard.html';
}
