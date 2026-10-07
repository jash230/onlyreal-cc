import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see server/.env.example)`);
  return value;
}

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: required('MONGODB_URI'),
  // Getter so scripts that never touch auth (e.g. seed) don't need Clerk keys.
  // @clerk/express reads both from the environment; this just fails fast when they're missing.
  get clerk() {
    return {
      publishableKey: required('CLERK_PUBLISHABLE_KEY'),
      secretKey: required('CLERK_SECRET_KEY'),
    };
  },
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
