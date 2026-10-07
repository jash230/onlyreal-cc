import { Bucket } from '@upstash/blob';

// Upstash Blob bucket (must be set to public in the Upstash console). Built lazily so the API and
// scripts that never touch storage start without UPSTASH_BLOB_TOKEN.
let bucket;
export function getBucket() {
  if (!process.env.UPSTASH_BLOB_TOKEN) {
    throw new Error('Missing required env var UPSTASH_BLOB_TOKEN (see server/.env.example)');
  }
  return (bucket ??= Bucket.fromEnv({ cache: 'immutable', enableTelemetry: false }));
}

// Best-effort delete of a stored file by its path. Missing objects count as deleted.
export async function deleteStored(pathname) {
  if (pathname) await getBucket().del(pathname).catch(() => {});
}
