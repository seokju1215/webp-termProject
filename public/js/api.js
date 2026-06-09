// fetch wrapper — 자동으로 JWT 헤더 첨부, { data, error, message } 구조로 응답 파싱
export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(json.message || '요청에 실패했습니다.');
    err.status = res.status;
    err.code = json.error;
    throw err;
  }

  return json.data ?? json;
}

export async function apiGet(path) {
  return api(path);
}

export async function apiPost(path, body) {
  return api(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut(path, body) {
  return api(path, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiPatch(path, body) {
  return api(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export async function apiDelete(path) {
  return api(path, { method: 'DELETE' });
}

// multipart/form-data 업로드 (이미지)
export async function apiUpload(path, formData) {
  const token = localStorage.getItem('token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { method: 'POST', headers, body: formData });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(json.message || '업로드에 실패했습니다.');
    err.status = res.status;
    throw err;
  }
  return json.data ?? json;
}
