# OnlyReal

An 18+ vertical video (reels) social network. React (Vite) client, Node + Express API, MongoDB (Mongoose), Clerk for sign-in.

## Setup

### 1. MongoDB
Use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier is fine) or a local `mongod`. You need a connection string.

### 2. Clerk
In the [Clerk dashboard](https://dashboard.clerk.com), create an application and turn on the sign-in methods you want (email, Google, etc.). Copy the **Publishable key** and **Secret key** from **Configure → API keys**. Add your production domain under **Domains** before going live.

### 3. Env files
```bash
cp server/.env.example server/.env              # MONGODB_URI, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
cp client/.env.example client/.env.local        # VITE_CLERK_PUBLISHABLE_KEY
```

### 4. Run
```bash
npm run install:all
npm run seed          # optional: demo creators + SFW placeholder clips (needs ffmpeg)
npm run dev           # API on :4000, web on http://localhost:5173
```

Production runs on Vercel as two services (see `vercel.json`): `client` (Vite static build) and `server` (Express function), with `/api/*` routed to the server and everything else to the client. Deploy with `vercel --prod`; run both locally the same way with `vercel dev`. Vite inlines the `VITE_*` vars at build time.

Videos and avatars upload from the browser straight to Vercel Blob; the API only signs uploads (`/api/uploads`) and stores the resulting URLs. Pull `BLOB_READ_WRITE_TOKEN` into `server/.env` with `vercel env pull` for local uploads.

| Server env var          | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `MONGODB_URI`           | **Required.** Mongo connection string                 |
| `CLERK_PUBLISHABLE_KEY` | **Required.** Clerk publishable key (`pk_…`)          |
| `CLERK_SECRET_KEY`      | **Required.** Clerk secret key (`sk_…`)               |
| `PORT`                  | API port (default `4000`)                             |
| `BLOB_READ_WRITE_TOKEN` | **Required for uploads.** Set by Vercel when a Blob store is connected |
| `UPLOAD_DIR`            | Legacy local files served at `/uploads` (`server/uploads`) |
| `CLIENT_ORIGIN`         | CORS origin (`http://localhost:5173`)                 |

## How auth works

- The SPA signs in with Clerk (`@clerk/react`, sign-in/sign-up modals) and sends the Clerk session token as `Authorization: Bearer` on API calls.
- The API verifies it with `@clerk/express` (`clerkMiddleware()` on `/api`, then `getAuth(req)` in `server/src/auth.js`).
- On first login there's no app profile yet: `GET /api/auth/me` returns `needsOnboarding: true`, and the client shows a required step to pick a username, enter date of birth (must be 18+) and accept the terms (`POST /api/auth/onboard`). Until then every write endpoint answers `403 onboarding_required`.
- Google sign-ins can skip the date-of-birth step: the server fetches the user's Google token from Clerk (`users.getUserOauthAccessToken`) and reads the birthday from the People API (`server/src/googleAge.js`). A Google birthday always overrides a typed one; under-18 is rejected. If Google has no full birthday (year included), or the scope wasn't granted, the user types it. To enable it, give Clerk's Google connection your own Google OAuth credentials, add the `https://www.googleapis.com/auth/user.birthday.read` scope there, and enable the People API in Google Cloud. Google must verify that sensitive scope before public launch.
- Users are linked by their Clerk user id (`users.clerkId`). Emails and passwords live only in Clerk.
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

This is an MVP. A real adult platform also needs: third-party ID/age verification for creators (and for viewers where the law requires it), a moderation/admin dashboard for `reports`, CSAM hash-matching on upload (e.g. PhotoDNA / NCMEC), video transcoding, rate limiting, verified email required at sign-up (a Clerk setting), and a payment provider that accepts adult merchants if you add subscriptions.

## Layout

```
server/src/
  index.js        Express app, static serving, Mongo connect
  config.js       env vars
  models.js       Mongoose schemas
  auth.js         Clerk session middleware + age helper
  serializers.js  API DTOs
  routes/         auth (me, onboard), videos, users
  seed.js         demo data
client/src/
  AuthContext.jsx Clerk session + app profile/onboarding
  pages/          Feed, Discover, Upload, Me, Profile, VideoPage, Legal
  components/     Reel, ReelFeed, AgeGate, OnboardingModal, LoginPrompt, Nav…
```
