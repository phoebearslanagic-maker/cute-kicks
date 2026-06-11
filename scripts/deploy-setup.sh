#!/bin/bash
# One-time GitHub Pages setup for Kick. Run AFTER `gh auth login --web`.
# Creates a public repo named kick-tracker, pushes, and enables Pages.
set -euo pipefail

cd "$(dirname "$0")/.."
GH="${GH:-$HOME/.local/bin/gh}"

if ! "$GH" auth status >/dev/null 2>&1; then
  echo "Not logged in to GitHub yet. Run:  $GH auth login --web"
  exit 1
fi

LOGIN=$("$GH" api user -q .login)
echo "Logged in as $LOGIN"

# Use the GitHub noreply address so no personal email lands in public commits.
USER_ID=$("$GH" api user -q .id)
git config user.name "$LOGIN"
git config user.email "${USER_ID}+${LOGIN}@users.noreply.github.com"

# Re-stamp the initial commit with the real GitHub identity if it still
# carries the pre-auth placeholder.
if [ "$(git log -1 --format=%ae)" = "phoebe@users.noreply.github.com" ]; then
  git commit --amend --reset-author --no-edit
fi

if ! "$GH" repo view "$LOGIN/kick-tracker" >/dev/null 2>&1; then
  "$GH" repo create kick-tracker --public --description "Personal fetal movement tracker PWA" \
    --source . --remote origin
else
  git remote get-url origin >/dev/null 2>&1 || \
    git remote add origin "https://github.com/$LOGIN/kick-tracker.git"
fi

git branch -M main
git push -u origin main

# Enable Pages serving from the main branch root (409 = already enabled).
"$GH" api "repos/$LOGIN/kick-tracker/pages" -X POST \
  -f build_type=legacy -f 'source[branch]=main' -f 'source[path]=/' \
  >/dev/null 2>&1 || true

echo
echo "Done. The app will be live in a minute or two at:"
echo "  https://$LOGIN.github.io/kick-tracker/"
