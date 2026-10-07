import { auth } from 'express-oauth2-jwt-bearer';
import { config } from './config.js';
import { User } from './models.js';

// Validates Auth0 access tokens (RS256, checked against the tenant's JWKS).
const jwtRequired = auth(config.auth0);
const jwtOptional = auth({ ...config.auth0, authRequired: false });

const loadUser = async (req) => {
  req.auth0Id = req.auth?.payload.sub || null;
  req.user = req.auth0Id ? await User.findOne({ auth0Id: req.auth0Id }) : null;
};

const wrap = (jwt, after) => [
  jwt,
  (req, res, next) => loadUser(req).then(() => after(req, res, next), next),
];

// Signed in with Auth0, app profile may not exist yet (used by /me and onboarding).
export const requireLogin = wrap(jwtRequired, (_req, _res, next) => next());

// Signed in AND onboarded (age verified, username chosen).
export const requireUser = wrap(jwtRequired, (req, res, next) => {
  if (!req.user) return res.status(403).json({ error: 'Finish setting up your account', code: 'onboarding_required' });
  next();
});

export const optionalUser = wrap(jwtOptional, (_req, _res, next) => next());

export function ageFromBirthDate(birthDate, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return NaN;
  const dob = new Date(birthDate + 'T00:00:00Z');
  if (Number.isNaN(dob.getTime())) return NaN;
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}
