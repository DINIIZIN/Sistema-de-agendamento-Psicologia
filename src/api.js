// Centraliza todas as chamadas à API com o token JWT automático

const BASE_URL = 'http://localhost:3001/api';

function getToken() {
  return localStorage.getItem('token');
}

function headers() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getToken()}`
  };
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(), ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, error: data.error || 'Erro desconhecido' };
  return data;
}

export const api = {
  get: (path) => apiFetch(path),
  post: (path, body) => apiFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => apiFetch(path, { method: 'DELETE' }),
};
