// Set by AuthProvider: returns an Auth0 access token, or null when signed out.
let tokenGetter = null;

export function setTokenGetter(fn) {
  tokenGetter = fn;
}

async function getToken() {
  if (!tokenGetter) return null;
  try {
    return await tokenGetter();
  } catch {
    return null; // session expired: continue as a guest
  }
}

export async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Upload with progress, which fetch can't report.
export async function uploadWithProgress(path, form, onProgress) {
  const token = await getToken();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api${path}`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON */
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data);
      else reject(new Error(data.error || `Upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(form);
  });
}

// SQLite returns "YYYY-MM-DD HH:MM:SS" in UTC with no zone marker.
export function timeAgo(ts) {
  const d = new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  const units = [
    ['y', 31536000],
    ['w', 604800],
    ['d', 86400],
    ['h', 3600],
    ['m', 60],
  ];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u}`;
  return `${s}s`;
}

export function compact(n) {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}
