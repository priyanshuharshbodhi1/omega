/**
 * Standalone poller for sentiment spike detection.
 * Calls the /api/cron/sentiment-check endpoint every 5 minutes.
 *
 * Usage:  node scripts/sentiment-cron.mjs
 * Or:     npm run cron:sentiment
 */
import dotenv from "dotenv";
dotenv.config();

const BASE_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET || "";
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

async function check() {
  const url = `${BASE_URL}/api/cron/sentiment-check`;
  console.log(`[${new Date().toISOString()}] Checking sentiment spikes...`);
  try {
    const res = await fetch(url, {
      headers: CRON_SECRET
        ? { Authorization: `Bearer ${CRON_SECRET}` }
        : {},
    });
    const data = await res.json();
    console.log(
      `  Teams checked: ${data.teamsChecked}, Spikes: ${data.spikesDetected}`,
    );
    if (data.results) {
      for (const r of data.results) {
        if (r.spikeDetected) {
          console.log(
            `  SPIKE: ${r.teamName} (${r.teamId}) — recent neg rate ${r.recentNegRate} vs baseline ${r.baselineNegRate}`,
          );
        }
      }
    }
  } catch (err) {
    console.error("  Error:", err.message || err);
  }
}

// Run immediately, then on interval
check();
setInterval(check, INTERVAL_MS);
console.log(`Sentiment cron poller started (every ${INTERVAL_MS / 1000}s).`);
