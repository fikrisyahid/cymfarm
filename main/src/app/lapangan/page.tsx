"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { WorkerQrView } from "@/components/WorkerQrView";

export default function LapanganPage() {
  const [seeded, setSeeded] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("SET-1A");

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
  }, []);

  const containers = useLiveQuery(
    () => localDb.containers.orderBy("sortOrder").toArray(),
    [],
    []
  );
  const subjects = useLiveQuery(() => localDb.subjects.toArray(), [], []);

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
    >
      <WorkerQrView
        containers={containers}
        subjects={subjects}
        selectedCode={selectedCode}
        onSelectCode={(code) => setSelectedCode(code)}
      />
    </AppShell>
  );
}
