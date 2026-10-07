// Imports the site owner's own clips from a folder: creates placeholder creators (no Clerk login),
// uploads each clip to Vercel Blob and spreads them across those creators. Safe to re-run: clips
// already imported are skipped. Needs BLOB_READ_WRITE_TOKEN.
// Run: npm --prefix server run import-videos -- ../videos
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { put } from '@vercel/blob';
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
const CONCURRENCY = 4;

const dir = path.resolve(process.argv[2] || path.join(process.cwd(), '..', 'videos'));
if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Missing BLOB_READ_WRITE_TOKEN (run `vercel env pull` in server/)');
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
let skipped = 0;
let failed = 0;
const queue = files.map((file, i) => ({ file, user: users[i % users.length] }));

// Matched by filename alone (any creator, original or -h264 copy): which creator a file is dealt
// to shifts whenever the folder changes, so the full pathname can't identify an earlier import.
const base = (f) => path.basename(f).replace(/-h264\.mp4$/, path.extname(f) === '.mp4' ? '.mp4' : '$&');
const imported = new Set((await Video.find({ filename: { $regex: '^videos/' } }, 'filename').lean()).map((v) => base(v.filename)));

async function importOne({ file, user }) {
  const pathname = `videos/${user._id}/${file}`;
  if (imported.has(file)) return skipped++;
  const contentType = file.endsWith('.webm') ? 'video/webm' : file.endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  const blob = await put(pathname, fs.createReadStream(path.join(dir, file)), {
    access: 'public',
    contentType,
    multipart: true,
    allowOverwrite: true,
  });
  const views = Math.floor(Math.random() * 20000);
  const video = await Video.create({
    user: user._id,
    filename: blob.pathname,
    url: blob.url,
    caption: pick(CAPTIONS),
    views,
    createdAt: new Date(Date.now() - Math.random() * 30 * 864e5),
  });
  // Attested by the site owner at import time, not by the placeholder account.
  await ConsentAttestation.create({ video: video._id, user: user._id, ip: 'owner-import', filename: video.filename });
  done++;
  console.log(`[${done + skipped + failed}/${files.length}] ${file} → @${user.username}`);
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

console.log(`Done: ${done} imported, ${skipped} already there, ${failed} failed.`);
await mongoose.disconnect();
