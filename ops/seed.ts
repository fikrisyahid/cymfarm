#!/usr/bin/env bun
/**
 * CymFarm Database Seeder (PostgreSQL / Supabase)
 * 
 * Populates PostgreSQL database with initial farm blueprint, container hierarchy,
 * subjects, logistics, and activity logs from main/src/data/seed/
 */

import { resolve } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { drizzle } from "../main/node_modules/drizzle-orm/postgres-js";
import postgres from "../main/node_modules/postgres";
import * as schema from "../main/src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ ERROR: DATABASE_URL is not set in environment.");
  console.error("👉 Please ensure /.env has DATABASE_URL set and run: bun run env:sync");
  process.exit(1);
}

const seedDir = resolve(import.meta.dir, "../main/src/data/seed");

console.log("==================================================================");
console.log("🌱 [CymFarm DB Seed] Initializing PostgreSQL Database Seeder");
console.log("==================================================================");
console.log(`📁 Source Seed Directory: ${seedDir}`);

if (!existsSync(seedDir)) {
  console.error(`❌ ERROR: Seed folder not found at ${seedDir}`);
  process.exit(1);
}

// Load JSON Seed Files
const farmModules = JSON.parse(readFileSync(resolve(seedDir, "farm_modules.json"), "utf-8"));
const containers = JSON.parse(readFileSync(resolve(seedDir, "containers.json"), "utf-8"));
const subjects = JSON.parse(readFileSync(resolve(seedDir, "subjects.json"), "utf-8"));
const feedPurchases = JSON.parse(readFileSync(resolve(seedDir, "feed_purchases.json"), "utf-8"));
const activityLogs = JSON.parse(readFileSync(resolve(seedDir, "activity_logs.json"), "utf-8"));

// Default Categories
const defaultModuleCategories = [
  { id: "LIVESTOCK", name: "Peternakan", icon: "🐓" },
  { id: "AQUACULTURE", name: "Perikanan", icon: "🐟" },
  { id: "PLANT", name: "Tanaman", icon: "🌱" },
  { id: "OTHER", name: "Lainnya / Umum", icon: "🌾" },
];

const defaultFeedCategories = [
  { id: "AYAM", name: "Pakan Ayam", icon: "🐔" },
  { id: "IKAN", name: "Pakan Lele / Ikan", icon: "🐟" },
  { id: "TANAMAN", name: "Nutrisi Tanaman", icon: "🥬" },
  { id: "LAINNYA", name: "Lainnya", icon: "🌾" },
];

// Single connection for seed operation
const sql = postgres(DATABASE_URL, {
  max: 1,
  prepare: false,
  idle_timeout: 20,
  connect_timeout: 15,
});

const db = drizzle(sql, { schema });

async function seedDatabase() {
  const startTime = Date.now();
  try {
    console.log("\n📦 1. Seeding Module & Feed Categories...");
    for (const cat of defaultModuleCategories) {
      await db.insert(schema.farmModuleCategories)
        .values(cat)
        .onConflictDoNothing();
    }
    for (const cat of defaultFeedCategories) {
      await db.insert(schema.feedCategories)
        .values(cat)
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${defaultModuleCategories.length} module categories & ${defaultFeedCategories.length} feed categories.`);

    console.log("\n📦 2. Seeding Farm Modules (Blueprints)...");
    for (const mod of farmModules) {
      await db.insert(schema.farmModules)
        .values({
          id: mod.id,
          name: mod.name,
          category: mod.category,
          trackingMode: mod.trackingMode,
          description: mod.description,
          flowGraph: mod.flowGraph,
        })
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${farmModules.length} farm module(s).`);

    console.log("\n📦 3. Seeding Containers (Physical Hierarchy)...");
    // Sort containers so parents come before children to satisfy FKs if any
    const parents = containers.filter((c: any) => !c.parentId);
    const children = containers.filter((c: any) => c.parentId);

    for (const c of parents) {
      await db.insert(schema.containers)
        .values({
          id: c.id,
          parentId: c.parentId || null,
          moduleId: c.moduleId,
          name: c.name,
          code: c.code,
          containerType: c.containerType,
          status: c.status,
          sortOrder: c.sortOrder ?? 0,
        })
        .onConflictDoNothing();
    }
    for (const c of children) {
      await db.insert(schema.containers)
        .values({
          id: c.id,
          parentId: c.parentId || null,
          moduleId: c.moduleId,
          name: c.name,
          code: c.code,
          containerType: c.containerType,
          status: c.status,
          sortOrder: c.sortOrder ?? 0,
        })
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${containers.length} container(s).`);

    console.log("\n📦 4. Seeding Subjects (Chickens & Catfish)...");
    for (const s of subjects) {
      await db.insert(schema.subjects)
        .values({
          id: s.id,
          moduleId: s.moduleId,
          containerId: s.containerId,
          label: s.label,
          populationCount: s.populationCount ?? 1,
          sizeCategory: s.sizeCategory,
          currentNodeId: s.currentNodeId,
          consecutiveZeroYieldDays: s.consecutiveZeroYieldDays ?? 0,
          isRecommendedForCut: s.isRecommendedForCut ?? false,
          isActive: s.isActive ?? true,
          timerStartedAt: s.timerStartedAt ? new Date(s.timerStartedAt) : null,
          timerEndsAt: s.timerEndsAt ? new Date(s.timerEndsAt) : null,
        })
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${subjects.length} subject(s).`);

    console.log("\n📦 5. Seeding Feed Purchases & Logistics...");
    for (const f of feedPurchases) {
      await db.insert(schema.feedPurchases)
        .values({
          id: f.id,
          feedName: f.feedName,
          category: f.category || "AYAM",
          weightKg: f.weightKg.toString(),
          priceIdr: f.priceIdr,
          purchasedAt: f.purchasedAt ? new Date(f.purchasedAt) : new Date(),
          notes: f.notes,
        })
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${feedPurchases.length} feed purchase(s).`);

    console.log("\n📦 6. Seeding Activity Logs...");
    for (const l of activityLogs) {
      await db.insert(schema.activityLogs)
        .values({
          id: l.id,
          moduleId: l.moduleId,
          containerId: l.containerId,
          subjectId: l.subjectId || null,
          activityType: l.activityType,
          quantity: l.quantity ?? 1,
          note: l.note,
          performedAt: l.performedAt ? new Date(l.performedAt) : new Date(),
          syncedToCloud: true,
        })
        .onConflictDoNothing();
    }
    console.log(`   ✅ Seeded ${activityLogs.length} activity log(s).`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("\n==================================================================");
    console.log(`🎉 [CymFarm DB Seed] ALL INITIAL SEED DATA INSERTED in ${duration}s!`);
    console.log("==================================================================\n");
  } catch (error) {
    console.error("\n❌ [CymFarm DB Seed FAILED]:", error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedDatabase();
