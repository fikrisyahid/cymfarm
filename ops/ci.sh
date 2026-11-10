#!/usr/bin/env bash
set -euo pipefail

echo "🚀 [CI/CD] Starting CymFarm verification pipeline from root..."

echo "1️⃣ Syncing root .env..."
bun run env:sync

echo "2️⃣ Installing dependencies..."
bun install

echo "3️⃣ Running TypeScript typecheck..."
bun run typecheck

echo "4️⃣ Running Next.js production build..."
bun run build

echo "✅ [CI/CD] Pipeline completed successfully!"
