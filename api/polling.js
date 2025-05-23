import fetch from 'node-fetch';

const USERS = ['MatinGG', 'Reihaneh0-0', 'HoseinM89', 'Fuxgxugx135'];
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const lastSeen = {}; // In-memory only for demo

export default async function handler(req, res) {
  const newCommits = [];

  for (const user of USERS) {
    const url = `https://api.github.com/users/${user}/events`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'User-Agent': 'VercelFunction'
      }
    });

    const events = await response.json();

    for (const event of events) {
      if (event.type === 'PushEvent') {
        if (event.id === lastSeen[user]) break;

        const commits = event.payload.commits.map(c => ({
          message: c.message,
          url: c.url
        }));

        newCommits.push({
          user,
          repo: event.repo.name,
          commits,
          time: event.created_at
        });
      }
    }

    if (events.length && events[0].id) {
      lastSeen[user] = events[0].id;
    }
  }

  res.status(200).json({ newCommits });
}
