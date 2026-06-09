// JWT 토큰 + 유저 정보 관리
export function getToken() {
  return localStorage.getItem('token');
}

export function getUser() {
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setAuth(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export function isLoggedIn() {
  return !!getToken();
}

// 로그인 필요 페이지에서 호출 — 미로그인이면 /로 리다이렉트
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '/';
  }
}

// 로그인 상태면 대시보드로 리다이렉트 (로그인/회원가입 페이지용)
export function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = '/pages/dashboard.html';
  }
}

export function logout() {
  clearAuth();
  window.location.href = '/';
}
