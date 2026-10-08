import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { config } from './config.js';

// 10 requests per 10 seconds per IP, shared across every server instance via Upstash Redis.
const ratelimit = config.upstash
  ? new Ratelimit({
      redis: new Redis(config.upstash),
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      prefix: 'onlyreal:ratelimit',
    })
  : null;

if (!ratelimit) console.warn('UPSTASH_REDIS_REST_URL/TOKEN not set; rate limiting is disabled');

export async function rateLimit(req, res, next) {
  if (!ratelimit) return next();
  try {
    // 'trust proxy' is set, so req.ip is the client address forwarded by Vercel.
    const { success, limit, remaining, reset } = await ratelimit.limit(req.ip || 'unknown');
    res.set({
      'RateLimit-Limit': String(limit),
      'RateLimit-Remaining': String(remaining),
      'RateLimit-Reset': String(Math.max(0, Math.ceil((reset - Date.now()) / 1000))),
    });
    if (!success) {
      res.set('Retry-After', res.get('RateLimit-Reset'));
      return res.status(429).json({ error: 'Too many requests, slow down' });
    }
  } catch (err) {
    // Fail open: a Redis outage shouldn't take the whole API down with it.
    console.error('Rate limit check failed', err);
  }
  next();
}
