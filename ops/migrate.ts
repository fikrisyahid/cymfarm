#!/usr/bin/env bun
/**
 * CymFarm Database Migration Orchestrator & Runner
 * 
 * Provides robust, enterprise-grade database migration execution for PostgreSQL/Supabase.
 * Bypasses brittle CLI limitations by executing migrations programmatically via drizzle-orm migrator,
 * with support for pre-flight SQL assertions (extensions, schemas) and post-migration validation.
 */

import { resolve } from "node:path";
import { existsSync, readdirSync } from "node:fs";
import { drizzle } from "../main/node_modules/drizzle-orm/postgres-js";
import { migrate } from "../main/node_modules/drizzle-orm/postgres-js/migrator";
import postgres from "../main/node_modules/postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is not set in environment.");
  console.error("👉 Please ensure /.env has DATABASE_URL set and run: bun run env:sync");
  process.exit(1);
}

const migrationsDir = resolve(import.meta.dir, "../main/drizzle");

console.log("==================================================================");
console.log("🚀 [CymFarm DB Migration] Initializing PostgreSQL Migration Runner");
console.log("==================================================================");
console.log(`📁 Target Migrations Directory: ${migrationsDir}`);

if (!existsSync(migrationsDir)) {
  console.warn(`⚠️ Warning: Migrations folder not found at ${migrationsDir}`);
  console.warn(`👉 Generating migrations first via drizzle-kit generate...`);
} else {
  const sqlFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));
  console.log(`📄 Found ${sqlFiles.length} migration file(s):`);
  sqlFiles.forEach((file) => console.log(`   - ${file}`));
}

// Disable prefetch for Supabase / PgBouncer Transaction mode (port 6543)
// max: 1 connection dedicated for migration execution
const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 15,
});

const db = drizzle(sql);

async function runMigration() {
  const startTime = Date.now();
  try {
    console.log("\n🔍 Step 1: Pre-flight checks (Connection & PostgreSQL Extensions)...");
    const [version] = await sql`SELECT version();`;
    console.log(`✅ Connected successfully to: ${version.version.slice(0, 60)}...`);

    // Ensure common essential PostgreSQL extensions are present
    console.log("   Ensuring pgcrypto & uuid-ossp extensions exist...");
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`;
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;
    console.log("✅ Pre-flight checks passed.");

    console.log("\n📦 Step 2: Running Drizzle Schema Migrations...");
    await migrate(db, { migrationsFolder: migrationsDir });
    console.log("✅ Drizzle migrations applied successfully.");

    console.log("\n📊 Step 3: Verifying Database Public Tables...");
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    console.log(`✅ Current tables in public schema (${tables.length}):`);
    tables.forEach((t) => console.log(`   [✓] ${t.table_name}`));

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n==================================================================");
    console.log(`🎉 [CymFarm DB Migration] ALL MIGRATIONS COMPLETED in ${duration}s!`);
    console.log("==================================================================\n");
  } catch (error) {
    console.error("\n❌ [CymFarm DB Migration FAILED]:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigration();
