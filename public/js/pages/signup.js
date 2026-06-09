import { apiPost } from '../api.js';
import { setAuth, redirectIfLoggedIn } from '../auth.js';
import { showToast } from '../components/toast.js';

redirectIfLoggedIn();
initTheme();

const form = document.getElementById('signup-form');
const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nameError = document.getElementById('name-error');
const emailError = document.getElementById('email-error');
const passwordError = document.getElementById('password-error');
const formError = document.getElementById('form-error');
const submitBtn = document.getElementById('signup-btn');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  let valid = true;

  if (!name) { showError(nameError, '이름을 입력해주세요.'); valid = false; }
  if (!email) { showError(emailError, '이메일을 입력해주세요.'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError(emailError, '올바른 이메일 형식이 아닙니다.'); valid = false; }
  if (password.length < 6) { showError(passwordError, '비밀번호는 6자 이상이어야 합니다.'); valid = false; }
  if (!valid) return;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner-sm"></span> 가입 중...';

  try {
    const { token, user } = await apiPost('/api/auth/signup', { name, email, password });
    setAuth(token, user);
    showToast('회원가입 완료!', 'success');
    setTimeout(() => { window.location.href = '/pages/dashboard.html'; }, 300);
  } catch (err) {
    showError(formError, err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '가입하기';
  }
});

document.getElementById('theme-btn').addEventListener('click', toggleTheme);

function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function clearErrors() {
  [nameError, emailError, passwordError, formError].forEach(el => {
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
