// src/lib/server/worker.js
import { Worker } from 'bullmq';
import { connection } from './redisConnection.js';
import { connectDB } from './db.js';
import { tweetToTwitterAccount } from './twitter-api/twitterClient.js';
import { PostLog } from './models/PostLog.js';
import { getTwitterAccountsByUserId } from './models/TwitterAccount.js';
import { Post } from './models/Post.js';

console.log('👷‍♂️ [INIT] worker.js started');

// สร้าง Worker ที่ฟัง Queue ชื่อ 'post-queue'
const worker = new Worker(
  'post-queue',
  async job => {
    try {
      console.log(`📥 รับงาน: [${job.id}] ${job.name}`, job.data);

      // เชื่อมต่อ MongoDB
      await connectDB();

      const { userId, postId } = job.data;

      // ดึงโพสต์จากฐานข้อมูล
      const post = await Post.findById(postId);
      if (!post) {
        console.warn(`⚠️ ไม่พบโพสต์ในฐานข้อมูล: ${postId}`);
        return;
      }

      // ดึงบัญชี Twitter ของ user
      const twitterAccounts = await getTwitterAccountsByUserId(userId);
      if (!twitterAccounts?.length) {
        console.warn(`⚠️ ไม่พบบัญชี Twitter ที่เชื่อมกับ user ${userId}`);
        return;
      }

      // โพสต์ไปยังแต่ละบัญชี
      for (const account of twitterAccounts) {
        try {
          await tweetToTwitterAccount(account, post);

          await PostLog.create({
            postId: post._id,
            userId,
            twitterAccountId: account._id,
            status: 'success',
            tweetedAt: new Date()
          });

          console.log(`✅ โพสต์สำเร็จไปยัง @${account.username}`);
        } catch (err) {
          await PostLog.create({
            postId: post._id,
            userId,
            twitterAccountId: account._id,
            status: 'failed',
            errorMessage: err.message,
            tweetedAt: new Date()
          });

          console.error(`❌ โพสต์ล้มเหลวที่ @${account.username}:`, err.message);
        }
      }
    } catch (err) {
      console.error('🚨 ERROR ใน job handler:', err);
      throw err; // ให้ BullMQ จัดการ retry
    }
  },
  { connection }
);

function getTimeString() {
  return new Date().toLocaleString('th-TH', {
    hour12: false,
    timeZone: 'Asia/Bangkok', // กำหนด timezone ตามที่ต้องการ
  });
}

// log เมื่อ job เสร็จสมบูรณ์
worker.on('completed', job => {
  console.log(`🎉 [COMPLETED] [${getTimeString()}] Job ${job.id} สำเร็จแล้ว`);
});

// log เมื่อ job ล้มเหลว
worker.on('failed', (job, err) => {
  console.error(`❌ [FAILED] [${getTimeString()}] Job ${job.id} ล้มเหลว:`, err.message);
});

export default worker;
