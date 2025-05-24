// lib/logger.js
import fs from 'fs';
import path from 'path';

const DEBUG = process.env.DEBUG === 'true';
const logDir = path.resolve(process.cwd(), 'logs');
if (DEBUG && !fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

function writeToFile(level, msg) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename  = path.join(logDir, `debug-${timestamp}.log`);
  fs.appendFileSync(filename, `[${level.toUpperCase()}] ${msg}\n`);
}

export function info(msg) {
  console.info(msg);
  if (DEBUG) writeToFile('info', msg);
}

export function debug(msg) {
  console.debug(msg);
  if (DEBUG) writeToFile('debug', msg);
}

export function error(msg) {
  console.error(msg);
  if (DEBUG) writeToFile('error', msg);
}
