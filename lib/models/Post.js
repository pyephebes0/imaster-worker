// src/lib/server/models/Post.js
import mongoose from 'mongoose';

const PostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
  content: { type: String, required: true },
  duration: { type: Number, default: 0 }, // นาที
  imageUrl: { type: String, default: '' },
  lastPostedAt: { type: Date, default: null },
  status: { type: String, default: 'ready' }, // เพิ่มฟิลด์นี้ เก็บสถานะ เช่น 'ready', 'pending', 'posted', 'canceled'
  createdAt: { type: Date, default: Date.now }
});

export const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);
