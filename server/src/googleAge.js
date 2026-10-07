import { clerkClient } from '@clerk/express';

// Reads a Google user's birthday from the People API, using the Google access token Clerk
// keeps for the user's Google connection. Requires the Google social connection to use your
// own OAuth credentials with the https://www.googleapis.com/auth/user.birthday.read scope.
// Returns YYYY-MM-DD, or null when there's no Google account, no scope, or no full date.

const cache = new Map(); // clerkId -> { birthDate, expiresAt }
const CACHE_MS = 10 * 60 * 1000;
const pad = (n) => String(n).padStart(2, '0');

async function fetchBirthDate(clerkId) {
  const { data } = await clerkClient.users.getUserOauthAccessToken(clerkId, 'google');
  const googleToken = data[0]?.token;
  if (!googleToken) return null;

  const res = await fetch('https://people.googleapis.com/v1/people/me?personFields=birthdays', {
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!res.ok) return null; // scope not granted, or the token expired
  const { birthdays = [] } = await res.json();
  // Only a full date can prove age; Google often has the day and month without the year.
  const full = birthdays
    .filter((b) => b.date?.year && b.date.month && b.date.day)
    .sort((a, b) => Number(!!b.metadata?.primary) - Number(!!a.metadata?.primary));
  if (!full.length) return null;
  const { year, month, day } = full[0].date;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export async function googleBirthDate(clerkId) {
  if (!clerkId) return null;
  const hit = cache.get(clerkId);
  if (hit && hit.expiresAt > Date.now()) return hit.birthDate;
  try {
    const birthDate = await fetchBirthDate(clerkId);
    cache.set(clerkId, { birthDate, expiresAt: Date.now() + CACHE_MS });
    return birthDate;
  } catch (err) {
    console.warn('Google birthday lookup failed:', err.message);
    return null; // fall back to asking for the date of birth
  }
}
