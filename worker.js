// src/lib/server/worker.js
import { Worker } from 'bullmq';
import { postQueue } from './lib/queue.js';
import { connection } from './lib/redisConnection.js';
import { connectDB } from './lib/db.js';
import { tweetToTwitterAccount } from './lib/twitter-api/twitterClient.js';
import { PostLog } from './lib/models/PostLog.js';
import { getTwitterAccountsByUserId, TwitterAccount } from './lib/models/TwitterAccount.js';
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

      if (job.name === 'refresh-job') {
        console.log(`🔄 เริ่มงานรีเฟรช token สำหรับ user ที่ไม่ได้อยู่ใน post-job`);

        // 1️⃣ ดึง jobs ทุกสถานะ
        const jobs = await postQueue.getJobs(['waiting', 'active', 'delayed']);

        // 2️⃣ รวม userId ที่อยู่ใน post-job
        const userIdsInPostJob = new Set();
        for (const j of jobs) {
          if (j.name === 'post-job' && j.data?.userId) {
            userIdsInPostJob.add(j.data.userId.toString());
          }
        }
        console.log(`📌 UserId ที่มี post-job อยู่:`, [...userIdsInPostJob]);

        // 3️⃣ ดึง userId ทั้งหมดที่มีบัญชี Twitter
        const allAccounts = await TwitterAccount.find({});
        const allUserIds = new Set(allAccounts.map(acc => acc.userId.toString()));
        console.log(`✅ UserId ทั้งหมดในระบบ:`, [...allUserIds]);

        // 4️⃣ หา userId ที่ไม่ได้อยู่ใน post-job
        const userIdsToRefresh = [...allUserIds].filter(uid => !userIdsInPostJob.has(uid));
        console.log(`🔍 UserId ที่จะรีเฟรช token:`, userIdsToRefresh);

        // 5️⃣ รีเฟรช token
        for (const uid of userIdsToRefresh) {
          const accounts = allAccounts.filter(acc => acc.userId.toString() === uid);
          for (const account of accounts) {
            try {
              const freshAccount = await refreshTokenIfNeeded(account);
              console.log(`✅ รีเฟรช token สำเร็จ @${account.username}`);
            } catch (err) {
              console.error(`❌ รีเฟรช token ล้มเหลว @${account.username}:`, err.message);
            }
          }
        }

        // 6️⃣ รอ 10 นาทีแล้วเพิ่ม refresh-job ใหม่
        const delayMs = 10 * 60 * 1000;
        console.log(`🕒 รอ ${delayMs / 1000} วินาที ก่อนเพิ่ม refresh-job ใหม่`);
        await new Promise(resolve => setTimeout(resolve, delayMs));

        await postQueue.add('refresh-job', {}, { removeOnComplete: true, removeOnFail: true });
        console.log(`🔁 เพิ่ม refresh-job ใหม่แล้ว`);

        return;
      }

      // -------------------------
      // ส่วนโพสต์
      // -------------------------
      const { userId, postId } = job.data;

      const stopFlag = await connection.get(`stop:${userId}`);
      if (stopFlag === 'true') {
        console.log(`⛔️ User ${userId} สั่งหยุด loop แล้ว`);
        return;
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
          const freshAccount = await refreshTokenIfNeeded(account);
          console.log(`✅ Token พร้อมใช้ @${account.username}`);
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

      // Delay ก่อนเพิ่ม job ใหม่
      const delayMs = (post.duration || 1) * 60 * 1000;
      console.log(`🕒 รอ ${delayMs / 1000} วินาที ก่อนเพิ่ม job ใหม่`);
      await new Promise(resolve => setTimeout(resolve, delayMs));

      await postQueue.add(
        'post-job',
        { userId, postId },
        {
          delay: delayMs,
          attempts: 3,
          backoff: 10000,
          removeOnComplete: false,
          removeOnFail: false
        }
      );
      console.log(`🔁 เพิ่ม post-job ใหม่แล้ว`);

    } catch (err) {
      console.error('🚨 ERROR ใน worker:', err);
      throw err;
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

// เริ่ม refresh-job ครั้งแรกถ้ายังไม่มี
async function startRefreshJobOnce() {
  await connectDB();
  const jobs = await postQueue.getJobs(['waiting', 'delayed', 'active']);
  if (!jobs.some(j => j.name === 'refresh-job')) {
    await postQueue.add('refresh-job', {}, { removeOnComplete: true, removeOnFail: true });
    console.log('🆕 เพิ่ม refresh-job เริ่มต้น');
  }
}
startRefreshJobOnce();

export default worker;
