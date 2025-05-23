// lib/github.js
// import fetch from 'node-fetch';
import { trackedFetch as fetch } from './trackedFetch.js';

/**
 * Fetch a user’s public events in descending order,
 * stopping once we hit lastSeenId.
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
    const res = await fetch(
      `https://api.github.com/users/${user}/events?per_page=${perPage}&page=${page}`,
      { headers: { Authorization: `token ${token}` } }
    );
    if (!res.ok) {
      throw new Error(`GitHub events fetch failed: ${res.status}`);
    }

    const batch = await res.json();
    if (batch.length === 0) break;

    for (const ev of batch) {
      if (ev.id === lastSeenId) {
        // we’ve caught up
        return all;
      }
      all.push(ev);
      if (all.length >= maxResults) break;
    }
    page++;
  }

  return all;
}

/**
 * Fetch full commit details from its API URL.
 */
export async function fetchCommit(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `token ${token}` }
  });
  if (!res.ok) {
    throw new Error(`GitHub commit fetch failed: ${res.status}`);
  }
  return res.json();
}
