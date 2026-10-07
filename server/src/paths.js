import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
export const CLIENT_DIST = path.join(__dirname, '..', '..', 'client', 'dist');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
