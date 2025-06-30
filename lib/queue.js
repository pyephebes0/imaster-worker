// src/lib/server/queue.js
import { Queue } from 'bullmq';
import { connection } from './lib/redisConnection.js';

export const postQueue = new Queue('post-queue', { connection });