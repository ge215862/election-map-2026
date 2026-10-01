#!/bin/sh
# Publish only the page files (node_modules and tools stay private), functions bundled from the repo.
set -e
cd "$(dirname "$0")/.."
mkdir -p .deploy
cp index.html data.json states-albers-10m.json .deploy/
netlify deploy --no-build --dir .deploy --functions netlify/functions "$@"
