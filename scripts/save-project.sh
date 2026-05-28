#!/usr/bin/env bash
# Save Qorix Markets to local git + GitHub (origin).
# Usage: bash scripts/save-project.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Qorix Markets — save to git"
echo "    Folder: $ROOT"
echo ""

# Pre-commit hook (blocks .env, backup.sql, *.sql.gz)
if [[ -d .githooks ]]; then
  git config core.hooksPath .githooks 2>/dev/null || true
fi

# Refuse if secrets/dumps exist and would be tracked
if [[ -f backup.sql ]]; then
  echo "ERROR: backup.sql exists in project root. Delete it before saving:"
  echo "  rm -f backup.sql"
  exit 1
fi

if git ls-files --error-unmatch .env &>/dev/null; then
  echo "ERROR: .env is tracked by git. Remove it:"
  echo "  git rm --cached .env"
  exit 1
fi

# Nested .git inside Flutter app breaks "git add" (submodule without checkout).
NESTED_GIT="apps/qorix_markets_flutter/qorix_markets_flutter_old/.git"
if [[ -e "$NESTED_GIT" ]]; then
  echo "==> Removing nested .git in Flutter app (merge into main repo)..."
  rm -rf "$NESTED_GIT"
fi

# Stage everything gitignore allows
git add -A

# Block accidental staging of build junk / secrets
BLOCKED=$(git diff --cached --name-only | grep -E '(^|/)\.env$|backup\.sql|\.sql\.gz$|/\.dart_tool/|/node_modules/' || true)
if [[ -n "$BLOCKED" ]]; then
  echo "ERROR: Blocked files would be committed:"
  echo "$BLOCKED"
  echo "Fix .gitignore or unstage, then retry."
  exit 1
fi

echo ""
echo "==> Staged changes:"
git diff --cached --stat || true
echo ""

if git diff --cached --quiet; then
  echo "Nothing new to commit — working tree already saved."
else
  MSG="chore: save Qorix Markets workspace ($(date -u +%Y-%m-%dT%H:%MZ))"

  git commit -m "$(cat <<EOF
$MSG

- Flutter app, API server, security fixes, docs
- Excludes secrets, backup.sql, build caches
EOF
)"
  echo ""
  echo "==> Committed locally."
fi

echo ""
echo "==> Pushing to GitHub (origin)..."
git push -u origin HEAD

echo ""
echo "DONE — project saved locally + GitHub."
git log -1 --oneline
git status -sb
