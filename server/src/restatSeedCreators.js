// One-off: re-rolls follower counts, views, likes and captions for placeholder ("seed|") creators
// and their clips. Real users' accounts and clips are never touched. Comment counts are left alone
// so they keep matching the comments that actually exist.
// Usage (from server/): node src/restatSeedCreators.js [--apply]   — dry run unless --apply is passed.
import mongoose from 'mongoose';
import { config } from './config.js';
import { Like, Follow, User, Video } from './models.js';
import { captionPicker, clipStats, creatorFollowers } from './seedStats.js';

const apply = process.argv.includes('--apply');
await mongoose.connect(config.mongoUri);

const creators = await User.find({ clerkId: { $regex: '^seed\\|' } }).lean();
const nextCaption = captionPicker();
const userOps = [];
const videoOps = [];

for (const c of creators) {
  // Never below the real follows/likes on record, so unfollow/unlike can't go negative.
  const followers = Math.max(creatorFollowers(), await Follow.countDocuments({ following: c._id }));
  userOps.push({ updateOne: { filter: { _id: c._id }, update: { $set: { followerCount: followers } } } });
  const clips = await Video.find({ user: c._id }).lean();
  for (const v of clips) {
    const { views, likeCount } = clipStats(followers, v.createdAt);
    const realLikes = await Like.countDocuments({ video: v._id });
    const set = { views, likeCount: Math.max(likeCount, realLikes), caption: nextCaption() };
    videoOps.push({ updateOne: { filter: { _id: v._id }, update: { $set: set } } });
  }
  console.log(`@${c.username}: ${followers} followers, ${clips.length} clips`);
}

for (const op of videoOps.slice(0, 8)) console.log('  e.g.', op.updateOne.update.$set);
if (apply) {
  await User.bulkWrite(userOps);
  await Video.bulkWrite(videoOps);
  console.log(`Updated ${userOps.length} creators and ${videoOps.length} clips.`);
} else {
  console.log(`Dry run: would update ${userOps.length} creators and ${videoOps.length} clips. Pass --apply to write.`);
}
await mongoose.disconnect();
