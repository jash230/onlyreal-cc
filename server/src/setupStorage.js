// One-time R2 bucket setup: allows browsers on the site's origins to PUT uploads straight to the
// bucket (CORS). Origins come from the arguments, else CLIENT_ORIGIN. Re-run after adding a domain.
// Run: npm --prefix server run setup-storage -- https://your-domain.com http://localhost:5173
import 'dotenv/config';
import { setCors } from './blob.js';

const origins = process.argv.slice(2).length ? process.argv.slice(2) : [process.env.CLIENT_ORIGIN || 'http://localhost:5173'];
await setCors(origins);
console.log(`R2 bucket now accepts browser uploads from: ${origins.join(', ')}`);
