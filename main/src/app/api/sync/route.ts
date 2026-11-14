import { NextResponse } from "next/server";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      lastPulledAt, // ISO timestamp terakhir client sync, misal: "2026-11-14T12:00:00.000Z"
      pendingLogs = [],
      modules = [],
      moduleCategories = [],
      containers = [],
      subjects = [],
      feedCategories = [],
      feedPurchases = [],
    } = body;

    // 1. Process activity logs (Pure Append Only, No Hard Delete)
    if (Array.isArray(pendingLogs) && pendingLogs.length > 0) {
      for (const log of pendingLogs) {
        const perfDate = log.performedAt ? new Date(log.performedAt) : new Date();
        const dateStr = log.targetDate || perfDate.toISOString().split("T")[0];

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
            targetDate: dateStr,
            performedAt: perfDate,
            syncedToCloud: true,
          })
          .onConflictDoNothing();
      }
    }

    // 2. Upsert module categories
    if (Array.isArray(moduleCategories) && moduleCategories.length > 0) {
      for (const cat of moduleCategories) {
        await db
          .insert(schema.farmModuleCategories)
          .values({
            id: cat.id,
            name: cat.name,
            icon: cat.icon || "🌱",
          })
          .onConflictDoUpdate({
            target: schema.farmModuleCategories.id,
            set: {
              name: cat.name,
              icon: cat.icon || "🌱",
            },
          });
      }
    }

    // 3. Upsert farm modules (Supports soft delete deletedAt)
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
            updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
            deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
          })
          .onConflictDoUpdate({
            target: schema.farmModules.id,
            set: {
              name: m.name,
              category: m.category,
              description: m.description || null,
              config: m.config,
              updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
              deletedAt: m.deletedAt ? new Date(m.deletedAt) : null,
            },
          });
      }
    }

    // 4. Upsert containers (Supports soft delete deletedAt)
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
            updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
            deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
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
              updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
              deletedAt: c.deletedAt ? new Date(c.deletedAt) : null,
            },
          });
      }
    }

    // 5. Upsert subjects (Supports soft delete deletedAt)
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
            updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
            deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
          })
          .onConflictDoUpdate({
            target: schema.subjects.id,
            set: {
              populationCount: s.populationCount ?? 1,
              isActive: s.isActive ?? true,
              lastRoutineDate: s.lastRoutineDate || null,
              lastHarvestDate: s.lastHarvestDate || null,
              updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
              deletedAt: s.deletedAt ? new Date(s.deletedAt) : null,
            },
          });
      }
    }

    // 6. Incremental Pull: Jika client kirim lastPulledAt, cukup tarik data yang diupdate setelah timestamp tersebut
    const sinceDate = lastPulledAt ? new Date(lastPulledAt) : null;

    const [
      cloudModules,
      cloudModCats,
      cloudContainers,
      cloudSubjects,
      cloudFeedCats,
      cloudFeedPurchases,
      cloudLogs,
    ] = await Promise.all([
      sinceDate
        ? db.select().from(schema.farmModules).where(gt(schema.farmModules.updatedAt, sinceDate))
        : db.select().from(schema.farmModules),
      db.select().from(schema.farmModuleCategories),
      sinceDate
        ? db.select().from(schema.containers).where(gt(schema.containers.updatedAt, sinceDate)).orderBy(schema.containers.sortOrder)
        : db.select().from(schema.containers).orderBy(schema.containers.sortOrder),
      sinceDate
        ? db.select().from(schema.subjects).where(gt(schema.subjects.updatedAt, sinceDate))
        : db.select().from(schema.subjects),
      db.select().from(schema.feedCategories),
      db.select().from(schema.feedPurchases),
      sinceDate
        ? db.select().from(schema.activityLogs).where(gt(schema.activityLogs.performedAt, sinceDate))
        : db.select().from(schema.activityLogs).limit(500),
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
