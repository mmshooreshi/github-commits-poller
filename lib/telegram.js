// ./lib/telegram.js
import dotenv from 'dotenv';
import { trackedFetch as fetch } from './trackedFetch.js';
import chalk from 'chalk';

dotenv.config();
const defaultTelegramBase = 'https://api.telegram.org';

export function getTelegramBase() {
  return process.env.TELEGRAM_PROXY_URL?.trim() || defaultTelegramBase;
}

export async function sendTelegramMessage(botToken, chatId, message) {
  const base = getTelegramBase();
  const url  = `${base}/bot${botToken}/sendMessage`;
  const payload = {
    chat_id:    chatId,
    text:       message,
    parse_mode: 'MarkdownV2'
  };

  // debug logging of the exact payload
  // console.log('🔍 [TELEGRAM DEBUG] payload:', JSON.stringify(payload));

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(chalk.red(`Telegram send failed: ${res.status}`), errText);

    // try to pull a byte-offset from Telegram’s error
    const offsetMatch = errText.match(/offset (\d+)/);
    if (offsetMatch) {
      const off = Number(offsetMatch[1]);
      console.error(
        `❌ [TELEGRAM DEBUG] bad character at offset ${off}:`,
        message[off],
        `…context: "${message.slice(off - 10, off + 10)}"`
      );
    }
  } else {
    console.log(chalk.green('✅ Sent Telegram message'));
  }
}

export async function fetchBotSentSHAs(botToken) {
  const url = `${getTelegramBase()}/bot${botToken}/getUpdates?limit=100&allowed_updates=["message"]`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn('⚠️ Failed to fetch updates from Telegram');
    return [];
  }

  const data = await res.json();
  return data.result
    .map(u => u.message?.text || '')
    .map(text => {
      const m = text.match(/<!--\s*SHA:([a-f0-9]+)\s*-->/i);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}
