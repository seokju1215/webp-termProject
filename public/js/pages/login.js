import { apiPost } from '../api.js';
import { setAuth, redirectIfLoggedIn } from '../auth.js';
import { showToast } from '../components/toast.js';

// Google OAuth 콜백 처리 (redirect 후 URL 파라미터로 토큰 전달)
(function () {
  const p = new URLSearchParams(location.search);
  const token = p.get('oauth_token');
  if (token) {
    setAuth(token, {
      id: p.get('oauth_id') || '',
      name: decodeURIComponent(p.get('oauth_name') || ''),
      email: decodeURIComponent(p.get('oauth_email') || '')
    });
    window.location.replace('/pages/dashboard.html');
    return;
  }
  const err = p.get('error');
  if (err) sessionStorage.setItem('login_error', decodeURIComponent(err));
})();

redirectIfLoggedIn();
initTheme();

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('login-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let valid = true;

  if (!email) { showError(emailError, '이메일을 입력해주세요.'); valid = false; }
  if (!password) { showError(passwordError, '비밀번호를 입력해주세요.'); valid = false; }
  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-sm"></span> 로그인 중...';

  try {
    const { token, user } = await apiPost('/api/auth/login', { email, password });
    setAuth(token, user);
    showToast('로그인 성공!', 'success');
    setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 300);
  } catch (err) {
    showError(formError, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '로그인';
  }
});

document.getElementById('theme-btn').addEventListener('click', toggleTheme);

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function clearErrors() {
  [emailError, passwordError, formError].forEach(el => {
    el.textContent = '';
    el.classList.add('hidden');
  });
}

function initTheme() {
  const saved = localStorage.getItem('theme') || '';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? '' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  updateThemeBtn(next);
}
function updateThemeBtn(theme) {
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}
