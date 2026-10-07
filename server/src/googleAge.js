import { config } from './config.js';

// Reads a Google user's birthday from the People API, using the Google access token Auth0
// stored at sign-in. Requires the Google connection to request the
// https://www.googleapis.com/auth/user.birthday.read scope. Returns YYYY-MM-DD or null.

let mgmt = null; // { token, expiresAt }
const cache = new Map(); // auth0Id -> { birthDate, expiresAt }
const CACHE_MS = 10 * 60 * 1000;

async function mgmtToken({ domain, clientId, clientSecret }) {
  if (mgmt && mgmt.expiresAt > Date.now()) return mgmt.token;
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!res.ok) throw new Error(`Management token request failed (${res.status})`);
  const d = await res.json();
  mgmt = { token: d.access_token, expiresAt: Date.now() + (d.expires_in - 60) * 1000 };
  return mgmt.token;
}

const pad = (n) => String(n).padStart(2, '0');

async function fetchBirthDate(auth0Id, creds) {
  const token = await mgmtToken(creds);
  const userRes = await fetch(
    `https://${creds.domain}/api/v2/users/${encodeURIComponent(auth0Id)}?fields=identities&include_fields=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!userRes.ok) throw new Error(`Management user lookup failed (${userRes.status})`);
  const { identities = [] } = await userRes.json();
  const googleToken = identities.find((i) => i.provider === 'google-oauth2')?.access_token;
  if (!googleToken) return null;

  const peopleRes = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!peopleRes.ok) return null; // scope not granted, or the token expired
  const { birthdays = [] } = await peopleRes.json();
  // Only a full date can prove age; Google often has the day and month without the year.
  const full = birthdays
    .filter((b) => b.date?.year && b.date.month && b.date.day)
    .sort((a, b) => Number(!!b.metadata?.primary) - Number(!!a.metadata?.primary));
  if (!full.length) return null;
  const { year, month, day } = full[0].date;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export async function googleBirthDate(auth0Id) {
  const creds = config.auth0Mgmt;
  if (!creds || !auth0Id?.startsWith('google-oauth2|')) return null;
  const hit = cache.get(auth0Id);
  if (hit && hit.expiresAt > Date.now()) return hit.birthDate;
  try {
    const birthDate = await fetchBirthDate(auth0Id, creds);
    cache.set(auth0Id, { birthDate, expiresAt: Date.now() + CACHE_MS });
    return birthDate;
  } catch (err) {
    console.warn('Google birthday lookup failed:', err.message);
    return null; // fall back to asking for the date of birth
  }
}
