import { Router } from 'express';
import { requireUser } from '../auth.js';
import { signUpload, uniqueKey, publicUrl, keyFromUrl, statFile, deleteStored } from '../blob.js';
import { ah } from '../util.js';

// Files go straight from the browser to Cloudflare R2 (function bodies are capped at 4.5 MB on Vercel);
// this route only hands out short-lived presigned PUT URLs. Keys are `<kind>/<userId>/<name>-<random>.<ext>`.
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

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const router = Router();

router.post(
  '/',
  requireUser,
  ah(async (req, res) => {
    const { kind, name, type, size } = req.body || {};
    const rules = KINDS[kind];
    if (!rules) throw badRequest('Unknown upload kind');
    if (!rules.contentTypes.includes(type)) throw badRequest('That file type is not supported');
    if (!Number.isInteger(size) || size <= 0) throw badRequest('Empty file');
    if (size > rules.maxSize) throw badRequest(`File is too large (max ${rules.maxSize / 1024 / 1024} MB)`);

    const key = uniqueKey(`${kind}/${req.user._id}`, name);
    res.json({ uploadUrl: await signUpload(key, type, size), url: publicUrl(key), contentType: type });
  })
);

// Confirms a client-supplied URL is a file in our bucket that this user uploaded for `kind`.
// Anything that fails the checks after landing in the bucket is deleted.
export async function verifyUpload(url, kind, user) {
  const fail = () => {
    throw badRequest('Upload not found, try again');
  };
  const key = keyFromUrl(url);
  const [k, owner] = key ? key.split('/') : [];
  if (k !== kind || owner !== String(user._id)) fail();
  const stat = await statFile(key);
  if (!stat) fail();
  if (!KINDS[kind].contentTypes.includes(stat.contentType) || stat.size > KINDS[kind].maxSize) {
    await deleteStored(key);
    fail();
  }
  return { pathname: key, url: publicUrl(key), contentType: stat.contentType };
}

export default router;
