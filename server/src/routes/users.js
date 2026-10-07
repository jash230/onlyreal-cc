import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { User, Follow } from '../models.js';
import { requireUser, optionalUser } from '../auth.js';
import { publicUser } from '../serializers.js';
import { UPLOAD_DIR } from '../paths.js';
import { ah, escapeRegex, isDuplicateKey } from '../util.js';

const router = Router();

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) =>
      cb(null, `avatar-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase() || '.jpg'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Avatar must be an image'));
  },
});

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

router.patch('/me', requireUser, (req, res, next) => {
  avatarUpload.single('avatar')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      const u = req.user;
      if (req.body.displayName !== undefined) u.displayName = String(req.body.displayName).trim().slice(0, 50) || u.username;
      if (req.body.bio !== undefined) u.bio = String(req.body.bio).slice(0, 200);
      if (req.file) u.avatarUrl = `/uploads/${req.file.filename}`;
      await u.save();
      res.json({ user: await publicUser(u, u) });
    } catch (e) {
      next(e);
    }
  });
});

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
