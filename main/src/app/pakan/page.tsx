"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { PakanManagementView } from "@/components/PakanManagementView";

export default function PakanPage() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
  }, []);

  const feedPurchases = useLiveQuery(
    () => localDb.feedPurchases.toArray(),
    [],
    []
  );
  const feedCategories = useLiveQuery(
    () => localDb.feedCategories.toArray(),
    [],
    []
  );

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-lg font-black">Memuat Manajemen Pakan...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="p-4">
        <PakanManagementView
          feedPurchases={feedPurchases || []}
          feedCategories={feedCategories || []}
        />
      </div>
    </AppShell>
  );
}
