import dotenv from 'dotenv';
dotenv.config();

import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const USERS = ['MatinGG', 'Reihaneh0-0', 'HoseinM89', 'Fuxgxugx135'];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const lastSeen = {};

const headers = {
  Authorization: `token ${GITHUB_TOKEN}`,
  'User-Agent': 'GitHub-Commit-Poller'
};

// Reusable helpers
async function fetchJson(url) {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} - ${await res.text()}`);
  return res.json();
}

async function writeJsonFile(name, data) {
  const folder = 'unified-output';
  await fs.mkdir(folder, { recursive: true });
  const filePath = path.join(folder, `${name}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Main logic
export default async function handler(req, res) {
  const allCommits = [];
  const repoInfos = {};
  const errors = [];

  for (const user of USERS) {
    try {
      const events = await fetchJson(`https://api.github.com/users/${user}/events`);

      for (const event of events) {
        if (event.type !== 'PushEvent') continue;
        if (event.id === lastSeen[user]) break;

        const repo = event.repo.name;
        const time = event.created_at;

        for (const c of event.payload.commits) {
          try {
            const fullCommit = await fetchJson(c.url);
            allCommits.push({
              user,
              repo,
              time,
              sha: fullCommit.sha,
              author: fullCommit.commit.author.name,
              message: fullCommit.commit.message,
              stats: fullCommit.stats,
              files: fullCommit.files,
              html_url: fullCommit.html_url
            });
          } catch (e) {
            errors.push({ commit_url: c.url, error: e.message });
          }
        }

        // Only fetch repo info once per repo
        if (!repoInfos[repo]) {
          try {
            const repoData = await fetchJson(`https://api.github.com/repos/${repo}`);
            repoInfos[repo] = {
              description: repoData.description,
              stars: repoData.stargazers_count,
              forks: repoData.forks,
              visibility: repoData.visibility
            };
          } catch (e) {
            errors.push({ repo, error: e.message });
          }
        }
      }

      if (events.length && events[0].id) {
        lastSeen[user] = events[0].id;
      }

    } catch (e) {
      errors.push({ user, error: e.message });
    }
  }

  // Save unified outputs
  await writeJsonFile('new_commits', allCommits);
  await writeJsonFile('repo_metadata', repoInfos);
  await writeJsonFile('errors', errors);

  res.status(200).json({
    status: 'done',
    saved: {
      commits: allCommits.length,
      repos: Object.keys(repoInfos).length,
      errors: errors.length
    }
  });
}
