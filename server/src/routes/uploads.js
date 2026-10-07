import express, { Router } from 'express';
import { BlobError, uniquePath, uploadHandler } from '@upstash/blob';
import { requireUser } from '../auth.js';
import { getBucket } from '../blob.js';
import { ah } from '../util.js';

// Files go straight from the browser to Upstash Blob (function bodies are capped at 4.5 MB on Vercel);
// this route only authorizes and signs the upload. Paths are `<kind>/<userId>/<name>-<random>.<ext>`.
export const KINDS = {
  videos: {
    contentTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maxSize: 200 * 1024 * 1024,
  },
  avatars: {
    contentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maxSize: 5 * 1024 * 1024,
  },
};

// Set by this route from the verified Clerk session, never trusted from the browser.
const USER_HEADER = 'x-onlyreal-user';

// Storage paths reject "." / ".." segments; keep file names to a safe, readable subset.
const safeName = (name) => String(name || 'file').replace(/[^\w.-]+/g, '_').replace(/^\.+/, '') || 'file';

let handler;
function getHandler() {
  return (handler ??= uploadHandler({
    bucket: getBucket(),
    context: (request) => {
      const userId = request.headers.get(USER_HEADER);
      if (!userId) throw new BlobError('unauthorized');
      return { userId };
    },
    routes: Object.fromEntries(
      Object.entries(KINDS).map(([kind, constraints]) => [
        kind,
        {
          constraints,
          onBeforeUpload: ({ ctx, file }) => ({ path: uniquePath(`${kind}/${ctx.userId}/${safeName(file.name)}`) }),
        },
      ])
    ),
  }));
}

// The SDK speaks fetch Request/Response; Express hands us Node's req/res.
function toRequest(req, userId) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null || [USER_HEADER, 'content-length', 'transfer-encoding', 'connection'].includes(k)) continue;
    headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  }
  if (userId) headers.set(USER_HEADER, userId);
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && Buffer.isBuffer(req.body) && req.body.length;
  return new Request(`${req.protocol}://${req.get('host')}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
  });
}

async function send(res, response) {
  res.status(response.status);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.send(Buffer.from(await response.arrayBuffer()));
}

const router = Router();
// Mounted before the app's JSON parser (see index.js): the SDK reads the raw body itself.
router.use(express.raw({ type: () => true, limit: '1mb' }));

// Public: serves each route's constraints to the browser client.
router.get('/', ah(async (req, res) => send(res, await getHandler().GET(toRequest(req)))));

router.post(
  '/',
  requireUser,
  ah(async (req, res) => send(res, await getHandler().POST(toRequest(req, String(req.user._id)))))
);

// Confirms a client-supplied URL is a file in our bucket that this user uploaded for `kind`.
export async function verifyUpload(url, kind, user) {
  const fail = () => {
    const err = new Error('Upload not found, try again');
    err.status = 400;
    throw err;
  };
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(String(url)).pathname.slice(1));
  } catch {
    fail();
  }
  const [k, owner] = pathname.split('/');
  if (k !== kind || owner !== String(user._id)) fail();
  const bucket = getBucket();
  const [info, publicUrl] = await Promise.all([bucket.info(pathname).catch(() => null), bucket.publicUrl(pathname)]);
  if (!info || !publicUrl || new URL(publicUrl).origin !== new URL(url).origin) fail();
  if (!KINDS[kind].contentTypes.includes(info.contentType)) fail();
  return { pathname, url: publicUrl, contentType: info.contentType };
}

export default router;
