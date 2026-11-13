import { NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Bidirectional Sync Payload:
 * - Client sends pending mutations (activityLogs with syncedToCloud = false, or modified containers/subjects/etc.)
 * - Server applies mutations to PostgreSQL
 * - Server returns the latest complete cloud state of the farm
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      pendingLogs = [],
      modules = [],
      moduleCategories = [],
      containers = [],
      subjects = [],
      feedCategories = [],
      feedPurchases = [],
    } = body;

    // 1. Process pending activity logs sent from offline client
    // Also process DELETION actions immediately so PostgreSQL drops deleted records
    if (Array.isArray(pendingLogs) && pendingLogs.length > 0) {
      for (const log of pendingLogs) {
        // Record the immutable event log
        await db
          .insert(schema.activityLogs)
          .values({
            id: log.id,
            moduleId: log.moduleId,
            containerId: log.containerId,
            subjectId: log.subjectId || null,
            activityType: log.activityType,
            quantity: log.quantity ?? 1,
            note: log.note || null,
            performedAt: log.performedAt ? new Date(log.performedAt) : new Date(),
            syncedToCloud: true,
          })
          .onConflictDoUpdate({
            target: schema.activityLogs.id,
            set: {
              note: log.note || null,
              quantity: log.quantity ?? 1,
              syncedToCloud: true,
            },
          });

        // Handle Deletions in PostgreSQL
        if (log.activityType === "FEED_PURCHASE_DELETE") {
          // In log, note contains or subjectId/containerId or we match ID
          // The deleted feed id was passed in log.containerId or note
          // To be 100% precise, we extract feedId if present, or if containerId is feed id
          const targetFeedId = log.subjectId || log.containerId;
          if (targetFeedId && targetFeedId !== "gudang") {
            await db.delete(schema.feedPurchases).where(eq(schema.feedPurchases.id, targetFeedId));
          }
        } else if (log.activityType === "CONTAINER_DELETE") {
          const targetContId = log.containerId;
          if (targetContId) {
            await db.delete(schema.containers).where(eq(schema.containers.id, targetContId));
          }
        }
      }
    }

    // 2. Upsert any modules sent from client
    if (Array.isArray(modules) && modules.length > 0) {
      for (const m of modules) {
        await db
          .insert(schema.farmModules)
          .values({
            id: m.id,
            name: m.name,
            category: m.category,
            trackingMode: m.trackingMode,
            description: m.description,
            flowGraph: m.flowGraph,
          })
          .onConflictDoUpdate({
            target: schema.farmModules.id,
            set: {
              name: m.name,
              category: m.category,
              description: m.description,
              flowGraph: m.flowGraph,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 3. Upsert module categories
    if (Array.isArray(moduleCategories) && moduleCategories.length > 0) {
      for (const c of moduleCategories) {
        await db
          .insert(schema.farmModuleCategories)
          .values({
            id: c.id,
            name: c.name,
            icon: c.icon || "🌾",
          })
          .onConflictDoNothing();
      }
    }

    // 4. Upsert containers
    if (Array.isArray(containers) && containers.length > 0) {
      for (const c of containers) {
        await db
          .insert(schema.containers)
          .values({
            id: c.id,
            parentId: c.parentId || null,
            moduleId: c.moduleId,
            name: c.name,
            code: c.code,
            containerType: c.containerType,
            status: c.status,
            maintenanceNote: c.maintenanceNote || null,
            sortOrder: c.sortOrder ?? 0,
          })
          .onConflictDoUpdate({
            target: schema.containers.id,
            set: {
              name: c.name,
              code: c.code,
              status: c.status,
              maintenanceNote: c.maintenanceNote || null,
              sortOrder: c.sortOrder ?? 0,
            },
          });
      }
    }

    // 5. Upsert subjects
    if (Array.isArray(subjects) && subjects.length > 0) {
      for (const s of subjects) {
        await db
          .insert(schema.subjects)
          .values({
            id: s.id,
            moduleId: s.moduleId,
            containerId: s.containerId,
            label: s.label,
            populationCount: s.populationCount ?? 1,
            sizeCategory: s.sizeCategory || null,
            currentNodeId: s.currentNodeId,
            consecutiveZeroYieldDays: s.consecutiveZeroYieldDays ?? 0,
            isRecommendedForCut: s.isRecommendedForCut ?? false,
            isActive: s.isActive ?? true,
            timerStartedAt: s.timerStartedAt ? new Date(s.timerStartedAt) : null,
            timerEndsAt: s.timerEndsAt ? new Date(s.timerEndsAt) : null,
          })
          .onConflictDoUpdate({
            target: schema.subjects.id,
            set: {
              containerId: s.containerId,
              populationCount: s.populationCount ?? 1,
              sizeCategory: s.sizeCategory || null,
              currentNodeId: s.currentNodeId,
              consecutiveZeroYieldDays: s.consecutiveZeroYieldDays ?? 0,
              isRecommendedForCut: s.isRecommendedForCut ?? false,
              isActive: s.isActive ?? true,
              timerStartedAt: s.timerStartedAt ? new Date(s.timerStartedAt) : null,
              timerEndsAt: s.timerEndsAt ? new Date(s.timerEndsAt) : null,
            },
          });
      }
    }

    // 6. Upsert feed categories
    if (Array.isArray(feedCategories) && feedCategories.length > 0) {
      for (const fc of feedCategories) {
        await db
          .insert(schema.feedCategories)
          .values({
            id: fc.id,
            name: fc.name,
            icon: fc.icon || "🌾",
          })
          .onConflictDoNothing();
      }
    }

    // 7. Upsert feed purchases
    if (Array.isArray(feedPurchases) && feedPurchases.length > 0) {
      for (const fp of feedPurchases) {
        await db
          .insert(schema.feedPurchases)
          .values({
            id: fp.id,
            feedName: fp.feedName,
            category: fp.category || "AYAM",
            weightKg: fp.weightKg.toString(),
            priceIdr: fp.priceIdr || null,
            purchasedAt: fp.purchasedAt ? new Date(fp.purchasedAt) : new Date(),
            notes: fp.notes || null,
          })
          .onConflictDoUpdate({
            target: schema.feedPurchases.id,
            set: {
              feedName: fp.feedName,
              category: fp.category || "AYAM",
              weightKg: fp.weightKg.toString(),
              priceIdr: fp.priceIdr || null,
              purchasedAt: fp.purchasedAt ? new Date(fp.purchasedAt) : new Date(),
              notes: fp.notes || null,
            },
          });
      }
    }

    // 8. Fetch latest state from PostgreSQL to return to client
    const [
      cloudModules,
      cloudModCats,
      cloudContainers,
      cloudSubjects,
      cloudFeedCats,
      cloudFeedPurchases,
      cloudLogs,
    ] = await Promise.all([
      db.select().from(schema.farmModules),
      db.select().from(schema.farmModuleCategories),
      db.select().from(schema.containers).orderBy(schema.containers.sortOrder),
      db.select().from(schema.subjects),
      db.select().from(schema.feedCategories),
      db.select().from(schema.feedPurchases),
      db.select().from(schema.activityLogs).limit(500),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        modules: cloudModules,
        moduleCategories: cloudModCats,
        containers: cloudContainers,
        subjects: cloudSubjects,
        feedCategories: cloudFeedCats,
        feedPurchases: cloudFeedPurchases,
        activityLogs: cloudLogs,
      },
    });
  } catch (error: any) {
    console.error("[CymFarm API Sync Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize data" },
      { status: 500 }
    );
  }
}

/**
 * GET Endpoint for simple read-only fetch of latest PostgreSQL cloud data
 */
export async function GET() {
  try {
    const [
      cloudModules,
      cloudModCats,
      cloudContainers,
      cloudSubjects,
      cloudFeedCats,
      cloudFeedPurchases,
      cloudLogs,
    ] = await Promise.all([
      db.select().from(schema.farmModules),
      db.select().from(schema.farmModuleCategories),
      db.select().from(schema.containers).orderBy(schema.containers.sortOrder),
      db.select().from(schema.subjects),
      db.select().from(schema.feedCategories),
      db.select().from(schema.feedPurchases),
      db.select().from(schema.activityLogs).limit(500),
    ]);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        modules: cloudModules,
        moduleCategories: cloudModCats,
        containers: cloudContainers,
        subjects: cloudSubjects,
        feedCategories: cloudFeedCats,
        feedPurchases: cloudFeedPurchases,
        activityLogs: cloudLogs,
      },
    });
  } catch (error: any) {
    console.error("[CymFarm API Sync GET Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch cloud data" },
      { status: 500 }
    );
  }
}
