// src/lib/server/queue.js
import { Queue } from 'bullmq';
import { connection } from '$lib/server/redisConnection';

export const postQueue = new Queue('post-queue', { connection });