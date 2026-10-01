// Live Polymarket odds for the map, plus last week's snapshot for the weekly trend.
// The CDN keeps the answer for 10 minutes, so Polymarket is hit rarely.
import { computeOdds, saveSnapshot, weekAgo } from "../lib/odds.mjs";

export default async () => {
  const odds = await computeOdds();
  let prev = null;
  try {
    // backup for the daily schedule: the first visit of a day also leaves a snapshot
    if (Object.keys(odds).length) await saveSnapshot(odds, new Date(), true);
    prev = await weekAgo();
  } catch { /* the page falls back to the weekly baseline in data.json */ }
  return new Response(JSON.stringify({ updated: new Date().toISOString(), odds, prev }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "netlify-cdn-cache-control": "public, durable, s-maxage=600, stale-while-revalidate=1800",
    },
  });
};

export const config = { path: "/api/odds" };
