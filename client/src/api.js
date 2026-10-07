import { upload } from '@upstash/blob/browser';

// Set by AuthProvider: returns a Clerk session token, or null when signed out.
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

export async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

// Uploads straight to Upstash Blob (API functions can't take large bodies); the API only signs the upload.
// kind is 'videos' or 'avatars'. Resolves to the file's public URL to hand back to the API.
export async function uploadFile(kind, file, onProgress) {
  const task = upload(file, {
    route: `/api/uploads?route=${kind}`,
    headers: async () => {
      const token = await getToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    },
  });
  const stop = onProgress && task.subscribe(() => onProgress(task.snapshot().percent / 100));
  try {
    return (await task.done).url;
  } finally {
    stop?.();
  }
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
