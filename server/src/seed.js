// Creates demo creators (placeholder accounts with no Clerk login) and SFW placeholder clips (requires ffmpeg). Run: npm --prefix server run seed
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from './config.js';
import { User, Video, Like, Follow, ConsentAttestation } from './models.js';
import { UPLOAD_DIR } from './paths.js';

const CREATORS = [
  { username: 'luna', display: 'Luna', bio: 'Night owl. New clips every Friday.', color: '0xff2d6f' },
  { username: 'jade.rae', display: 'Jade Rae', bio: 'Dancer · traveler', color: '0x7c5cff' },
  { username: 'max_on', display: 'Max', bio: 'Fitness and behind-the-scenes.', color: '0x00c2a8' },
  { username: 'sienna', display: 'Sienna', bio: 'Just vibes.', color: '0xff9f1c' },
];
const CAPTIONS = ['first one here 👋', 'golden hour', 'what do you think?', 'new set dropping soon', 'late night'];

function makeClip(color) {
  const filename = `${crypto.randomUUID()}.mp4`;
  const out = path.join(UPLOAD_DIR, filename);
  execFileSync('ffmpeg', [
    '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `color=c=${color}:s=540x960:d=6:r=30`,
    '-f', 'lavfi', '-i', 'sine=frequency=220:duration=6',
    '-vf', `drawbox=x='(iw-200)/2+150*sin(t*2)':y='ih/2-100+200*cos(t*1.3)':w=200:h=200:color=white@0.35:t=fill`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', '-movflags', '+faststart',
    out,
  ]);
  return filename;
}

await mongoose.connect(config.mongoUri);

const users = [];
for (const [n, c] of CREATORS.entries()) {
  let user = await User.findOne({ usernameLower: c.username });
  if (user) {
    users.push(user);
    continue;
  }
  // "seed|" ids never match a real Clerk user id (user_…), so nobody can log in as these.
  user = await User.create({
    clerkId: `seed|${c.username}`,
    username: c.username,
    usernameLower: c.username,
    displayName: c.display,
    bio: c.bio,
    birthDate: '1995-06-15',
    termsAcceptedAt: new Date(),
  });
  users.push(user);
  for (let i = 0; i < 2; i++) {
    const video = await Video.create({
      user: user._id,
      filename: makeClip(c.color),
      caption: CAPTIONS[(i + n) % CAPTIONS.length],
      views: Math.floor(Math.random() * 5000),
      createdAt: new Date(Date.now() - (i * 7 + n + 1) * 3600e3),
    });
    await ConsentAttestation.create({ video: video._id, user: user._id, ip: 'seed', filename: video.filename });
  }
  console.log(`created @${c.username}`);
}

// Some cross-follows and likes so counts aren't all zero.
const videos = await Video.find({ user: { $in: users.map((u) => u._id) } });
for (const a of users) {
  for (const b of users) {
    if (a.equals(b) || Math.random() > 0.6) continue;
    const res = await Follow.updateOne({ follower: a._id, following: b._id }, {}, { upsert: true });
    if (res.upsertedCount) await User.updateOne({ _id: b._id }, { $inc: { followerCount: 1 } });
  }
  for (const v of videos) {
    if (Math.random() > 0.5) continue;
    const res = await Like.updateOne({ user: a._id, video: v._id }, {}, { upsert: true });
    if (res.upsertedCount) await Video.updateOne({ _id: v._id }, { $inc: { likeCount: 1 } });
  }
}

console.log('Seed done.');
await mongoose.disconnect();
