// lib/trackedFetch.js
import fetch from 'node-fetch';

export const requestLog = [];

/**
 * Wraps fetch() and logs each call.
 */
export async function trackedFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const domain = new URL(url).hostname;
  const start = Date.now();

  const res = await fetch(url, options);
  const duration = Date.now() - start;

  requestLog.push({
    method,
    url,
    domain,
    status: res.status,
    durationMs: duration
  });

  return res;
}
