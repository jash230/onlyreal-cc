import mongoose from 'mongoose';

const { Schema, model, Types } = mongoose;
const ref = (name) => ({ type: Types.ObjectId, ref: name, required: true, index: true });

// Auth0 owns credentials; this is the app profile, created on first login (onboarding).
const userSchema = new Schema(
  {
    auth0Id: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    usernameLower: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    bio: { type: String, default: '' },
    avatarUrl: { type: String, default: null },
    birthDate: { type: String, required: true }, // YYYY-MM-DD, never exposed publicly
    termsAcceptedAt: { type: Date, required: true },
    followerCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const videoSchema = new Schema(
  {
    user: ref('User'),
    filename: { type: String, required: true },
    caption: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likeCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    hidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);
videoSchema.index({ hidden: 1, createdAt: -1 });

const likeSchema = new Schema({ user: ref('User'), video: ref('Video') }, { timestamps: true });
likeSchema.index({ user: 1, video: 1 }, { unique: true });

const followSchema = new Schema({ follower: ref('User'), following: ref('User') }, { timestamps: true });
followSchema.index({ follower: 1, following: 1 }, { unique: true });

const commentSchema = new Schema(
  { video: ref('Video'), user: ref('User'), body: { type: String, required: true } },
  { timestamps: true }
);

// Creator attestation recorded for every upload (age + consent of everyone depicted).
// Kept even if the video is deleted, for record-keeping.
const attestationSchema = new Schema(
  { video: ref('Video'), user: ref('User'), ip: String, filename: String },
  { timestamps: true }
);

const reportSchema = new Schema(
  {
    video: ref('Video'),
    reporter: { type: Types.ObjectId, ref: 'User', default: null },
    reason: {
      type: String,
      required: true,
      enum: ['underage', 'non_consensual', 'illegal', 'spam', 'copyright', 'other'],
    },
    details: { type: String, default: '' },
    status: { type: String, default: 'open', enum: ['open', 'resolved', 'dismissed'] },
  },
  { timestamps: true }
);

const feedbackSchema = new Schema(
  { user: { type: Types.ObjectId, ref: 'User', default: null }, message: { type: String, required: true } },
  { timestamps: true }
);

export const User = model('User', userSchema);
export const Video = model('Video', videoSchema);
export const Like = model('Like', likeSchema);
export const Follow = model('Follow', followSchema);
export const Comment = model('Comment', commentSchema);
export const ConsentAttestation = model('ConsentAttestation', attestationSchema);
export const Report = model('Report', reportSchema);
export const Feedback = model('Feedback', feedbackSchema);
