import { localDb, type LocalSubject, getTodayDateStr } from "@/lib/offline-db";

let isSyncInProgress = false;
let lastSyncTimestamp: number | null = null;
const syncListeners = new Set<(isSyncing: boolean) => void>();

function notifyListeners(syncing: boolean) {
  syncListeners.forEach((fn) => fn(syncing));
}

export function subscribeSyncState(fn: (isSyncing: boolean) => void) {
  syncListeners.add(fn);
  return () => {
    syncListeners.delete(fn);
  };
}

export function getLastSyncTime(): number | null {
  return lastSyncTimestamp;
}

export function getIsSyncing(): boolean {
  return isSyncInProgress;
}

export async function runFarmSync(): Promise<{ success: boolean; error?: string }> {
  if (isSyncInProgress) return { success: true };

  isSyncInProgress = true;
  notifyListeners(true);

  try {
    // 1. Ambil log lokal yang belum terdorong ke cloud
    const pendingLogs = await localDb.activityLogs
      .filter((l) => !l.syncedToCloud)
      .toArray();

    // 2. Ambil entitas lokal yang baru/berubah (syncedToCloud: false)
    const [
      pendingModules,
      localModCats,
      pendingContainers,
      pendingSubjects,
      localFeedCats,
      pendingFeedPurchases,
    ] = await Promise.all([
      localDb.farmModules.filter((m) => m.syncedToCloud === false).toArray(),
      localDb.farmModuleCategories.toArray(),
      localDb.containers.filter((c) => c.syncedToCloud === false).toArray(),
      localDb.subjects.filter((s) => s.syncedToCloud === false).toArray(),
      localDb.feedCategories.toArray(),
      localDb.feedPurchases.filter((fp) => fp.syncedToCloud === false).toArray(),
    ]);

    // Format lastPulledAt jika sebelumnya sudah pernah sync
    const lastPulledAt = lastSyncTimestamp ? new Date(lastSyncTimestamp).toISOString() : null;

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lastPulledAt,
        pendingLogs,
        modules: pendingModules,
        moduleCategories: localModCats,
        containers: pendingContainers,
        subjects: pendingSubjects,
        feedCategories: localFeedCats,
        feedPurchases: pendingFeedPurchases,
      }),
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const payload = await res.json();
    if (!payload.success || !payload.data) throw new Error(payload.error || "Malformed sync");

    const {
      modules,
      moduleCategories,
      containers,
      subjects,
      feedCategories,
      feedPurchases,
      activityLogs,
    } = payload.data;

    // Tandai log & entitas yang tadi dikirim sebagai sudah syncedToCloud: true
    for (const log of pendingLogs) {
      await localDb.activityLogs.update(log.id, { syncedToCloud: true });
    }
    for (const m of pendingModules) {
      await localDb.farmModules.update(m.id, { syncedToCloud: true });
    }
    for (const c of pendingContainers) {
      await localDb.containers.update(c.id, { syncedToCloud: true });
    }
    for (const s of pendingSubjects) {
      await localDb.subjects.update(s.id, { syncedToCloud: true });
    }
    for (const fp of pendingFeedPurchases) {
      await localDb.feedPurchases.update(fp.id, { syncedToCloud: true });
    }

    // Atomic update data yang ditarik dari cloud ke IndexedDB lokal
    await localDb.transaction(
      "rw",
      [
        localDb.farmModules,
        localDb.farmModuleCategories,
        localDb.containers,
        localDb.subjects,
        localDb.feedCategories,
        localDb.feedPurchases,
        localDb.activityLogs,
      ],
      async () => {
        // Upsert / soft-delete modules
        if (Array.isArray(modules) && modules.length > 0) {
          for (const m of modules) {
            await localDb.farmModules.put({
              ...m,
              updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : new Date().toISOString(),
              deletedAt: m.deletedAt ? new Date(m.deletedAt).toISOString() : null,
              syncedToCloud: true,
            });
          }
        }

        if (moduleCategories?.length) {
          await localDb.farmModuleCategories.bulkPut(moduleCategories);
        }

        // Upsert / soft-delete containers
        if (Array.isArray(containers) && containers.length > 0) {
          for (const c of containers) {
            await localDb.containers.put({
              ...c,
              updatedAt: c.updatedAt ? new Date(c.updatedAt).toISOString() : new Date().toISOString(),
              deletedAt: c.deletedAt ? new Date(c.deletedAt).toISOString() : null,
              syncedToCloud: true,
            });
          }
        }

        // Upsert / soft-delete subjects
        if (Array.isArray(subjects) && subjects.length > 0) {
          for (const s of subjects) {
            await localDb.subjects.put({
              ...s,
              populationCount: Number(s.populationCount) || 0,
              updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : new Date().toISOString(),
              deletedAt: s.deletedAt ? new Date(s.deletedAt).toISOString() : null,
              syncedToCloud: true,
            });
          }
        }

        if (feedCategories?.length) {
          await localDb.feedCategories.bulkPut(feedCategories);
        }

        if (Array.isArray(feedPurchases) && feedPurchases.length > 0) {
          await localDb.feedPurchases.bulkPut(
            feedPurchases.map((fp: any) => ({
              ...fp,
              weightKg: Number(fp.weightKg),
              purchasedAt: new Date(fp.purchasedAt).toISOString(),
              syncedToCloud: true,
            }))
          );
        }

        // Upsert log aktivitas baru & terapkan state aksinya (Apply Action Reducer)
        if (Array.isArray(activityLogs) && activityLogs.length > 0) {
          for (const log of activityLogs) {
            await localDb.activityLogs.put({
              ...log,
              quantity: Number(log.quantity) || 1,
              performedAt: new Date(log.performedAt).toISOString(),
              syncedToCloud: true,
            });

            // Terapkan aksi riil ke subjek & wadah lokal (state synchronization)
            const logDateStr = new Date(log.performedAt).toISOString().split("T")[0];

            if (log.activityType === "ROUTINE" && log.subjectId) {
              const currentSubj = await localDb.subjects.get(log.subjectId);
              if (currentSubj && (!currentSubj.lastRoutineDate || currentSubj.lastRoutineDate < logDateStr)) {
                await localDb.subjects.update(log.subjectId, {
                  lastRoutineDate: logDateStr,
                  updatedAt: new Date().toISOString(),
                });
              }
            } else if (log.activityType === "HARVEST" && log.subjectId) {
              const currentSubj = await localDb.subjects.get(log.subjectId);
              if (currentSubj && (!currentSubj.lastHarvestDate || currentSubj.lastHarvestDate < logDateStr)) {
                await localDb.subjects.update(log.subjectId, {
                  lastHarvestDate: logDateStr,
                  updatedAt: new Date().toISOString(),
                });
              }
            } else if (log.activityType === "POPULATION_CHANGE" && log.subjectId) {
              // Set populasi mutlak jika log lebih baru
              const targetPop = Number(log.quantity) || 0;
              await localDb.subjects.update(log.subjectId, {
                populationCount: targetPop,
                updatedAt: new Date().toISOString(),
              });
            } else if (log.activityType === "TERMINATE" && log.containerId) {
              await localDb.containers.update(log.containerId, {
                status: "VACANT",
                updatedAt: new Date().toISOString(),
              });
              if (log.subjectId) {
                await localDb.subjects.update(log.subjectId, {
                  isActive: false,
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          }
        }
      }
    );

    lastSyncTimestamp = Date.now();
    return { success: true };
  } catch (err: any) {
    console.warn("[Sync notice]:", err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
    notifyListeners(false);
  }
}
