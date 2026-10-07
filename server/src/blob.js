import crypto from 'node:crypto';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  PutBucketCorsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Cloudflare R2 through its S3-compatible API. Files are served from the bucket's public URL
// (R2_PUBLIC_URL: the r2.dev subdomain or a custom domain). Built lazily so the API and scripts
// that never touch storage start without R2 credentials.
const ENV = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'];

let state;
function r2() {
  if (state) return state;
  const missing = ENV.filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars ${missing.join(', ')} (see server/.env.example)`);
  state = {
    bucket: process.env.R2_BUCKET,
    publicBase: process.env.R2_PUBLIC_URL.replace(/\/+$/, ''),
    client: new S3Client({
      region: 'auto',
      forcePathStyle: true,
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
    }),
  };
  return state;
}

export const publicUrl = (key) => `${r2().publicBase}/${key.split('/').map(encodeURIComponent).join('/')}`;

// The object key behind one of our public URLs, or null for anything else.
export function keyFromUrl(url) {
  const base = r2().publicBase + '/';
  const s = String(url || '');
  if (!s.startsWith(base)) return null;
  try {
    return decodeURIComponent(new URL(s).pathname.slice(new URL(base).pathname.length));
  } catch {
    return null;
  }
}

export const isStoredUrl = (url) => keyFromUrl(url) !== null;

// `<prefix>/<safe name>-<random>.<ext>`: unique, and free of characters that need escaping.
export function uniqueKey(prefix, filename) {
  const ext = path.extname(String(filename)).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 9);
  const stem = path.basename(String(filename), path.extname(String(filename))).replace(/[^\w-]+/g, '_').slice(0, 60) || 'file';
  return `${prefix}/${stem}-${crypto.randomBytes(5).toString('hex')}${ext}`;
}

// A presigned PUT the browser uploads one file to. Content type and length are part of the signature.
export async function signUpload(key, contentType, size) {
  const { client, bucket } = r2();
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size });
  return getSignedUrl(client, command, { expiresIn: 600, signableHeaders: new Set(['content-type', 'content-length']) });
}

// Server-side upload. Body is a Buffer or a stream whose exact size is passed in.
export async function putFile(key, body, contentType, size) {
  const { client, bucket } = r2();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: size,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );
  return { key, url: publicUrl(key) };
}

// { contentType, size } of a stored object, or null if it isn't there.
export async function statFile(key) {
  const { client, bucket } = r2();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { contentType: head.ContentType, size: head.ContentLength };
  } catch (e) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound') return null;
    throw e;
  }
}

// Deletes one key or many. Missing keys count as deleted. Returns the keys that could not be deleted.
export async function deleteFiles(keys) {
  const { client, bucket } = r2();
  const list = [].concat(keys).filter(Boolean);
  const failed = [];
  for (let i = 0; i < list.length; i += 1000) {
    const chunk = list.slice(i, i + 1000);
    try {
      const res = await client.send(
        new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true } })
      );
      failed.push(...(res.Errors || []).map((e) => e.Key));
    } catch {
      failed.push(...chunk);
    }
  }
  return failed;
}

// Best-effort delete used by API routes, where a leftover file shouldn't fail the request.
export async function deleteStored(key) {
  if (key) await deleteFiles(key).catch(() => {});
}

// Lets browsers on these origins PUT uploads straight to the bucket.
export async function setCors(origins) {
  const { client, bucket } = r2();
  await client.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          { AllowedOrigins: origins, AllowedMethods: ['PUT'], AllowedHeaders: ['content-type'], MaxAgeSeconds: 3600 },
          { AllowedOrigins: ['*'], AllowedMethods: ['GET', 'HEAD'], AllowedHeaders: ['range'], MaxAgeSeconds: 3600 },
        ],
      },
    })
  );
}
