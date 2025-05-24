/**
 * Welcome to Cloudflare Workers!
 *
 * This is a template for a Scheduled Worker: a Worker that can run on a
 * configurable interval:
 * https://developers.cloudflare.com/workers/platform/triggers/cron-triggers/
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Run `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"` to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
export default {
  async fetch(req) {
    // for local testing only – keep in sync with your cron expr
    const url = new URL(req.url);
    url.pathname = "/__scheduled";
    // encode the same cron you’re using above
    url.searchParams.append("cron", "*/15 * * * *");
    return new Response(`curl this to test: ${url.href}`);
  },

  async scheduled(event, env, ctx) {
    // 1) log it, so we know it loaded
    console.log("▶️ POLLING_URL is:", env.POLLING_URL);

    // 2) actually call it
    try {
      const resp = await fetch(env.POLLING_URL);
      console.log(
        `trigger fired at ${event.cron}: ${resp.ok ? "✅ success" : "❌ fail"}`
      );
    } catch (err) {
      console.error("❌ fetch threw:", err);
    }
  },
};
