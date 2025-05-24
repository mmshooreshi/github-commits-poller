// api/polling.js
import dotenv from 'dotenv';
dotenv.config();

import { info, debug, error } from '../lib/logger.js';
import { fetchUserEvents, fetchCommit } from '../lib/github.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { formatCommitMessage, logSection } from '../lib/utils.js';
import {
  batchHasFetched,
  batchHasSent,
  batchMarkFetched,
  batchMarkSent,
  getLastEventId,
  setLastEventId,
  storeLog
} from '../lib/store.js';
import { requestLog } from '../lib/trackedFetch.js';
import fs from 'fs';
import path from 'path';

const DEBUG = process.env.DEBUG === 'true';
const USERS = process.env.GITHUB_USERS?.split(',') || [
  'MatinGG','Reihaneh0-0','HoseinM89','Fuxgxugx135'
];
const GITHUB_TOKEN        = process.env.GITHUB_TOKEN;
const TELEGRAM_TOKEN      = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID;
const DAYS_BACK           = Number(process.env.DAYS_BACK || 3);
const MAX_EVENTS_PER_USER = Number(process.env.MAX_EVENTS_PER_USER || 30);

/**
 * Logs and optionally persists a full debug dump.
 */
function dumpDebugInfo(allCandidates, grandTotalSent) {
  if (!DEBUG) return;
  try {
    const logDir = path.resolve(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const payload = {
      timestamp,
      allCandidates,
      grandTotalSent,
      requestLog,
      storeLog
    };
    const filePath = path.join(logDir, `full-debug-${timestamp}.json`);
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
    info(`🐛 Debug dump written: ${filePath}`);
  } catch (e) {
    error(`❌ Failed to write debug dump: ${e.message}`);
  }
}

/**
 * Summarizes request logs.
 */
function printRequestSummary() {
  const summary = {};
  requestLog.forEach(r => {
    const key = `${r.domain}|${r.method}`;
    summary[key] = (summary[key] || 0) + 1;
  });
  debug('External Request Summary:', JSON.stringify(summary, null, 2));

  debug('Redis Store Operation Summary:', JSON.stringify(storeLog, null, 2));
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  logSection('GitHub → Telegram Polling Started');
  info('Handler invoked');

  // cutoff date
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_BACK);

  let grandTotalSent = 0;
  const allCandidates = [];
  
  const iterationStart = new Date().toISOString().slice(0, 16);
  info(`Starting fetch for ${USERS} at ${iterationStart}`);
  try {
    await sendTelegramMessage(
      TELEGRAM_TOKEN,
      TELEGRAM_CHAT_ID,
      `⏱️ \`[${iterationStart}]\` Starting GitHub fetch for \`${USERS}\``
    );
  } catch (msgErr) {
    error(`Failed to send start-fetch message for ${USERS}: ${msgErr.message}`);
  }

  // Fetch events per user
  for (const user of USERS) {

    try {
      const lastSeenId = await getLastEventId(user);
      debug(`Last seen ID for ${user}: ${lastSeenId}`);
      const events = await fetchUserEvents(
        user, GITHUB_TOKEN, MAX_EVENTS_PER_USER, lastSeenId
      );

      if (events.length === 0) {
        debug(`No new events for ${user}`);
        continue;
      }

      for (const ev of events) {
        if (ev.type !== 'PushEvent') continue;
        const evTime = new Date(ev.created_at);
        if (evTime < cutoff) continue;
        ev.payload.commits.forEach(c => {
          allCandidates.push({
            user,
            sha: c.sha,
            url: c.url,
            repo: ev.repo.name,
            time: ev.created_at,
            author: c.author?.name || user
          });
        });
      }

      await setLastEventId(user, events[0].id);
    } catch (err) {
      error(`Error collecting events for ${user}: ${err.message}`);
    }
  }

  if (allCandidates.length === 0) {
    debug('No relevant commits across all users');
    logSection('Summary');
    printRequestSummary();
    dumpDebugInfo(allCandidates, grandTotalSent);
    return res.status(200).json({ sent: 0 });
  }

  // Process commits
  allCandidates.sort((a, b) => new Date(a.time) - new Date(b.time));
  const allShas = allCandidates.map(c => c.sha);
  const fetchedMask = await batchHasFetched(allShas);
  const sentMask    = await batchHasSent(allShas);

  for (const candidate of allCandidates) {
    if (fetchedMask[candidate.sha]) continue;
    try {
      const full = await fetchCommit(candidate.url, GITHUB_TOKEN);
      await batchMarkFetched([candidate.sha]);
      if (sentMask[candidate.sha]) continue;

      const data = {
        user: candidate.author,
        repo: candidate.repo,
        time: candidate.time,
        sha: full.sha,
        author: full.commit.author.name,
        message: full.commit.message,
        stats: full.stats,
        files: full.files
      };

      const msg = formatCommitMessage(data);
      await sendTelegramMessage(TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, msg);
      grandTotalSent++;
    } catch (err) {
      error(`Failed to process ${candidate.sha}: ${err.message}`);
      await batchMarkFetched([candidate.sha]);
    }
  }

  if (grandTotalSent > 0) {
    await batchMarkSent(allCandidates
      .map(c => c.sha)
      .filter(sha => !fetchedMask[sha])
    );
    info(`${grandTotalSent} new commits sent`);
  }

  logSection('Summary');
  printRequestSummary();
  dumpDebugInfo(allCandidates, grandTotalSent);

  info(`Total commits sent: ${grandTotalSent}`);
  return res.status(200).json({ sent: grandTotalSent });
}