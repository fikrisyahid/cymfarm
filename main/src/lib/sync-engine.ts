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

/**
 * Reconciles and synchronizes local Dexie (IndexedDB) with PostgreSQL (Supabase).
 * - Collects pending un-synced activity logs
 * - Posts to /api/sync
 * - Reconciles server state into IndexedDB
 * - Guaranteed single-flight (mutex locked via isSyncInProgress)
 */
export async function runFarmSync(): Promise<{ success: boolean; error?: string }> {
  if (isSyncInProgress) {
    return { success: true };
  }

  isSyncInProgress = true;
  notifyListeners(true);

  try {
    // 1. Gather pending mutations from IndexedDB
    const pendingLogs = await localDb.activityLogs
      .filter((l) => !l.syncedToCloud)
      .toArray();

    // 2. Gather current local state to ensure PostgreSQL has latest snapshots
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

    if (!res.ok) {
      throw new Error(`Sync server responded with status: ${res.status}`);
    }

    const payload = await res.json();
    if (!payload.success || !payload.data) {
      throw new Error(payload.error || "Malformed sync response");
    }

    const {
      modules,
      moduleCategories,
      containers,
      subjects,
      feedCategories,
      feedPurchases,
      activityLogs,
    } = payload.data;

    // 3. Mark pending logs as synced in IndexedDB
    if (pendingLogs.length > 0) {
      for (const log of pendingLogs) {
        await localDb.activityLogs.update(log.id, { syncedToCloud: true });
      }
    }

    // 4. Upsert cloud state into IndexedDB (Dexie)
    // Preserve local daily transient flags (fedToday, eggHarvestedToday) if valid for today
    const currentLocalSubMap = new Map(localSubjects.map((s) => [s.id, s]));
    const today = getTodayDateStr();

    const reconciledSubjects: LocalSubject[] = (subjects || []).map((cs: any) => {
      const local = currentLocalSubMap.get(cs.id);
      const isTodayFed = local?.lastFedDate === today && local?.fedToday;
      const isTodayEgg = local?.lastEggDate === today && local?.eggHarvestedToday;

      return {
        id: cs.id,
        moduleId: cs.moduleId,
        containerId: cs.containerId,
        label: cs.label,
        populationCount: cs.populationCount,
        sizeCategory: cs.sizeCategory || undefined,
        currentNodeId: cs.currentNodeId,
        consecutiveZeroYieldDays: cs.consecutiveZeroYieldDays,
        isRecommendedForCut: cs.isRecommendedForCut,
        timerStartedAt: cs.timerStartedAt ? new Date(cs.timerStartedAt).toISOString() : undefined,
        timerEndsAt: cs.timerEndsAt ? new Date(cs.timerEndsAt).toISOString() : undefined,
        isActive: cs.isActive,
        fedToday: isTodayFed,
        eggHarvestedToday: isTodayEgg,
        lastFedDate: local?.lastFedDate,
        lastEggDate: local?.lastEggDate,
      };
    });

    // Bulk put to IndexedDB in a transaction + Prune ONLY already-synced records deleted from Cloud (Anti-Zombie)
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
        // 1. Reconcile & Prune Feed Purchases
        // ATURAN EMAS: HANYA prune data yang SEBELUMNYA SUDAH TERSINKRON (syncedToCloud === true)
        // Data baru yang dibuat saat offline (syncedToCloud === false) TIDAK BOLEH DIHAPUS!
        if (Array.isArray(feedPurchases)) {
          const cloudFeedIds = new Set(feedPurchases.map((fp: any) => fp.id));
          const localFeeds = await localDb.feedPurchases.toArray();
          for (const lf of localFeeds) {
            // Jika data ini belum pernah naik ke cloud, JANGAN HAPUS! Ini data baru offline!
            if (lf.syncedToCloud === false) {
              continue;
            }
            // Jika data ini dulunya sudah ada di cloud, tapi sekarang hilang dari cloud -> Berarti sudah didelete di server!
            if (!cloudFeedIds.has(lf.id)) {
              await localDb.feedPurchases.delete(lf.id);
            }
          }
          if (feedPurchases.length > 0) {
            const formattedPurchases = feedPurchases.map((fp: any) => ({
              ...fp,
              weightKg: Number(fp.weightKg),
              purchasedAt: new Date(fp.purchasedAt).toISOString(),
              syncedToCloud: true,
            }));
            await localDb.feedPurchases.bulkPut(formattedPurchases);
          }
        }

        // 2. Reconcile & Prune Containers
        if (Array.isArray(containers)) {
          const cloudContIds = new Set(containers.map((c: any) => c.id));
          const localConts = await localDb.containers.toArray();
          for (const lc of localConts) {
            if (lc.syncedToCloud === false) {
              continue;
            }
            if (!cloudContIds.has(lc.id)) {
              await localDb.containers.delete(lc.id);
            }
          }
          if (containers.length > 0) {
            const formattedContainers = containers.map((c: any) => ({
              ...c,
              syncedToCloud: true,
            }));
            await localDb.containers.bulkPut(formattedContainers);
          }
        }

        // 3. Reconcile & Prune Modules
        if (Array.isArray(modules)) {
          const cloudModIds = new Set(modules.map((m: any) => m.id));
          const localMods = await localDb.farmModules.toArray();
          for (const lm of localMods) {
            if (lm.syncedToCloud === false) {
              continue;
            }
            if (!cloudModIds.has(lm.id)) {
              await localDb.farmModules.delete(lm.id);
            }
          }
          if (modules.length > 0) {
            const formattedModules = modules.map((m: any) => ({
              ...m,
              syncedToCloud: true,
            }));
            await localDb.farmModules.bulkPut(formattedModules);
          }
        }

        // 4. Upsert Module Categories & Subjects & Feed Categories
        if (moduleCategories?.length) await localDb.farmModuleCategories.bulkPut(moduleCategories);
        if (reconciledSubjects?.length) {
          const syncedSubjects = reconciledSubjects.map((s) => ({ ...s, syncedToCloud: true }));
          await localDb.subjects.bulkPut(syncedSubjects);
        }
        if (feedCategories?.length) await localDb.feedCategories.bulkPut(feedCategories);

        // 5. Activity logs reconciliation
        if (activityLogs?.length) {
          const formattedLogs = activityLogs.map((l: any) => ({
            ...l,
            performedAt: new Date(l.performedAt).toISOString(),
            syncedToCloud: true,
          }));
          await localDb.activityLogs.bulkPut(formattedLogs);
        }
      }
    );

    lastSyncTimestamp = Date.now();
    return { success: true };
  } catch (err: any) {
    console.warn("[CymFarm Offline Sync Notice]: Could not reach PostgreSQL cloud:", err.message);
    return { success: false, error: err.message };
  } finally {
    isSyncInProgress = false;
    notifyListeners(false);
  }
}
