import mongoose from 'mongoose';

// Express 4 doesn't forward rejected promises to the error handler.
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const isId = (id) => mongoose.isValidObjectId(id);

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const isDuplicateKey = (err) => err?.code === 11000;
