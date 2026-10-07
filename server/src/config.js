import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see server/.env.example)`);
  return value;
}

export const config = {
  port: process.env.PORT || 4000,
  mongoUri: required('MONGODB_URI'),
  // Getter so scripts that never touch auth (e.g. seed) don't need Auth0 vars.
  get auth0() {
    return {
      audience: required('AUTH0_AUDIENCE'),
      // AUTH0_ISSUER_BASE_URL lets you use an Auth0 custom domain; otherwise derived from AUTH0_DOMAIN.
      issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL || `https://${required('AUTH0_DOMAIN')}/`,
    };
  },
  // Optional M2M app (Management API: read:users, read:user_idp_tokens). When set, Google
  // sign-ins get their birthday from Google instead of typing it during onboarding.
  get auth0Mgmt() {
    const { AUTH0_DOMAIN: domain, AUTH0_MGMT_CLIENT_ID: clientId, AUTH0_MGMT_CLIENT_SECRET: clientSecret } = process.env;
    return domain && clientId && clientSecret ? { domain, clientId, clientSecret } : null;
  },
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
};
