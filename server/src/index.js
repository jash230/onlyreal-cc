import { config } from './config.js';
import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { Feedback } from './models.js';
import { clerk, optionalUser } from './auth.js';
import { UPLOAD_DIR, CLIENT_DIST } from './paths.js';
import { ah } from './util.js';
import authRoutes from './routes/auth.js';
import videoRoutes from './routes/videos.js';
import userRoutes from './routes/users.js';
import uploadRoutes from './routes/uploads.js';

config.clerk; // fail at startup, not on the first request, when Clerk keys are missing

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '100kb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.use('/api', clerk);
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

app.post(
  '/api/feedback',
  optionalUser,
  ah(async (req, res) => {
    const message = String(req.body?.message || '').trim().slice(0, 2000);
    if (!message) return res.status(400).json({ error: 'Feedback cannot be empty' });
    await Feedback.create({ user: req.user?._id || null, message });
    res.status(201).json({ ok: true });
  })
);

app.get('/api/health', (_req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built client in production.
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  // Client errors (bad JSON, upload limits, …) carry their own status.
  if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message || 'Unauthorized' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

await mongoose.connect(config.mongoUri);

// On Vercel the exported app runs as a function; locally it listens itself.
if (!process.env.VERCEL) {
  app.listen(config.port, () => console.log(`OnlyReal API listening on http://localhost:${config.port}`));
}

export default app;
