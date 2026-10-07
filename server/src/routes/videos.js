import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { Video, Like, Follow, Comment, ConsentAttestation, Report, User } from '../models.js';
import { requireUser, optionalUser } from '../auth.js';
import { videoDto, videoDtos, authorDto } from '../serializers.js';
import { UPLOAD_DIR } from '../paths.js';
import { ah, isId, isDuplicateKey } from '../util.js';

const router = Router();
const PAGE_SIZE = 10;
const ALLOWED = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const REPORT_REASONS = new Set(['underage', 'non_consensual', 'illegal', 'spam', 'copyright', 'other']);

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only MP4, WebM or MOV videos are allowed'));
  },
});

const page = (req) => Math.max(0, parseInt(req.query.page, 10) || 0);

async function sendPage(res, videos, viewer) {
  res.json({ videos: await videoDtos(videos, viewer), hasMore: videos.length === PAGE_SIZE });
}

// Rejects bad ObjectIds with 404 before any route touches the DB.
router.param('id', (req, res, next, id) => (isId(id) ? next() : res.status(404).json({ error: 'Video not found' })));

// For You: blend of engagement and recency.
router.get(
  '/feed',
  optionalUser,
  ah(async (req, res) => {
    const hoursOld = { $divide: [{ $subtract: ['$$NOW', '$createdAt'] }, 3600000] };
    const docs = await Video.aggregate([
      { $match: { hidden: false } },
      {
        $addFields: {
          score: {
            $divide: [
              { $add: [{ $multiply: ['$likeCount', 3] }, { $multiply: ['$commentCount', 5] }, { $multiply: ['$views', 0.1] }] },
              { $pow: [{ $add: [hoursOld, 2] }, 1.5] },
            ],
          },
        },
      },
      { $sort: { score: -1, _id: -1 } },
      { $skip: page(req) * PAGE_SIZE },
      { $limit: PAGE_SIZE },
    ]);
    await Video.populate(docs, { path: 'user' });
    await sendPage(res, docs, req.user);
  })
);

router.get(
  '/following',
  requireUser,
  ah(async (req, res) => {
    const ids = await Follow.find({ follower: req.user._id }).distinct('following');
    const videos = await Video.find({ hidden: false, user: { $in: ids } })
      .sort({ createdAt: -1, _id: -1 })
      .skip(page(req) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('user')
      .lean();
    await sendPage(res, videos, req.user);
  })
);

router.get(
  '/trending',
  optionalUser,
  ah(async (req, res) => {
    const videos = await Video.find({ hidden: false, createdAt: { $gte: new Date(Date.now() - 7 * 864e5) } })
      .sort({ likeCount: -1, views: -1 })
      .limit(24)
      .populate('user')
      .lean();
    res.json({ videos: await videoDtos(videos, req.user) });
  })
);

router.get(
  '/user/:username',
  optionalUser,
  ah(async (req, res) => {
    const owner = await User.findOne({ usernameLower: req.params.username.toLowerCase() }, '_id');
    if (!owner) return res.json({ videos: [] });
    const videos = await Video.find({ hidden: false, user: owner._id })
      .sort({ createdAt: -1 })
      .limit(60)
      .populate('user')
      .lean();
    res.json({ videos: await videoDtos(videos, req.user) });
  })
);

router.get(
  '/:id',
  optionalUser,
  ah(async (req, res) => {
    const video = await Video.findOne({ _id: req.params.id, hidden: false }).populate('user').lean();
    if (!video?.user) return res.status(404).json({ error: 'Video not found' });
    res.json({ video: await videoDto(video, req.user) });
  })
);

router.post('/', requireUser, (req, res, next) => {
  upload.single('video')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Choose a video to upload' });

    const discard = () => fs.unlink(req.file.path, () => {});
    if (req.body.attestAge !== 'true' || req.body.attestConsent !== 'true') {
      discard();
      return res.status(400).json({
        error: 'You must confirm everyone in the video is 18+ and consented to filming and publishing',
      });
    }

    let video;
    try {
      video = await Video.create({
        user: req.user._id,
        filename: req.file.filename,
        caption: String(req.body.caption || '').slice(0, 300),
      });
      await ConsentAttestation.create({ video: video._id, user: req.user._id, ip: req.ip, filename: video.filename });
    } catch (e) {
      // No multi-document transactions on standalone Mongo: undo by hand.
      if (video) await Video.deleteOne({ _id: video._id }).catch(() => {});
      discard();
      return next(e);
    }

    video.user = req.user;
    res.status(201).json({ video: await videoDto(video, req.user) });
  });
});

