// lib/trackedFetch.js
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// In-memory logs
export const requestLog = [];
// A simple counter for generating unique request IDs
let requestCounter = 0;

/**
 * Wraps fetch() and logs extensive details, including call hierarchy.
 * Each request gets a unique ID and captures its parent from the stack trace.
 */
export async function trackedFetch(url, options = {}) {
  const requestId = `req-${++requestCounter}`;
  const timestampStart = new Date().toISOString();

  // Determine HTTP method and domain
  const method = (options.method || 'GET').toUpperCase();
  const domain = new URL(url).hostname;

  // Capture the caller function from the stack trace
  const err = new Error();
  const stackLines = err.stack.split('\n').slice(2);
  const callerLine = stackLines[0].trim();

  // Log pre-fetch details
  const preLog = {
    requestId,
    parent: null,
    timestampStart,
    method,
    url,
    domain,
    caller: callerLine,
    options: {
      headers: options.headers,
      bodyLength: options.body ? options.body.length : 0
    }
  };
  requestLog.push({ phase: 'start', ...preLog });

  // Perform the actual fetch
  const startMs = Date.now();
  const res = await fetch(url, options);
  const durationMs = Date.now() - startMs;

  // Extract response details
  const responseHeaders = {};
  res.headers.forEach((value, name) => {
    responseHeaders[name] = value;
  });

  // Log post-fetch details
  const postLog = {
    requestId,
    timestampEnd: new Date().toISOString(),
    durationMs,
    status: res.status,
    statusText: res.statusText,
    responseHeaders,
  };
  requestLog.push({ phase: 'end', ...postLog });

  return res;
}