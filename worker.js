// src/lib/server/worker.js
import { Worker } from 'bullmq';
import { postQueue } from './lib/queue'; 
import { connection } from './lib/redisConnection.js'; // redis client
import { connectDB } from './lib/db.js';
import { tweetToTwitterAccount } from './lib/twitter-api/twitterClient.js';
import { PostLog } from './lib/models/PostLog.js';
import { getTwitterAccountsByUserId } from './lib/models/TwitterAccount.js';
import { Post } from './lib/models/Post.js';

console.log('👷‍♂️ [INIT] worker.js started');

function getTimeString() {
  return new Date().toLocaleString('th-TH', {
    hour12: false,
    timeZone: 'Asia/Bangkok',
  });
}

const worker = new Worker(
  'post-queue',
  async job => {
    try {
      console.log(`📥 รับงาน: [${job.id}] ${job.name} [${getTimeString()}]`, job.data);

      await connectDB();

      const { userId, postId } = job.data;

      // ตรวจสอบ flag หยุดใน Redis
      const stopFlag = await connection.get(`stop:${userId}`);
      if (stopFlag === 'true') {
        console.log(`⛔️ User ${userId} สั่งหยุด loop แล้ว`);
        return; // ไม่สร้าง job ใหม่
      }

      const post = await Post.findById(postId);
      if (!post) {
        console.warn(`⚠️ ไม่พบโพสต์ id: ${postId}`);
        return;
      }

      const twitterAccounts = await getTwitterAccountsByUserId(userId);
      if (!twitterAccounts?.length) {
        console.warn(`⚠️ ไม่พบบัญชี Twitter userId=${userId}`);
        return;
      }

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
          console.log(`✅ โพสต์สำเร็จ @${account.username}`);
        } catch (err) {
          await PostLog.create({
            postId: post._id,
            userId,
            twitterAccountId: account._id,
            status: 'failed',
            errorMessage: err.message,
            tweetedAt: new Date()
          });
          console.error(`❌ โพสต์ล้มเหลว @${account.username}:`, err.message);
        }
      }

      // รอ delay ตาม post.duration (นาที) ก่อนเพิ่ม job ใหม่
      const delayMs = (post.duration || 1) * 60 * 1000;
      console.log(`🕒 รอ ${delayMs / 1000} วินาที ก่อนเพิ่ม job ใหม่`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      // เพิ่ม job ใหม่ (loop)
	  await postQueue.add(
		  'post-job',
		  {
			userId,
			postId
		  },
		  {
			delay: (post.duration || 0) * 60 * 1000,
			attempts: 3,
			backoff: 10000,
			removeOnComplete: false,
			removeOnFail: false
		  }
	  );
      console.log(`🔁 เพิ่ม job ใหม่ (loop) เรียบร้อย`);

    } catch (err) {
      console.error('🚨 ERROR ใน worker:', err);
      throw err; // ให้ BullMQ retry job ได้
    }
  },
  { connection }
);

worker.on('completed', job => {
  console.log(`🎉 [COMPLETED] [${getTimeString()}] Job ${job.id} สำเร็จ`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ [FAILED] [${getTimeString()}] Job ${job.id} ล้มเหลว:`, err.message);
});

export default worker;
