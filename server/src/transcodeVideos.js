// Re-encodes imported clips that browsers can't play reliably (HEVC, or moov atom at the end so
// playback waits for the whole file) to H.264 + faststart, uploads the new file to Vercel Blob,
// repoints the Video record and deletes the old blob. Uses the local originals from the import
// folder (matched by filename). Safe to re-run. Needs ffmpeg and BLOB_READ_WRITE_TOKEN.
// Run: npm --prefix server run transcode-videos -- ../videos
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { put, del } from '@vercel/blob';
import { config } from './config.js';
import { Video } from './models.js';

const CONCURRENCY = 3;
const SUFFIX = '-h264.mp4';

const dir = path.resolve(process.argv[2] || path.join(process.cwd(), '..', 'videos'));
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Missing BLOB_READ_WRITE_TOKEN');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyreal-transcode-'));

const probe = (file, args) => execFileSync('ffprobe', ['-v', 'error', ...args, file], { encoding: 'utf8' }).trim();

function needsTranscode(file) {
  const codec = probe(file, ['-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0']);
  if (codec !== 'h264') return true;
  // Top-level atom order: playback can only start early when moov comes before mdat.
  const trace = execFileSync('ffprobe', ['-v', 'trace', file], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 512 * 1024 * 1024 });
  return /type:'mdat'/.test(trace.split(/type:'moov'/)[0]);
}

function transcode(src, out) {
  const hasAudio = probe(src, ['-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0']) !== '';
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y', '-i', src,
    '-map', '0:v:0', ...(hasAudio ? ['-map', '0:a:0', '-c:a', 'aac', '-b:a', '128k'] : []),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', // H.264 needs even dimensions
    '-movflags', '+faststart',
    out,
  ]);
}

await mongoose.connect(config.mongoUri);

const videos = await Video.find({ url: { $ne: null }, filename: { $regex: '^videos/' } });
const jobs = [];
for (const v of videos) {
  if (v.filename.endsWith(SUFFIX)) continue; // already done
  const src = path.join(dir, path.basename(v.filename));
  if (!fs.existsSync(src)) continue; // not one of the imported files
  if (needsTranscode(src)) jobs.push({ v, src });
}
const total = jobs.length;
console.log(`${total} of ${videos.length} clips need re-encoding`);

let done = 0;
let failed = 0;
async function run({ v, src }) {
  const out = path.join(tmp, path.basename(src, path.extname(src)) + SUFFIX);
  transcode(src, out);
  const pathname = v.filename.replace(/\.[^.]+$/, SUFFIX);
  const blob = await put(pathname, fs.createReadStream(out), {
    access: 'public',
    contentType: 'video/mp4',
    multipart: true,
    allowOverwrite: true,
  });
  const oldUrl = v.url;
  await Video.updateOne({ _id: v._id }, { $set: { url: blob.url, filename: blob.pathname } });
  await del(oldUrl).catch(() => {});
  fs.unlinkSync(out);
  done++;
  console.log(`[${done + failed}/${total}] ${path.basename(src)} → ${path.basename(pathname)}`);
}

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job; (job = jobs.shift()); ) {
      await run(job).catch((e) => {
        failed++;
        console.error(`✗ ${path.basename(job.src)}: ${e.message}`);
      });
    }
  })
);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Done: ${done} re-encoded, ${failed} failed.`);
await mongoose.disconnect();
