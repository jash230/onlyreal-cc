import { Router } from 'express';
import { User, Follow } from '../models.js';
import { requireUser, optionalUser } from '../auth.js';
import { publicUser } from '../serializers.js';
import { ah, escapeRegex, isDuplicateKey } from '../util.js';
import { verifyUpload } from './uploads.js';

const router = Router();

const findByUsername = (username) => User.findOne({ usernameLower: String(username).toLowerCase() });

router.get(
  '/search',
  optionalUser,
  ah(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = q
      ? { $or: [{ usernameLower: new RegExp(escapeRegex(q.toLowerCase())) }, { displayName: new RegExp(escapeRegex(q), 'i') }] }
      : {};
    const users = await User.find(filter).sort({ followerCount: -1, createdAt: -1 }).limit(20);
    res.json({ users: await Promise.all(users.map((u) => publicUser(u, req.user))) });
  })
);

router.patch(
  '/me',
  requireUser,
  ah(async (req, res) => {
    const u = req.user;
    const { displayName, bio, avatarUrl } = req.body || {};
    if (displayName !== undefined) u.displayName = String(displayName).trim().slice(0, 50) || u.username;
    if (bio !== undefined) u.bio = String(bio).slice(0, 200);
    if (avatarUrl) u.avatarUrl = (await verifyUpload(avatarUrl, 'avatars', u)).url;
    await u.save();
    res.json({ user: await publicUser(u, u) });
  })
);

router.get(
  '/:username',
  optionalUser,
  ah(async (req, res) => {
    const user = await findByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: await publicUser(user, req.user) });
  })
);

router.post(
  '/:username/follow',
  requireUser,
  ah(async (req, res) => {
    const target = await findByUsername(req.params.username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target._id.equals(req.user._id)) return res.status(400).json({ error: "You can't follow yourself" });

    let following;
    if (await Follow.findOneAndDelete({ follower: req.user._id, following: target._id })) {
      following = false;
      await User.updateOne({ _id: target._id }, { $inc: { followerCount: -1 } });
    } else {
      try {
        await Follow.create({ follower: req.user._id, following: target._id });
        await User.updateOne({ _id: target._id }, { $inc: { followerCount: 1 } });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err;
      }
      following = true;
    }
    const { followerCount } = await User.findById(target._id, 'followerCount').lean();
    res.json({ following, followers: followerCount });
  })
);

export default router;
