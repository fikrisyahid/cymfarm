"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { runFarmSync, subscribeSyncState, getLastSyncTime } from "@/lib/sync-engine";

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
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(getLastSyncTime());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to global sync engine state changes
    const unsubscribe = subscribeSyncState((syncing) => {
      if (isMountedRef.current) {
        setIsSyncing(syncing);
        if (!syncing) {
          setLastSyncedAt(getLastSyncTime());
        }
      }
    });

    // 1. Initial sync on page mount
    runFarmSync().catch(() => {});

    // 2. Sync on window focus / tab visibility change (crucial for multi-device family usage)
    const handleFocus = () => {
      if (document.visibilityState === "visible") {
        runFarmSync().catch(() => {});
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      isMountedRef.current = false;
      unsubscribe();
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
