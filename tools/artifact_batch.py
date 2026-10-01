#!/usr/bin/env python3
"""Split data.json into per-document files and ArtifactData batch specs.

The same data feeds the private claude.ai artifact copy of the map.
Usage: python3 tools/artifact_batch.py <out_dir>
Writes <out_dir>/docs/*.json and <out_dir>/batch1.json, batch2.json, ...
(each batch at most 50 writes: races/<id> and meta/summary).
"""
import json
import os
import sys

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "artifact-batch")
docs = os.path.join(out, "docs")
os.makedirs(docs, exist_ok=True)

data = json.load(open(os.path.join(root, "data.json"), encoding="utf-8"))
writes = []

meta_path = os.path.join(docs, "meta-summary.json")
json.dump(data["meta"], open(meta_path, "w", encoding="utf-8"), ensure_ascii=False)
writes.append({"op": "set", "collection": "meta", "doc_id": "summary", "file_path": meta_path})

for race in data["races"]:
    doc_id = ("sen-" if race["chamber"] == "senate" else "gov-") + race["st"]
    path = os.path.join(docs, doc_id + ".json")
    json.dump(race, open(path, "w", encoding="utf-8"), ensure_ascii=False)
    writes.append({"op": "set", "collection": "races", "doc_id": doc_id, "file_path": path})

for i in range(0, len(writes), 50):
    name = os.path.join(out, "batch%d.json" % (i // 50 + 1))
    json.dump(writes[i:i + 50], open(name, "w", encoding="utf-8"), ensure_ascii=False)
    print(name, len(writes[i:i + 50]))
