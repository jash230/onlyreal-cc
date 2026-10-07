// Imports the site owner's own clips from a folder: creates placeholder creators (no Clerk login),
// uploads each clip to Cloudflare R2 and spreads them across those creators. Clips browsers can't
// play reliably (HEVC, or moov atom after the media) are re-encoded to H.264 + faststart first.
// Safe to re-run: clips already in R2 are skipped, and clips imported earlier to another store
// (Vercel Blob) are re-uploaded and repointed, keeping their likes and views.
// Needs ffmpeg and the R2_* env vars.
// Run: npm --prefix server run import-videos -- ../videos
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { putFile, isStoredUrl } from './blob.js';
import { config } from './config.js';
import { User, Video, Like, Follow, ConsentAttestation } from './models.js';

const CREATORS = [
  { username: 'ava.noir', display: 'Ava Noir', bio: 'New clips every week 🖤' },
  { username: 'mila_x', display: 'Mila', bio: 'Soft girl, loud laugh.' },
  { username: 'roxy.vibes', display: 'Roxy', bio: 'Just here for a good time.' },
  { username: 'nova.rae', display: 'Nova Rae', bio: 'Dancer · night owl' },
  { username: 'kaylee', display: 'Kaylee', bio: 'Behind the scenes, unfiltered.' },
  { username: 'scarlett.j', display: 'Scarlett', bio: 'Red is my color.' },
  { username: 'bella_b', display: 'Bella B', bio: 'Gym, sun, repeat.' },
  { username: 'ivy.moon', display: 'Ivy Moon', bio: 'Late nights only 🌙' },
  { username: 'chloe.rose', display: 'Chloe Rose', bio: 'Say hi 👋' },
  { username: 'zara.lux', display: 'Zara', bio: 'Travel + vibes.' },
  { username: 'lexi.k', display: 'Lexi', bio: 'Your new favorite.' },
  { username: 'sky.blue', display: 'Sky', bio: 'Golden hour enjoyer.' },
];
const CAPTIONS = [
  'new one 🔥', 'golden hour', 'what do you think?', 'late night', 'couldn’t wait to post this',
  'part 2 soon', 'felt cute', 'rate it 1-10', 'just for you', 'weekend mood', '', 'more coming 👀',
];
const CONCURRENCY = 3;
const H264_SUFFIX = '-h264.mp4';

const dir = path.resolve(process.argv[2] || path.join(process.cwd(), '..', 'videos'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'onlyreal-import-'));
const files = fs.readdirSync(dir).filter((f) => /\.(mp4|webm|mov)$/i.test(f)).sort();
if (!files.length) throw new Error(`No videos in ${dir}`);

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

await mongoose.connect(config.mongoUri);

const users = [];
for (const c of CREATORS) {
  // "seed|" ids never match a real Clerk user id (user_…), so nobody can log in as these.
  const user = await User.findOneAndUpdate(
    { usernameLower: c.username },
    {
      $setOnInsert: {
        clerkId: `seed|${c.username}`,
        username: c.username,
        usernameLower: c.username,
        displayName: c.display,
        bio: c.bio,
        birthDate: '1998-03-21',
        termsAcceptedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
  users.push(user);
}
console.log(`${users.length} creators ready, importing ${files.length} clips from ${dir}`);

let done = 0;
let moved = 0;
let skipped = 0;
let failed = 0;
const queue = files.map((file, i) => ({ file, user: users[i % users.length] }));

// Matched by filename alone (any creator, original or -h264 copy): which creator a file is dealt
// to shifts whenever the folder changes, so the full pathname can't identify an earlier import.
const original = (f) => path.basename(f).replace(new RegExp(`${H264_SUFFIX}$`), '.mp4');
const existing = new Map(
  (await Video.find({ filename: { $regex: '^videos/' } }, 'filename url user').lean()).map((v) => [original(v.filename), v])
);

const probe = (file, args) => execFileSync('ffprobe', ['-v', 'error', ...args, file], { encoding: 'utf8' }).trim();

function needsTranscode(file) {
  const codec = probe(file, ['-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0']);
  if (codec !== 'h264') return true;
  // Top-level atom order: playback can only start early when moov comes before mdat.
  // ffprobe writes its trace to stderr.
  const trace = spawnSync('ffprobe', ['-v', 'trace', file], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 }).stderr;
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

// Uploads the browser-safe version of a clip; returns its { key, url }.
async function upload(file, owner) {
  let src = path.join(dir, file);
  let name = file;
  let contentType = file.endsWith('.webm') ? 'video/webm' : file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  if (needsTranscode(src)) {
    name = path.basename(file, path.extname(file)) + H264_SUFFIX;
    contentType = 'video/mp4';
    transcode(src, (src = path.join(tmp, name)));
  }
  try {
    // A Buffer (not a stream) so the S3 client can retry a dropped connection.
    const body = fs.readFileSync(src);
    return await putFile(`videos/${owner}/${name}`, body, contentType, body.length);
  } finally {
    if (src.startsWith(tmp)) fs.rmSync(src, { force: true });
  }
}

async function importOne({ file, user }) {
  const prior = existing.get(file);
  if (prior?.url && isStoredUrl(prior.url)) return skipped++;
  const n = done + moved + skipped + failed + 1;
  if (prior) {
    // Imported earlier to another store: same record, same creator, new file location.
    const blob = await upload(file, prior.user);
    await Video.updateOne({ _id: prior._id }, { $set: { filename: blob.key, url: blob.url } });
    moved++;
    return console.log(`[${n}/${files.length}] ${file} → moved to R2`);
  }
  const blob = await upload(file, user._id);
  const video = await Video.create({
    user: user._id,
    filename: blob.key,
    url: blob.url,
    caption: pick(CAPTIONS),
    views: Math.floor(Math.random() * 20000),
    createdAt: new Date(Date.now() - Math.random() * 30 * 864e5),
  });
  // Attested by the site owner at import time, not by the placeholder account.
  await ConsentAttestation.create({ video: video._id, user: user._id, ip: 'owner-import', filename: video.filename });
  done++;
  console.log(`[${n}/${files.length}] ${file} → @${user.username}`);
}

await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let job; (job = queue.shift()); ) {
      await importOne(job).catch((e) => {
        failed++;
        console.error(`✗ ${job.file}: ${e.message}`);
      });
    }
  })
);

// Cross-follows and some likes so counts aren't all zero (idempotent via unique indexes).
const videos = await Video.find({ user: { $in: users.map((u) => u._id) } }, '_id');
for (const a of users) {
  for (const b of users) {
    if (a.equals(b) || Math.random() > 0.5) continue;
    const res = await Follow.updateOne({ follower: a._id, following: b._id }, {}, { upsert: true });
    if (res.upsertedCount) await User.updateOne({ _id: b._id }, { $inc: { followerCount: 1 } });
  }
  for (const v of videos) {
    if (Math.random() > 0.4) continue;
    const res = await Like.updateOne({ user: a._id, video: v._id }, {}, { upsert: true });
    if (res.upsertedCount) await Video.updateOne({ _id: v._id }, { $inc: { likeCount: 1 } });
  }
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`Done: ${done} imported, ${moved} moved to R2, ${skipped} already there, ${failed} failed.`);
await mongoose.disconnect();
