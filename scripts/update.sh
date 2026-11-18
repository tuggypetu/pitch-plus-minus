#!/usr/bin/env bash
# Refresh the site with the latest model outputs and publish.
#
#   scripts/update.sh                      # model repo next to this one, seasons 2024 2025
#   scripts/update.sh ../football-isolated-impact/outputs 2025 2026
set -euo pipefail
cd "$(dirname "$0")/.."

OUTPUTS="${1:-../football-isolated-impact/outputs}"
shift || true
SEASONS="${*:-2024 2025}"

python3 scripts/export_data.py --outputs "$OUTPUTS" --seasons $SEASONS
node --test tests/*.test.mjs

git add site/data
if git diff --cached --quiet; then
  echo "Ratings unchanged; nothing to publish."
  exit 0
fi
git commit -m "Update ratings ($(date +%Y-%m-%d))"
git push
echo "Pushed. The site republishes in a minute or two (see the Actions tab)."
