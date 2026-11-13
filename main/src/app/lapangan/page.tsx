"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { WorkerQrView } from "@/components/WorkerQrView";
import { useFarmSync } from "@/hooks/useFarmSync";

export default function LapanganPage() {
  const [seeded, setSeeded] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("SET-1A");
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Hook sync otomatis multi-perangkat (buka halaman & tab focus)
  const { isSyncing, triggerSync } = useFarmSync();

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
  }, []);

  const containers = useLiveQuery(
    () => localDb.containers.orderBy("sortOrder").toArray(),
    [],
    []
  );
  const subjects = useLiveQuery(() => localDb.subjects.toArray(), [], []);
  const modules = useLiveQuery(() => localDb.farmModules.toArray(), [], []);

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
          <p className="mt-3 text-lg font-black">Memuat Area...</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      activeContainerCode={selectedCode}
      onSelectContainerCode={(code) => setSelectedCode(code)}
      selectedDate={selectedDate}
      onSelectDate={(date) => setSelectedDate(date)}
    >
      <WorkerQrView
        containers={containers}
        subjects={subjects}
        modules={modules}
        selectedCode={selectedCode}
        onSelectCode={(code) => setSelectedCode(code)}
        selectedDate={selectedDate}
      />
    </AppShell>
  );
}
