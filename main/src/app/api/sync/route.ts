import { NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

    // 1. Process activity logs & deletions
    if (Array.isArray(pendingLogs) && pendingLogs.length > 0) {
      for (const log of pendingLogs) {
        await db
          .insert(schema.activityLogs)
          .values({
            id: log.id,
            moduleId: log.moduleId,
            containerId: log.containerId,
            subjectId: log.subjectId || null,
            activityType: log.activityType,
            quantity: log.quantity ? log.quantity.toString() : "1",
            unit: log.unit || null,
            note: log.note || null,
            performedAt: log.performedAt ? new Date(log.performedAt) : new Date(),
            syncedToCloud: true,
          })
          .onConflictDoNothing();

        // Deletions
        if (log.activityType === "TERMINATE" && log.containerId) {
          await db.delete(schema.containers).where(eq(schema.containers.id, log.containerId));
        }
      }
    }

    // 2. Upsert farm modules
    if (Array.isArray(modules) && modules.length > 0) {
      for (const m of modules) {
        await db
          .insert(schema.farmModules)
          .values({
            id: m.id,
            name: m.name,
            category: m.category,
            trackingMode: m.trackingMode,
            description: m.description || null,
            config: m.config,
          })
          .onConflictDoUpdate({
            target: schema.farmModules.id,
            set: {
              name: m.name,
              category: m.category,
              description: m.description || null,
              config: m.config,
              updatedAt: new Date(),
            },
          });
      }
    }

    // 3. Upsert containers
    if (Array.isArray(containers) && containers.length > 0) {
      for (const c of containers) {
        await db
          .insert(schema.containers)
          .values({
            id: c.id,
            moduleId: c.moduleId,
            name: c.name,
            code: c.code,
            capacity: c.capacity ?? 1,
            status: c.status,
            maintenanceNote: c.maintenanceNote || null,
            sortOrder: c.sortOrder ?? 0,
          })
          .onConflictDoUpdate({
            target: schema.containers.id,
            set: {
              name: c.name,
              code: c.code,
              capacity: c.capacity ?? 1,
              status: c.status,
              maintenanceNote: c.maintenanceNote || null,
              sortOrder: c.sortOrder ?? 0,
            },
          });
      }
    }

    // 4. Upsert subjects
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
            isActive: s.isActive ?? true,
            lastRoutineDate: s.lastRoutineDate || null,
            lastHarvestDate: s.lastHarvestDate || null,
          })
          .onConflictDoUpdate({
            target: schema.subjects.id,
            set: {
              populationCount: s.populationCount ?? 1,
              isActive: s.isActive ?? true,
              lastRoutineDate: s.lastRoutineDate || null,
              lastHarvestDate: s.lastHarvestDate || null,
            },
          });
      }
    }

    // 5. Fetch clean cloud state to return
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
    console.error("[CymFarm Sync Error]:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to synchronize" },
      { status: 500 }
    );
  }
}
