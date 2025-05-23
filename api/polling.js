// api/polling.js
import dotenv from 'dotenv';
dotenv.config();

import { fetchUserEvents, fetchCommit } from '../lib/github.js';
import { sendTelegramMessage }           from '../lib/telegram.js';
import { formatCommitMessage, logSection } from '../lib/utils.js';

import {
  batchHasFetched,
  batchHasSent,
  batchMarkFetched,
  batchMarkSent,
  getLastEventId,
  setLastEventId
} from '../lib/store.js';
import { requestLog } from '../lib/trackedFetch.js';
import { storeLog }   from '../lib/store.js';

const USERS                = process.env.GITHUB_USERS?.split(',') || [
  'MatinGG','Reihaneh0-0','HoseinM89','Fuxgxugx135'
];
const GITHUB_TOKEN         = process.env.GITHUB_TOKEN;
const TELEGRAM_TOKEN       = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID     = process.env.TELEGRAM_CHAT_ID;
const DAYS_BACK            = parseInt(process.env.DAYS_BACK || '3', 10);
const MAX_EVENTS_PER_USER  = parseInt(process.env.MAX_EVENTS_PER_USER || '30', 10);

function printRequestSummary() {
  const map = {};
  for (const r of requestLog) {
    const key = `${r.domain}|${r.method}`;
    map[key] = (map[key] || 0) + 1;
  }
  console.log('\n📊 External Request Summary');
  console.table(
    Object.entries(map).map(([k, count]) => {
      const [domain, method] = k.split('|');
      return { Domain: domain, Method: method, Count: count };
    })
  );

  console.log('\n📦 Redis Store Operation Summary');
  console.table(
    Object.entries(storeLog).map(([fn, count]) => ({ Function: fn, Count: count }))
  );
}

export default async function handler(req, res) {
  logSection('GitHub → Telegram Polling Started');

  // 1) build cutoff
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_BACK);

  let grandTotalSent = 0;
  const allCandidates = [];

  // 2) fetch & collect from each user
  for (const user of USERS) {
    try {
      const lastSeenId = await getLastEventId(user);
      const events = await fetchUserEvents(
        user, GITHUB_TOKEN, MAX_EVENTS_PER_USER, lastSeenId
      );

      if (events.length === 0) {
        console.log(`⏭ No new events for ${user}`);
        continue;
      }

      // collect only recent PushEvent commits
      for (const ev of events) {
        if (ev.type !== 'PushEvent') continue;
        const evTime = new Date(ev.created_at);
        if (evTime < cutoff) continue;

        const repo = ev.repo.name;
        for (const c of ev.payload.commits) {
          allCandidates.push({
            user,
            sha:    c.sha,
            url:    c.url,
            repo,
            time:   ev.created_at,
            author: c.author?.name || user
          });
        }
      }

      // bump last-seen for this user so we don't re-fetch these events
      await setLastEventId(user, events[0].id);
    } catch (err) {
      console.error(`❌ Error collecting events for ${user}:`, err.message);
    }
  }

  // 3) if nothing to do
  if (allCandidates.length === 0) {
    console.log('⏭ No relevant commits across all users');
    logSection('Summary');
    printRequestSummary();
    return res.status(200).json({ sent: 0 });
  }

  // 4) sort globally by time ascending
  allCandidates.sort((a, b) => new Date(a.time) - new Date(b.time));

  // 5) bulk Redis lookups
  const allShas     = allCandidates.map(c => c.sha);
  const fetchedMask = await batchHasFetched(allShas);
  const sentMask    = await batchHasSent(allShas);

  // 6) fetch full commits & send in sorted order
  const actuallySent = [];
  for (const { sha, url, repo, time, author } of allCandidates) {
    if (fetchedMask[sha]) continue;

    try {
      const full = await fetchCommit(url, GITHUB_TOKEN);
      await batchMarkFetched([sha]);

      if (sentMask[sha]) continue;

      const commitData = {
        user:    author,
        repo,
        time,
        sha:     full.sha,
        author:  full.commit.author.name,
        message: full.commit.message,
        stats:   full.stats,
        files:   full.files
      };

      const msg = formatCommitMessage(commitData);
      await sendTelegramMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, msg);

      actuallySent.push(sha);
      grandTotalSent++;
    } catch (err) {
      console.error(`❌ Failed to process ${sha}:`, err.message);
      // ensure we don’t retry a bad SHA
      await batchMarkFetched([sha]);
    }
  }

  // 7) mark sent SHAs in Redis
  if (actuallySent.length > 0) {
    await batchMarkSent(actuallySent);
    console.log(`✅ ${actuallySent.length} new commits sent in total`);
  }

  logSection('Summary');
  printRequestSummary();

  console.log(`📬 Total new commits sent: ${grandTotalSent}`);
  res.status(200).json({ sent: grandTotalSent });
}
