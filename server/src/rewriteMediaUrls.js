// One-off: point stored media URLs at the R2 custom domain instead of the disabled r2.dev URL.
// Usage (from server/): node src/rewriteMediaUrls.js [--apply]   — dry run unless --apply is passed.
import mongoose from 'mongoose';
import { config } from './config.js';
import { User, Video } from './models.js';

const OLD = 'https://pub-b2c552dcc42e438ebdd3f1cd1f3dfe31.r2.dev/';
const NEW = 'https://media.onlyreal.cc/';
const apply = process.argv.includes('--apply');

await mongoose.connect(config.mongoUri);

for (const [Model, field] of [[Video, 'url'], [User, 'avatarUrl']]) {
  const filter = { [field]: { $regex: '^' + OLD.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } };
  const count = await Model.countDocuments(filter);
  console.log(`${Model.modelName}.${field}: ${count} to rewrite`);
  if (apply && count) {
    const res = await Model.updateMany(filter, [
      { $set: { [field]: { $concat: [NEW, { $substrCP: [`$${field}`, OLD.length, 100000] }] } } },
    ]);
    console.log(`  updated ${res.modifiedCount}`);
  }
}

await mongoose.disconnect();
