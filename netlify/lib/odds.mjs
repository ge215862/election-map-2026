// Shared by the /api/odds endpoint and the daily snapshot.
// Only slugs from data.json are fetched, so this is not an open proxy.
import { getStore } from "@netlify/blobs";
import data from "../../data.json";

const GAMMA = "https://gamma-api.polymarket.com/events?slug=";

async function fetchEvent(slug) {
  const res = await fetch(GAMMA + encodeURIComponent(slug), { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const [event] = await res.json();
  return event || null;
}

// the cache lives for one computation, so several outcomes of one market cost one fetch
async function share(cache, slug, match) {
  if (!cache.has(slug)) cache.set(slug, fetchEvent(slug));
  const event = await cache.get(slug);
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

function jobs() {
  const list = [];
  for (const r of data.races) {
    if (r.market) list.push({ key: `${r.chamber}-${r.st}`, slug: r.market.slug, match: r.market.d || ["(D)"] });
  }
  for (const [chamber, slug] of Object.entries(data.meta.markets || {})) {
    list.push({ key: `control-${chamber}`, slug, match: ["Democratic"] });
  }
  const balance = data.meta.balance;
  if (balance) {
    for (const [id, title] of Object.entries(balance.outcomes)) list.push({ key: `balance-${id}`, slug: balance.slug, match: [title] });
  }
  return list;
}

export async function computeOdds() {
  const cache = new Map(), todo = jobs(), odds = {};
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const job = todo[i++];
      try {
        const p = await share(cache, job.slug, job.match);
        if (p != null) odds[job.key] = p;
      } catch { /* skip this race */ }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker));
  return odds;
}

// one snapshot per UTC day; the page compares today with a week ago
const history = () => getStore("odds-history");
const day = (d) => d.toISOString().slice(0, 10);

export async function saveSnapshot(odds, now = new Date(), onlyIfMissing = false) {
  const store = history(), key = day(now);
  if (onlyIfMissing && (await store.get(key))) return false;
  await store.setJSON(key, { date: key, odds });
  return true;
}

// closest snapshot to 7 days back, accepting 6..9 days so a missed day does not break the trend
export async function weekAgo(now = new Date()) {
  const store = history();
  for (const back of [7, 8, 6, 9]) {
    const d = new Date(now.getTime() - back * 86400000);
    const snap = await store.get(day(d), { type: "json" });
    if (snap && snap.odds) return snap;
  }
  return null;
}
