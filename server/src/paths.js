import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Vercel functions can only write to /tmp, which is per-instance and wiped between invocations.
export const UPLOAD_DIR =
  process.env.UPLOAD_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '..', 'uploads'));
export const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
