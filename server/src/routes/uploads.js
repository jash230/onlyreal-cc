import { Router } from 'express';
import { handleUpload } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import { requireUser } from '../auth.js';
import { ah } from '../util.js';

// Files go straight from the browser to Vercel Blob (function bodies are capped at 4.5 MB);
// this route only hands out short-lived upload tokens. Pathnames are `<kind>/<userId>/<name>`.
export const KINDS = {
  videos: {
    allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
    maximumSizeInBytes: 200 * 1024 * 1024,
  },
  avatars: {
    allowedContentTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    maximumSizeInBytes: 5 * 1024 * 1024,
  },
};

const router = Router();

router.post(
  '/',
  requireUser,
  ah(async (req, res) => {
    const json = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const [kind, owner] = pathname.split('/');
        if (!KINDS[kind] || owner !== String(req.user._id)) throw new Error('Invalid upload path');
        return { ...KINDS[kind], addRandomSuffix: true };
      },
    });
    res.json(json);
  })
);

// Confirms a client-supplied URL is a blob in our store that this user uploaded for `kind`.
export async function verifyUpload(url, kind, user) {
  const blob = await head(String(url || '')).catch(() => null);
  const [k, owner] = blob?.pathname.split('/') || [];
  if (!blob || k !== kind || owner !== String(user._id) || !KINDS[kind].allowedContentTypes.includes(blob.contentType)) {
    const err = new Error('Upload not found, try again');
    err.status = 400;
    throw err;
  }
  return blob;
}

export default router;
