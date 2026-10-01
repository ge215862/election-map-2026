#!/usr/bin/env python3
"""Pull current Polymarket odds into data.json (the static snapshot).

Same rules as the live /api/odds function and the page:
D share = sum of outcome prices whose title matches race.market.d (default "(D)"),
color band from that share, "safe" kept only when analysts say safe and the
market agrees at 90% or more.
Usage: python3 tools/refresh_odds.py [--new-week]
--new-week first stores the current odds and colors as last week's baseline
(prevProb, prevRating, meta.*.prevDemProb), which the page uses for
"redder / bluer this week" and the angel vs devil barometer.
"""
import datetime
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(ROOT, "data.json")
GAMMA = "https://gamma-api.polymarket.com/events?slug="


def band(p, base):
    if base == "safeD" and p >= 90:
        return "safeD"
    if base == "safeR" and p <= 10:
        return "safeR"
    if p >= 82:
        return "likelyD"
    if p >= 62:
        return "leanD"
    if p > 38:
        return "tossup"
    if p > 18:
        return "leanR"
    return "likelyR"


def share(slug, match):
    req = urllib.request.Request(GAMMA + urllib.parse.quote(slug), headers={"User-Agent": "Mozilla/5.0"})
    events = json.load(urllib.request.urlopen(req, timeout=20))
    if not events:
        return None
    total, hit = 0.0, False
    for m in events[0].get("markets", []):
        if m.get("closed"):
            continue
        title = m.get("groupItemTitle") or m.get("question") or ""
        if not any(s in title for s in match):
            continue
        try:
            total += float(json.loads(m.get("outcomePrices") or "[]")[0])
            hit = True
        except (ValueError, IndexError):
            pass
    return round(total * 100, 1) if hit else None


data = json.load(open(PATH, encoding="utf-8"))
stamp = datetime.date.today().strftime("%d.%m")
if "--new-week" in sys.argv:
    for r in data["races"]:
        if r.get("dProb") is not None:
            r["prevProb"] = r["dProb"]
        r["prevRating"] = r["rating"]
    for chamber in ("senate", "house"):
        if data["meta"][chamber].get("demProb") is not None:
            data["meta"][chamber]["prevDemProb"] = data["meta"][chamber]["demProb"]
    data["meta"]["prevLabel"] = stamp
    print("baseline moved to", stamp)
for r in data["races"]:
    mk = r.get("market")
    if not mk:
        continue
    p = share(mk["slug"], mk.get("d") or ["(D)"])
    if p is None:
        print("no price:", r["chamber"], r["st"], mk["slug"])
        continue
    new = band(p, r.get("baseRating") or r["rating"])
    if new != r["rating"] or p != r.get("dProb"):
        print("%-8s %s %5s -> %5s  %s -> %s" % (r["chamber"], r["st"], r.get("dProb"), p, r["rating"], new))
    r["dProb"], r["rating"], r["probSrc"] = p, new, "Polymarket, " + stamp

for chamber, slug in (data["meta"].get("markets") or {}).items():
    p = share(slug, ["Democratic"])
    if p is not None:
        print("control %s: %s -> %s" % (chamber, data["meta"][chamber].get("demProb"), p))
        data["meta"][chamber]["demProb"] = p

bal = data["meta"].get("balance")
if bal:
    for oid, title in bal["outcomes"].items():
        p = share(bal["slug"], [title])
        if p is not None:
            bal["values"][oid] = p
    print("balance:", bal["values"])

json.dump(data, open(PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
