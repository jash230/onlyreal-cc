# OnlyReal

An 18+ vertical video (reels) social network. React (Vite) client, Node + Express API, MongoDB (Mongoose), Auth0 for sign-in.

## Setup

### 1. MongoDB
Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier is fine) or a local `mongod`. You need a connection string.

### 2. Auth0
In the [Auth0 dashboard](https://manage.auth0.com):

1. **Applications → APIs → Create API.** Identifier e.g. `https://api.onlyreal.cc` (this is the *audience*), signing algorithm RS256. In its settings, enable **Allow Offline Access**.
2. **Applications → Applications → Create Application → Single Page Application.** In its settings:
   - Allowed Callback URLs, Allowed Logout URLs, Allowed Web Origins: `http://localhost:5173` (add your production URL too)
   - **Refresh Token Rotation**: on
3. Turn on whichever login methods you want under **Authentication** (database, Google, etc.).

### 3. Env files
```bash
cp server/.env.example server/.env   # MONGODB_URI, AUTH0_DOMAIN, AUTH0_AUDIENCE
cp client/.env.example client/.env   # VITE_AUTH0_DOMAIN, VITE_AUTH0_CLIENT_ID, VITE_AUTH0_AUDIENCE
```

### 4. Run
```bash
npm run install:all
npm run seed          # optional: demo creators + SFW placeholder clips (needs ffmpeg)
npm run dev           # API on :4000, web on http://localhost:5173
```

Production: `npm run build && npm start` serves the built client and API from one port (4000). Vite inlines the `VITE_*` vars at build time.

| Server env var          | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `MONGODB_URI`           | **Required.** Mongo connection string                 |
| `AUTH0_DOMAIN`          | **Required.** e.g. `your-tenant.us.auth0.com`         |
| `AUTH0_AUDIENCE`        | **Required.** The Auth0 API identifier                |
| `AUTH0_ISSUER_BASE_URL` | Optional, for an Auth0 custom domain                  |
| `PORT`                  | API port (default `4000`)                             |
| `UPLOAD_DIR`            | Where videos/avatars are saved (`server/uploads`)     |
| `CLIENT_ORIGIN`         | CORS origin (`http://localhost:5173`)                 |

## How auth works

- The SPA signs in with Auth0 (`@auth0/auth0-react`, redirect flow, refresh tokens) and sends the access token as `Authorization: Bearer` on API calls.
- The API validates it with `express-oauth2-jwt-bearer` (issuer, audience, RS256 signature via the tenant's JWKS).
- On first login there's no app profile yet: `GET /api/auth/me` returns `needsOnboarding: true`, and the client shows a required step to pick a username, enter date of birth (must be 18+) and accept the terms (`POST /api/auth/onboard`). Until then every write endpoint answers `403 onboarding_required`.
- Google sign-ins can skip the date-of-birth step: if `AUTH0_MGMT_CLIENT_ID`/`AUTH0_MGMT_CLIENT_SECRET` are set and `VITE_GOOGLE_BIRTHDAY=true`, the client asks Google for the `user.birthday.read` scope and the server reads the birthday from the People API (`server/src/googleAge.js`) with the Google token Auth0 stored. A Google birthday always overrides a typed one; under-18 is rejected. If Google has no full birthday (year included), the user types it. This needs your own Google OAuth client on the Auth0 Google connection with the People API enabled, and Google verification of that sensitive scope before public launch.
- Users are linked by the Auth0 `sub` (`users.auth0Id`). Emails and passwords live only in Auth0.
- Seeded demo creators have `seed|…` ids, so nobody can log in as them.

## Features

- **Feed**: full-screen snap-scrolling reels, *For You* (engagement × recency ranking) and *Following* tabs, autoplay of the visible clip, tap to pause, double-tap to like, mute toggle, arrow-key navigation, infinite scroll
- **Discover**: creator search, popular creators, trending-this-week grid
- **Upload**: drag-and-drop with preview, caption, upload progress
- **Me / profiles**: stats, clip grid, follow, edit name/bio/avatar, delete own clips
- Likes, comments, share links (`/v/:id`), feedback form

### 18+ and safety

- Age gate on first visit and RTA label meta tag
- Date of birth required during onboarding; under-18 accounts rejected server-side
- Every upload requires the creator to attest that everyone depicted is 18+ and consented; attestations are stored (`consentattestations` collection) with user, IP, file and time, and are kept even if the clip is deleted
- Report button on every clip; reports for *underage* or *non-consensual* hide the clip immediately pending review
- Terms, Community Guidelines and 2257 pages (placeholder copy in `client/src/pages/Legal.jsx`, so have a lawyer replace it)

## Before going live

This is an MVP. A real adult platform also needs: third-party ID/age verification for creators (and for viewers where the law requires it), a moderation/admin dashboard for `reports`, CSAM hash-matching on upload (e.g. PhotoDNA / NCMEC), object storage + CDN and transcoding instead of local disk, rate limiting, Auth0 email verification enforced (e.g. an Action that blocks unverified users), and a payment provider that accepts adult merchants if you add subscriptions.

## Layout

```
server/src/
  index.js        Express app, static serving, Mongo connect
  config.js       env vars
  models.js       Mongoose schemas
  auth.js         Auth0 JWT middleware + age helper
  serializers.js  API DTOs
  routes/         auth (me, onboard), videos, users
  seed.js         demo data
client/src/
  AuthContext.jsx Auth0 session + app profile/onboarding
  pages/          Feed, Discover, Upload, Me, Profile, VideoPage, Legal
  components/     Reel, ReelFeed, AgeGate, OnboardingModal, LoginPrompt, Nav…
```