router.delete(
  '/:id',
  requireUser,
  ah(async (req, res) => {
    const video = await Video.findById(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video not found' });
    if (!video.user.equals(req.user._id)) return res.status(403).json({ error: 'Not your video' });
    await Promise.all([
      Video.deleteOne({ _id: video._id }),
      Like.deleteMany({ video: video._id }),
      Comment.deleteMany({ video: video._id }),
    ]);
    fs.unlink(path.join(UPLOAD_DIR, video.filename), () => {});
    res.status(204).end();
  })
);

router.post(
  '/:id/view',
  ah(async (req, res) => {
    await Video.updateOne({ _id: req.params.id }, { $inc: { views: 1 } });
    res.status(204).end();
  })
);

router.post(
  '/:id/like',
  requireUser,
  ah(async (req, res) => {
    const id = req.params.id;
    if (!(await Video.exists({ _id: id }))) return res.status(404).json({ error: 'Video not found' });

    let liked;
    if (await Like.findOneAndDelete({ user: req.user._id, video: id })) {
      liked = false;
      await Video.updateOne({ _id: id }, { $inc: { likeCount: -1 } });
    } else {
      try {
        await Like.create({ user: req.user._id, video: id });
        await Video.updateOne({ _id: id }, { $inc: { likeCount: 1 } });
      } catch (err) {
        if (!isDuplicateKey(err)) throw err; // double-tap race: already liked
      }
      liked = true;
    }
    const { likeCount } = await Video.findById(id, 'likeCount').lean();
    res.json({ liked, likeCount });
  })
);

router.get(
  '/:id/comments',
  ah(async (req, res) => {
    const comments = await Comment.find({ video: req.params.id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('user')
      .lean();
    res.json({
      comments: comments
        .filter((c) => c.user)
        .map((c) => ({ id: String(c._id), body: c.body, createdAt: c.createdAt, author: authorDto(c.user) })),
    });
  })
);

router.post(
  '/:id/comments',
  requireUser,
  ah(async (req, res) => {
    const id = req.params.id;
    const body = String(req.body?.body || '').trim().slice(0, 500);
    if (!body) return res.status(400).json({ error: 'Comment cannot be empty' });
    if (!(await Video.exists({ _id: id }))) return res.status(404).json({ error: 'Video not found' });
    const comment = await Comment.create({ video: id, user: req.user._id, body });
    await Video.updateOne({ _id: id }, { $inc: { commentCount: 1 } });
    res.status(201).json({
      comment: { id: String(comment._id), body, createdAt: comment.createdAt, author: authorDto(req.user, req.user) },
    });
  })
);

router.post(
  '/:id/report',
  optionalUser,
  ah(async (req, res) => {
    const id = req.params.id;
    const { reason, details } = req.body || {};
    if (!REPORT_REASONS.has(reason)) return res.status(400).json({ error: 'Pick a reason' });
    if (!(await Video.exists({ _id: id }))) return res.status(404).json({ error: 'Video not found' });
    await Report.create({
      video: id,
      reporter: req.user?._id || null,
      reason,
      details: String(details || '').slice(0, 1000),
    });
    // Hide immediately pending review for the most serious categories.
    if (reason === 'underage' || reason === 'non_consensual') {
      await Video.updateOne({ _id: id }, { hidden: true });
    }
    res.status(201).json({ ok: true });
  })
);

export default router;
