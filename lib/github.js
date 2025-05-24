// lib/github.js
import dotenv from 'dotenv';
dotenv.config();

import { trackedFetch as fetch } from './trackedFetch.js';
import { sendTelegramMessage } from './telegram.js';

/**
 * Wrapper around fetch that logs GitHub rate-limit info
 * to console and Telegram.
 */
async function fetchWithRateLimitInfo(url, options) {
  const res = await fetch(url, options);

  // Extract rate-limit headers
  const limit     = res.headers.get('x-ratelimit-limit');
  const remaining = res.headers.get('x-ratelimit-remaining');
  const reset     = res.headers.get('x-ratelimit-reset');
  const resetDate = new Date(parseInt(reset, 10) * 1000).toISOString();

  const msg = `📊 GitHub Rate Limit: ${remaining}/${limit} remaining — resets at ${resetDate}`;
  console.log(msg);

  // Send rate-limit info to Telegram
  try {
    // await sendTelegramMessage(
    //   process.env.TELEGRAM_BOT_TOKEN,
    //   process.env.TELEGRAM_CHAT_ID,
    //   msg
    // );
  } catch (err) {
    console.error('❌ Failed to send rate-limit info to Telegram:', err.message);
  }

  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status}`);
  }
  return res;
}

/**
 * Fetch a user’s public events in descending order,
 * stopping once we hit lastSeenId or maxResults.
 */
export async function fetchUserEvents(
  user,
  token,
  maxResults,
  lastSeenId = null
) {
  const perPage = Math.min(100, maxResults);
  let page     = 1;
  const all     = [];

  while (all.length < maxResults) {
    const url = `https://api.github.com/users/${user}/events?per_page=${perPage}&page=${page}`;
    const res = await fetchWithRateLimitInfo(url, {
      headers: { Authorization: `token ${token}` }
    });

    const batch = await res.json();
    // console.log(batch)
    if (batch.length === 0) break;

    for (const ev of batch) {
      if (ev.id === lastSeenId) {
        return all;
      }
      all.push(ev);
      if (all.length >= maxResults) break;
    }
    page++;
    // nice:
    maxResults = -1
  }

  return all;
}

/**
 * Fetch full commit details from its API URL.
 */
export async function fetchCommit(url, token) {
  const res = await fetchWithRateLimitInfo(url, {
    headers: { Authorization: `token ${token}` }
  });

  if (!res.ok) {
    throw new Error(`GitHub commit fetch failed: ${res.status}`);
  }

  return res.json();
}