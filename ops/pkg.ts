#!/usr/bin/env bun
/**
 * Wrapper script to manage packages inside `/main` directly from the repository root.
 * Usage from root:
 *   bun run add <pkg> [-d]
 *   bun run remove <pkg>
 *   bun run update [pkg]
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const action = process.argv[2];
const args = process.argv.slice(3);
const mainDir = resolve(import.meta.dir, "..", "main");

if (!action || !["add", "remove", "update", "install"].includes(action)) {
  console.error("Usage: bun ops/pkg.ts <add|remove|update|install> [packages...]");
  process.exit(1);
}

console.log(`📦 Running 'bun ${action} ${args.join(" ")}' inside /main...`);
const result = spawnSync("bun", [action, ...args], {
  cwd: mainDir,
  stdio: "inherit",
});

process.exit(result.status ?? 0);
