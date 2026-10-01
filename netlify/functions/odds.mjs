// Live Polymarket odds for the races listed in data.json.
// Only slugs from data.json are fetched, so this is not an open proxy.
// The CDN keeps the answer for 10 minutes, so Polymarket is hit rarely.
import data from "../../data.json";

const GAMMA = "https://gamma-api.polymarket.com/events?slug=";

async function share(slug, match) {
  const res = await fetch(GAMMA + encodeURIComponent(slug), { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const [event] = await res.json();
  if (!event) return null;
  let total = 0, hit = false;
  for (const m of event.markets || []) {
    if (m.closed) continue;
    const title = m.groupItemTitle || m.question || "";
    if (!match.some((s) => title.includes(s))) continue;
    try {
      const p = parseFloat(JSON.parse(m.outcomePrices || "[]")[0]);
      if (Number.isFinite(p)) { total += p; hit = true; }
    } catch {}
  }
  return hit ? Math.round(total * 1000) / 10 : null;
}

async function pool(jobs, size) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < jobs.length) {
      const job = jobs[i++];
      try { out.push([job.key, await share(job.slug, job.match)]); } catch { /* skip this race */ }
    }
  }
  await Promise.all(Array.from({ length: size }, worker));
  return out;
}

export default async () => {
  const jobs = [];
  for (const r of data.races) {
    if (r.market) jobs.push({ key: `${r.chamber}-${r.st}`, slug: r.market.slug, match: r.market.d || ["(D)"] });
  }
  for (const [chamber, slug] of Object.entries(data.meta.markets || {})) {
    jobs.push({ key: `control-${chamber}`, slug, match: ["Democratic"] });
  }
  const odds = {};
  for (const [k, p] of await pool(jobs, 8)) if (p != null) odds[k] = p;
  return new Response(JSON.stringify({ updated: new Date().toISOString(), odds }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60",
      "netlify-cdn-cache-control": "public, durable, s-maxage=600, stale-while-revalidate=1800",
    },
  });
};

export const config = { path: "/api/odds" };
