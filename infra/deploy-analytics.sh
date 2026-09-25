#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/infra"
npm ci
export GITHUB_OWNER="${GITHUB_OWNER:-LuisMiguelMedina}"
export GITHUB_REPO="${GITHUB_REPO:-mtg-commander-deck-generator}"
npx cdk deploy MtgDeckBuilderAnalytics --require-approval never --outputs-file cdk-outputs.json
echo "Outputs written to infra/cdk-outputs.json"
cat cdk-outputs.json
