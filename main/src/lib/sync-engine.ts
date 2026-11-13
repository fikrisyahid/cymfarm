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

export async function runFarmSync(): Promise<{ success: boolean; error?: string }> {
  if (isSyncInProgress) return { success: true };

  isSyncInProgress = true;
  notifyListeners(true);

  try {
    const pendingLogs = await localDb.activityLogs
      .filter((l) => !l.syncedToCloud)
      .toArray();

    const [
      localModules,
      localModCats,
      localContainers,
      localSubjects,
      localFeedCats,
      localFeedPurchases,
    ] = await Promise.all([
      localDb.farmModules.toArray(),
      localDb.farmModuleCategories.toArray(),
      localDb.containers.toArray(),
      localDb.subjects.toArray(),
      localDb.feedCategories.toArray(),
      localDb.feedPurchases.toArray(),
    ]);

    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pendingLogs,
        modules: localModules,
        moduleCategories: localModCats,
        containers: localContainers,
        subjects: localSubjects,
        feedCategories: localFeedCats,
        feedPurchases: localFeedPurchases,
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

    // Mark pending logs as synced
    for (const log of pendingLogs) {
      await localDb.activityLogs.update(log.id, { syncedToCloud: true });
    }

    // Atomic update to IndexedDB
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
        // Prune deleted & upsert
        if (Array.isArray(containers)) {
          const cloudIds = new Set(containers.map((c: any) => c.id));
          const localItems = await localDb.containers.toArray();
          for (const item of localItems) {
            if (item.syncedToCloud !== false && !cloudIds.has(item.id)) {
              await localDb.containers.delete(item.id);
            }
          }
          if (containers.length > 0) {
            await localDb.containers.bulkPut(
              containers.map((c: any) => ({ ...c, syncedToCloud: true }))
            );
          }
        }

        if (Array.isArray(modules)) {
          const cloudIds = new Set(modules.map((m: any) => m.id));
          const localItems = await localDb.farmModules.toArray();
          for (const item of localItems) {
            if (item.syncedToCloud !== false && !cloudIds.has(item.id)) {
              await localDb.farmModules.delete(item.id);
            }
          }
          if (modules.length > 0) {
            await localDb.farmModules.bulkPut(
              modules.map((m: any) => ({ ...m, syncedToCloud: true }))
            );
          }
        }

        if (moduleCategories?.length) await localDb.farmModuleCategories.bulkPut(moduleCategories);
        if (subjects?.length) {
          await localDb.subjects.bulkPut(
            subjects.map((s: any) => ({ ...s, syncedToCloud: true }))
          );
        }
        if (feedCategories?.length) await localDb.feedCategories.bulkPut(feedCategories);
        if (feedPurchases?.length) {
          await localDb.feedPurchases.bulkPut(
            feedPurchases.map((fp: any) => ({
              ...fp,
              weightKg: Number(fp.weightKg),
              purchasedAt: new Date(fp.purchasedAt).toISOString(),
              syncedToCloud: true,
            }))
          );
        }
        if (activityLogs?.length) {
          await localDb.activityLogs.bulkPut(
            activityLogs.map((l: any) => ({
              ...l,
              quantity: Number(l.quantity) || 1,
              performedAt: new Date(l.performedAt).toISOString(),
              syncedToCloud: true,
            }))
          );
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
