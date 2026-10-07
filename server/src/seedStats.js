// Believable starting numbers and captions for placeholder creators' clips. Counts are skewed
// (log-normal): most clips are modest, a few take off, and nothing lands on round numbers.

const CAPTIONS = [
  '', '', '', '',
  'new one 🔥',
  'golden hour hits different',
  'what do you think? be honest',
  'late night, can’t sleep',
  'couldn’t wait to post this one',
  'part 2? 👀',
  'felt cute, might delete later',
  'rate it 1-10 👇',
  'this one’s just for you',
  'weekend mood',
  'took me way too many tries to get this',
  'ok this might be my favorite so far',
  'you asked, so here it is',
  'sunday reset ☀️',
  'can’t believe I’m posting this lol',
  'outfit or the view?',
  'shot this before the rain came in',
  'lighting was too good not to film',
  'mirror check 🪞',
  'one of those days',
  'more of this soon, promise',
  'tell me your favorite part',
  'bored at home so…',
  'first time trying this, be nice',
  'pov: you’re here with me',
  'saved the best for last',
  'hotel room light >>',
  'missed posting here 🖤',
  'caught in the moment',
  'should I do a longer version?',
  'red or black next time?',
  'gym done, now this',
  'morning light is unreal',
  'swipe if you’re shy 😏',
  'beach day leftovers',
  'filmed this at 2am don’t judge me',
  'my roommate thinks I’m crazy',
  'slow mornings',
  'can you tell I was nervous?',
  'new hair, who dis',
  'friday energy',
  'no filter on this one',
  'trying something different today',
  'should’ve posted this weeks ago',
  'which angle is better?',
  'vacation mode 🌴',
  'the sound on this 🔊',
  'pretend you didn’t see this',
  'quick one before work',
  'had to share this one',
  'requested 💌',
];

// Box-Muller: a standard normal sample.
function normal() {
  return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
}
const logNormal = (median, spread) => median * Math.exp(normal() * spread);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// Hands out captions without repeats until the pool runs out (empty captions can repeat).
export function captionPicker() {
  let pool = [];
  return () => {
    if (!pool.length) pool = [...CAPTIONS].sort(() => Math.random() - 0.5);
    return pool.pop();
  };
}

// Follower count for a placeholder creator: median ~3k, occasionally tens of thousands.
export function creatorFollowers() {
  return Math.round(clamp(logNormal(3200, 1.1), 240, 180000));
}

// Views and likes for one clip: 1–20 likes (skewed low, older clips a little higher), and views
// at a ~10–30% like rate so they stay proportional, capped at 200.
export function clipStats(followers, createdAt = new Date()) {
  const daysOld = (Date.now() - createdAt) / 864e5;
  const age = 0.6 + 0.4 * (1 - Math.exp(-daysOld / 4));
  const likeCount = Math.round(clamp(logNormal(7, 0.6) * age, 1, 20));
  const likeRate = 0.1 + Math.random() * 0.2;
  const views = Math.round(clamp(likeCount / likeRate, likeCount + 1, 200));
  return { views, likeCount };
}
