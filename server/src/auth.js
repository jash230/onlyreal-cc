import { clerkMiddleware, getAuth } from '@clerk/express';
import { User } from './models.js';

// Verifies the Clerk session token (Authorization: Bearer) on API requests. Mounted on /api in index.js.
export const clerk = clerkMiddleware();

const loadUser = async (req) => {
  req.clerkId = getAuth(req).userId || null;
  req.user = req.clerkId ? await User.findOne({ clerkId: req.clerkId }) : null;
};

const wrap = (check) => (req, res, next) =>
  loadUser(req).then(() => check(req, res, next), next);

// Signed in with Clerk, app profile may not exist yet (used by /me and onboarding).
export const requireLogin = wrap((req, res, next) => {
  if (!req.clerkId) return res.status(401).json({ error: 'Sign in to continue' });
  next();
});

// Signed in AND onboarded (age verified, username chosen).
export const requireUser = wrap((req, res, next) => {
  if (!req.clerkId) return res.status(401).json({ error: 'Sign in to continue' });
  if (!req.user) return res.status(403).json({ error: 'Finish setting up your account', code: 'onboarding_required' });
  next();
});

export const optionalUser = wrap((_req, _res, next) => next());

export function ageFromBirthDate(birthDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return NaN;
  const dob = new Date(birthDate + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) return NaN;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
