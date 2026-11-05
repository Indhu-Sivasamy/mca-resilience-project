export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(API_URL + path, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.details = data.errors;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
};
