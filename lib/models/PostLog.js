import mongoose from 'mongoose';

const PostLogSchema = new mongoose.Schema({
  postId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  twitterAccountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TwitterAccount',
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    default: 'success'
  },
  errorMessage: {
    type: String,
    default: null
  },
  tweetedAt: {
    type: Date,
    default: Date.now
  }
});

export const PostLog = mongoose.models.PostLog || mongoose.model('PostLog', PostLogSchema);
