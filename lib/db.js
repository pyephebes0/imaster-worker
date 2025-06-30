import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config(); // โหลด .env

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  throw new Error('MONGO_URI is not defined in .env');
}

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;
  await mongoose.connect(MONGO_URI, {
    dbName: 'xpost_app'
  });
  isConnected = true;
  console.log('MongoDB connected');
}

// ✅ แก้ตรงนี้: ตั้งชื่อ schema และเปิด timestamps
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
}, {
  timestamps: true, // ✅ สำคัญมาก
  versionKey: false  // ✅ ปิดไม่ให้สร้าง __v
});

// ✅ ใช้ชื่อ model ว่า 'User' ไม่ควรใช้ 'Users'
export const User = mongoose.models.User || mongoose.model('User', userSchema);

// TwitterAccount model แยกไฟล์ก็ได้ แต่ถ้าต้องการไว้ที่นี่

const twitterAccountSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    twitterId: { type: String, required: true },
    username: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true }
  },
  {
    timestamps: true
  }
);

export const TwitterAccount = mongoose.models.TwitterAccount || mongoose.model('TwitterAccount', twitterAccountSchema);