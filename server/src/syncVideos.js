// Removes imported clips whose original file is no longer in the import folder: deletes the Video
// record, its likes and comments, and the blob (attestations are kept, as with any deletion).
// Dry run unless --apply is passed.
// Run: npm --prefix server run sync-videos -- ../videos [--apply]
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { deleteFiles } from './blob.js';
import { config } from './config.js';
import { Video, Like, Comment } from './models.js';

const apply = process.argv.includes('--apply');
const dir = path.resolve(process.argv.slice(2).find((a) => !a.startsWith('--')) || path.join(process.cwd(), '..', 'videos'));
const local = new Set(fs.readdirSync(dir));
if (!local.size) throw new Error(`${dir} is empty; refusing to delete every imported clip`);

// Transcoded copies are stored as <name>-h264.mp4; match them back to the original filename.
const original = (filename) => path.basename(filename).replace(/-h264\.mp4$/, '.mp4');

await mongoose.connect(config.mongoUri);

const imported = await Video.find({ filename: { $regex: '^videos/' } }, 'filename url likeCount').lean();
const gone = imported.filter((v) => !local.has(original(v.filename)));
console.log(`${imported.length} imported clips, ${gone.length} no longer in ${dir}`);

if (!apply) {
  console.log('Dry run. Re-run with --apply to delete them.');
} else {
  const ids = gone.map((v) => v._id);
  const [videos, likes, comments] = await Promise.all([
    Video.deleteMany({ _id: { $in: ids } }),
    Like.deleteMany({ video: { $in: ids } }),
    Comment.deleteMany({ video: { $in: ids } }),
  ]);
  // Clips still pointing at the old Vercel store have nothing in R2; deleting their keys is a no-op.
  const failed = gone.length ? await deleteFiles(gone.map((v) => v.filename)) : [];
  console.log(`Deleted ${videos.deletedCount} clips, ${likes.deletedCount} likes, ${comments.deletedCount} comments`);
  if (failed.length) {
    // The records are gone, so a re-run won't find these again; keep the paths for a later cleanup.
    const out = path.resolve('blob-delete-failed.json');
    fs.writeFileSync(out, JSON.stringify(failed, null, 2));
    console.log(`${failed.length} files could not be deleted; paths saved to ${out}`);
  } else console.log('Blobs removed.');
}

await mongoose.disconnect();
