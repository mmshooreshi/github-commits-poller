// lib/store.js
import { Redis } from '@upstash/redis';

export const storeLog = {
  getLastEventId: 0,
  setLastEventId: 0,
  batchHasFetched: 0,
  batchHasSent:   0,
  batchMarkFetched: 0,
  batchMarkSent:    0,
};


export const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// —— last-seen GitHub Event ID ——
export async function getLastEventId(user) {
  storeLog.getLastEventId++;
  return await redis.get(`github:lastEvent:${user}`);
}
export async function setLastEventId(user, eventId) {
  storeLog.setLastEventId++;
  return await redis.set(`github:lastEvent:${user}`, eventId);
}

// —— batch-check “fetched” via MGET ——
export async function batchHasFetched(shas) {
  storeLog.batchHasFetched++;
  if (shas.length === 0) return {};
  const keys = shas.map(sha => `github:commit:${sha}`);
  const vals = await redis.mget(...keys);
  return Object.fromEntries(
    shas.map((sha, i) => [sha, vals[i] !== null])
  );
}

// —— batch-check “sent” via MGET ——
export async function batchHasSent(shas) {
  storeLog.batchHasSent++;
  if (shas.length === 0) return {};
  const keys = shas.map(sha => `telegram:sent:${sha}`);
  const vals = await redis.mget(...keys);
  return Object.fromEntries(
    shas.map((sha, i) => [sha, vals[i] !== null])
  );
}

// —— batch-mark “fetched” via MSET (object form) ——
export async function batchMarkFetched(shas) {
  storeLog.batchMarkFetched++;
  if (shas.length === 0) return;
  const map = Object.fromEntries(
    shas.map(sha => [`github:commit:${sha}`, '1'])
  );
  await redis.mset(map);
}

// —— batch-mark “sent” via MSET (object form) ——
export async function batchMarkSent(shas) {
  storeLog.batchMarkSent++;
  if (shas.length === 0) return;
  const map = Object.fromEntries(
    shas.map(sha => [`telegram:sent:${sha}`, '1'])
  );
  await redis.mset(map);
}
