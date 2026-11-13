"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialCleanState, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { ModularWorkerView } from "@/components/ModularWorkerView";

export default function LapanganPage() {
  const [ready, setReady] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string>("");

  useEffect(() => {
    ensureInitialCleanState().then(() => setReady(true));
  }, []);

  const containers = useLiveQuery(() => localDb.containers.toArray(), [], []);
  const subjects = useLiveQuery(() => localDb.subjects.toArray(), [], []);
  const modules = useLiveQuery(() => localDb.farmModules.toArray(), [], []);

  useEffect(() => {
    if (!selectedCode && containers && containers.length > 0) {
      setSelectedCode(containers[0].code);
    }
  }, [containers, selectedCode]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-sm font-black">Memuat Lapangan...</p>
      </div>
    );
  }

  return (
    <AppShell
      activeContainerCode={selectedCode}
      onSelectContainerCode={(code) => setSelectedCode(code)}
    >
      <ModularWorkerView
        containers={containers || []}
        subjects={subjects || []}
        modules={modules || []}
        selectedCode={selectedCode}
        onSelectCode={(code) => setSelectedCode(code)}
      />
    </AppShell>
  );
}
