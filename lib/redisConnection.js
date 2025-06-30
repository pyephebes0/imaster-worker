// redisConnection.js
import IORedis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();  // โหลด .env ไฟล์

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error('Missing REDIS_URL environment variable');
}

export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

connection.on('connect', () => {
  console.log('✅ Redis connected');
});

connection.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

// ทดสอบ set/get
(async () => {
  try {
    await connection.set('test_key', 'hello redis');
    const value = await connection.get('test_key');
    console.log('🧪 Redis test_key:', value);  // ควรเห็น 'hello redis'
  } catch (err) {
    console.error('❌ Redis test failed:', err);
  }
})();