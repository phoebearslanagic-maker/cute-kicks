#!/bin/bash
# Deploy an update: stamp all asset URLs and module imports with a fresh
# version number (so phones pick up changes on a simple reload instead of
# waiting out the 10-minute GitHub Pages cache), commit, and push.
#
# Usage: scripts/deploy.sh "Commit message"
set -euo pipefail

cd "$(dirname "$0")/.."
MSG="${1:?Usage: scripts/deploy.sh \"Commit message\"}"

STAMP=$(date +%s)
sed -i '' -E "s/\?v=[0-9]+/?v=$STAMP/g" index.html js/*.js

git add -A
git commit -m "$MSG

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
git push origin main

echo "Deployed (version stamp $STAMP). Live in a minute or two at:"
echo "  https://phoebearslanagic-maker.github.io/cute-kicks/"
