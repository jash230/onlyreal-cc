import { Router } from 'express';
import { User } from '../models.js';
import { requireLogin, ageFromBirthDate } from '../auth.js';
import { publicUser } from '../serializers.js';
import { googleBirthDate } from '../googleAge.js';
import { ah, isDuplicateKey } from '../util.js';

const router = Router();
const USERNAME_RE = /^[a-z0-9_.]{3,24}$/i;

// Returns the app profile for the Clerk user, or flags that onboarding is needed.
router.get(
  '/me',
  requireLogin,
  ah(async (req, res) => {
    if (!req.user) {
      // Google sign-ins may already have a birthday on file, so onboarding can skip asking for it.
      const providerBirthDate = await googleBirthDate(req.clerkId);
      const age = providerBirthDate ? ageFromBirthDate(providerBirthDate) : NaN;
      return res.json({
        user: null,
        needsOnboarding: true,
        ageVerified: age >= 18,
        underage: age < 18,
      });
    }
    res.json({ user: await publicUser(req.user, req.user), needsOnboarding: false });
  })
);

// First login: choose a username and verify age before the account can do anything.
router.post(
  '/onboard',
  requireLogin,
  ah(async (req, res) => {
    if (req.user) return res.status(409).json({ error: 'Account already set up' });
    const { username, birthDate, displayName, acceptTerms } = req.body || {};

    if (!USERNAME_RE.test(username || '')) {
      return res.status(400).json({ error: 'Username must be 3–24 letters, numbers, _ or .' });
    }
    // A birthday from Google wins over a typed one, so it can't be overridden from the form.
    const dob = (await googleBirthDate(req.clerkId)) || birthDate || '';
    const age = ageFromBirthDate(dob);
    if (Number.isNaN(age)) return res.status(400).json({ error: 'Enter your date of birth' });
    if (age < 18) return res.status(403).json({ error: 'You must be 18 or older to use OnlyReal' });
    if (!acceptTerms) return res.status(400).json({ error: 'You must accept the Terms of Service' });

    try {
      const user = await User.create({
        clerkId: req.clerkId,
        username,
        usernameLower: username.toLowerCase(),
        displayName: String(displayName || username).trim().slice(0, 50) || username,
        birthDate: dob,
        termsAcceptedAt: new Date(),
      });
      res.status(201).json({ user: await publicUser(user, user) });
    } catch (err) {
      if (isDuplicateKey(err)) {
        const field = err.keyPattern?.clerkId ? 'Account' : 'Username';
        return res.status(409).json({ error: `${field} is already taken` });
      }
      throw err;
    }
  })
);

export default router;
