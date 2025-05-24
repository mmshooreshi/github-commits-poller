// ./lib/utils.js

import chalk from 'chalk';

export function logSection(title) {
  console.log(chalk.bold.blue(`\n== ${title} ==`));
}

// escape Telegram MarkdownV2 special chars:
// _ * [ ] ( ) ~ ` > # + - = | { } . !
export function escapeMd(text = '') {
  return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function timeAgo(date) {
  const diff = (Date.now() - new Date(date)) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  return `${days}d ${hours}h ago`;
}

export function formatCommitMessage(commit) {
  const add       = commit.stats?.additions   ?? 0;
  const del       = commit.stats?.deletions   ?? 0;
  const author    = escapeMd(commit.author);
  const repo      = escapeMd(commit.repo);
  const shortSha  = escapeMd(commit.sha.slice(0, 7));
  const msgText   = escapeMd(commit.message);
  const time      = new Date(commit.time).toUTCString();
  const relativeTime = timeAgo(time);

  // escape the “+” and “-” in the stats line
  const addText   = escapeMd(`+${add}`);
  const delText   = escapeMd(`-${del}`);

  const repoLink   = `https://github.com/${commit.repo}`;
  const commitLink = `https://github.com/${commit.repo}/commit/${commit.sha}`;

  let msg = `\\#${author}\n`;
  msg += `📦 *Repo:* [\`${repo}\`](${repoLink})\n`;
  msg += `📝 *Message:* \`${msgText}\`\n`;
  msg += `🆔 *Commit:* [\`${shortSha}\`](${commitLink})\n`;
  msg += `🕒 *Time:* ${relativeTime}\n`;
  msg += `➕ *${addText}* / ➖ *${delText}*\n`;

  if (commit.files?.length) {
    msg += `\n🗂 *Files Changed:*\n`;
    for (const f of commit.files.slice(0, 10)) {
      const fn      = escapeMd(f.filename);
      const status  = escapeMd(f.status);
      const changes = escapeMd(`+${f.additions}/-${f.deletions}`);
      msg += `• \`${fn}\` _${status}_ — [${changes}]\n`;
    }
  }

  msg += `\n🔍 [View Full Diff](${commitLink})`;
  msg += escapeMd(`\n\n<!-- SHA:${commit.sha} -->`);
  return msg;
}
