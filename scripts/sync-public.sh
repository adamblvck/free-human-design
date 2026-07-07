#!/usr/bin/env bash
#
# Sync the engine subset from this (private monorepo) directory into a clone of
# the PUBLIC github.com/adamblvck/rave-engine repo. The website (site/, netlify/)
# and other private/monorepo-only files are deliberately excluded.
#
# Usage:
#   scripts/sync-public.sh /path/to/rave-engine-public-clone
#
# Then in the public clone:
#   git add -A && git commit -m "sync engine" && git push
#
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:?Usage: sync-public.sh <path-to-public-repo-clone>}"

if [ ! -d "$DEST/.git" ]; then
  echo "Error: $DEST is not a git clone (no .git/). Clone the public repo there first." >&2
  exit 1
fi

rsync -av --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'coverage/' \
  --exclude '.netlify/' \
  --exclude '.claude/' \
  --exclude 'site/' \
  --exclude 'netlify/' \
  --exclude 'netlify.toml' \
  --exclude '.DS_Store' \
  --exclude '*.tgz' \
  "$SRC/" "$DEST/"

echo ""
echo "Synced engine -> $DEST"
echo "Next: cd \"$DEST\" && git add -A && git commit -m 'sync engine' && git push"
