const TOKEN_KEY = "promet_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Greška u komunikaciji sa serverom.");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const novac = (n) =>
  new Intl.NumberFormat("sr-RS", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

export const kolicina = (n) =>
  new Intl.NumberFormat("sr-RS", { maximumFractionDigits: 3 }).format(Number(n) || 0);

export function danas() {
  return new Date().toISOString().slice(0, 10);
}
