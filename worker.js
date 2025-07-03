// src/lib/server/worker.js
import { Worker } from 'bullmq';
import { postQueue } from './lib/queue.js';
import { connection } from './lib/redisConnection.js'; // redis client
import { connectDB } from './lib/db.js';
import { tweetToTwitterAccount } from './lib/twitter-api/twitterClient.js';
import { PostLog } from './lib/models/PostLog.js';
import { getTwitterAccountsByUserId } from './lib/models/TwitterAccount.js';
import { refreshTokenIfNeeded } from './lib/twitter-api/tokenUtils.js';
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

      // เพิ่มกรณี job.name === 'refresh-job'
      if (job.name === 'refresh-job') {
        console.log(`🔄 เริ่มงานรีเฟรช token ทั้งหมด`);

        // สมมติรับ userId ใน job.data หรือจะรีเฟรชทุก user ก็ได้ตามต้องการ
        const { userId } = job.data;

        // ดึงบัญชี Twitter ของ user นี้ทั้งหมด
        const twitterAccounts = await getTwitterAccountsByUserId(userId);

        if (!twitterAccounts?.length) {
          console.log(`⚠️ ไม่พบบัญชี Twitter สำหรับ userId=${userId}`);
        } else {
          for (const account of twitterAccounts) {
            try {
              const freshAccount = await refreshTokenIfNeeded(account);
              console.log(`✅ รีเฟรช token สำเร็จ @${account.username}`);
            } catch (err) {
              console.error(`❌ รีเฟรช token ล้มเหลว @${account.username}:`, err.message);
            }
          }
        }

        // รอ 10 นาที (600,000 ms) ก่อนเพิ่ม job refresh-job ใหม่ (loop)
        const delayMs = 10 * 60 * 1000;
        console.log(`🕒 รอ ${delayMs / 1000} วินาทีก่อนเพิ่ม refresh-job ใหม่`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        // เพิ่ม job refresh-job ใหม่ (loop)
        await postQueue.add(
          'refresh-job',
          { userId }, // ถ้าจะรีเฟรชทุก user ควรทำ logic แยก หรือ loop ดึง userIds มารวม
          { removeOnComplete: true, removeOnFail: true }
        );
        console.log(`🔁 เพิ่ม refresh-job ใหม่ (loop) เรียบร้อย`);

        return; // จบ job นี้
      }

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
          // ✅ เช็คและ refresh ถ้าจำเป็น
          const freshAccount = await refreshTokenIfNeeded(account);

          // ✅ ใช้ token ล่าสุด
          console.log(freshAccount);
          await tweetToTwitterAccount(freshAccount, post);

          await PostLog.create({
            postId: post._id,
            userId,
            twitterAccountId: account._id,
            status: 'success',
            tweetedAt: new Date()
          });
          console.log(`✅ โพสต์สำเร็จ @${account.username}`);
        } catch (err) {
          let fullError = '';

          if (err.response?.data) {
            fullError = JSON.stringify({
              status: err.response.status,
              data: err.response.data,
              headers: err.response.headers
            }, null, 2);
          } else if (err.message) {
            fullError = err.message;
          } else {
            fullError = JSON.stringify(err, null, 2);
          }

          await PostLog.create({
            postId: post._id,
            userId,
            twitterAccountId: account._id,
            status: 'failed',
            errorMessage: fullError,
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

// ถ้าอยากเริ่ม job refresh ตอน worker โหลดครั้งแรก (แค่ครั้งเดียว)
async function startRefreshJobOnce() {
  const jobs = await postQueue.getJobs(['waiting', 'delayed', 'active']);
  if (!jobs.some(j => j.name === 'refresh-job')) {
    await postQueue.add('refresh-job', {}, { removeOnComplete: true, removeOnFail: true });
    console.log('🆕 เพิ่ม refresh-job เริ่มต้น');
  }
}
startRefreshJobOnce();

export default worker;
