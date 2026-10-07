// One-off: re-rolls views and likes on placeholder ("seed|") creators' clips using clipStats.
// Captions, follower counts and real users' clips are left alone.
// Usage (from server/): node src/restatClipCounts.js [--apply]   — dry run unless --apply is passed.
import mongoose from 'mongoose';
import { config } from './config.js';
import { Like, User, Video } from './models.js';
import { clipStats } from './seedStats.js';

const apply = process.argv.includes('--apply');
await mongoose.connect(config.mongoUri);

const creators = await User.find({ clerkId: { $regex: '^seed\\|' } }, '_id').lean();
const clips = await Video.find({ user: { $in: creators.map((c) => c._id) } }, 'createdAt').lean();
const ops = [];
for (const v of clips) {
  const { views, likeCount } = clipStats(0, v.createdAt);
  // Never below the real likes on record, so unlike can't go negative.
  const realLikes = await Like.countDocuments({ video: v._id });
  const likes = Math.max(likeCount, realLikes);
  const scaledViews = Math.round(Math.min(200, (views * likes) / likeCount));
  ops.push({ updateOne: { filter: { _id: v._id }, update: { $set: { likeCount: likes, views: scaledViews } } } });
}

for (const op of ops.slice(0, 8)) console.log('  e.g.', op.updateOne.update.$set);
if (apply) {
  await Video.bulkWrite(ops);
  console.log(`Updated ${ops.length} clips.`);
} else {
  console.log(`Dry run: would update ${ops.length} clips. Pass --apply to write.`);
}
await mongoose.disconnect();
