// Daily snapshot of all odds, so "this week" on the map is computed without anyone updating it.
import { computeOdds, saveSnapshot } from "../lib/odds.mjs";

export default async () => {
  const odds = await computeOdds();
  if (Object.keys(odds).length) await saveSnapshot(odds);
};

// 12:00 UTC, 8:00 in Miami during daylight time
export const config = { schedule: "0 12 * * *" };
