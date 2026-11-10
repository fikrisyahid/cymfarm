#!/usr/bin/env bun
/**
 * Syncs the root `.env` file into `main/.env.local` (and copies `.env.example` if `.env` doesn't exist yet).
 * Always run from root so developers never have to manage environment files inside `/main`.
 */
import { existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dir, "..");
const rootEnvPath = resolve(rootDir, ".env");
const rootEnvExamplePath = resolve(rootDir, ".env.example");
const targetEnvPath = resolve(rootDir, "main", ".env.local");
const targetDrizzleEnvPath = resolve(rootDir, "main", ".env");

if (!existsSync(rootEnvPath)) {
  if (existsSync(rootEnvExamplePath)) {
    copyFileSync(rootEnvExamplePath, rootEnvPath);
    console.log("ℹ️  Created root .env from .env.example");
  } else {
    console.error("❌ Neither .env nor .env.example found in root directory!");
    process.exit(1);
  }
}

copyFileSync(rootEnvPath, targetEnvPath);
copyFileSync(rootEnvPath, targetDrizzleEnvPath);
console.log("✅ Synced root /.env -> /main/.env.local & /main/.env");
