"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { StudioFlowBuilder } from "@/components/StudioFlowBuilder";

export default function AdminPage() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
  }, []);

  const modules = useLiveQuery(() => localDb.farmModules.toArray(), [], []);
  const containers = useLiveQuery(
    () => localDb.containers.orderBy("sortOrder").toArray(),
    [],
    []
  );

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-lg font-black">Memuat Studio Admin...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="p-4">
        <StudioFlowBuilder modules={modules} containers={containers} />
      </div>
    </AppShell>
  );
}
