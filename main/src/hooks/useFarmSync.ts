"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { runFarmSync, subscribeSyncState, getLastSyncTime, getIsSyncing } from "@/lib/sync-engine";

export interface FarmSyncHookReturn {
  isSyncing: boolean;
  lastSyncedAt: number | null;
  triggerSync: () => Promise<void>;
}

/**
 * Custom React Hook for seamless, robust offline-to-cloud synchronization.
 * - Triggers immediate sync on page mount
 * - Triggers sync when window regains focus (user switches back to CymFarm app)
 * - Exposes triggerSync() for manual triggering after CRUD operations
 */
export function useFarmSync(): FarmSyncHookReturn {
  // Inisialisasi dengan nilai real-time dari singleton sync engine agar saat pindah halaman state tidak tertinggal
  const [isSyncing, setIsSyncing] = useState<boolean>(() => getIsSyncing());
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(getLastSyncTime());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Pastikan sync state langsung cocok dengan singleton saat baru mount
    setIsSyncing(getIsSyncing());

    // Subscribe to global sync engine state changes
    const unsubscribe = subscribeSyncState((syncing) => {
      if (isMountedRef.current) {
        setIsSyncing(syncing);
        if (!syncing) {
          setLastSyncedAt(getLastSyncTime());
        }
      }
    });

    // 1. Initial sync on page mount (hanya jika sedang tidak in progress)
    if (!getIsSyncing()) {
      runFarmSync().catch(() => {});
    }

    // 2. Sync on window focus / tab visibility change (crucial for multi-device family usage)
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        runFarmSync().catch(() => {});
      }
    };

    // 3. Periodic background sync setiap 15 detik jika tab sedang aktif
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        runFarmSync().catch(() => {});
      }
    }, 15000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  const triggerSync = useCallback(async () => {
    await runFarmSync();
    if (isMountedRef.current) {
      setLastSyncedAt(getLastSyncTime());
    }
  }, []);

  return {
    isSyncing,
    lastSyncedAt,
    triggerSync,
  };
}
