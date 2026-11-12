"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { AnalyticsAndFeedView } from "@/components/AnalyticsAndFeedView";

export default function AnalisaPage() {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
  }, []);

  const containers = useLiveQuery(
    () => localDb.containers.orderBy("sortOrder").toArray(),
    [],
    []
  );
  const subjects = useLiveQuery(() => localDb.subjects.toArray(), [], []);
  const feedPurchases = useLiveQuery(
    () => localDb.feedPurchases.toArray(),
    [],
    []
  );
  const activityLogs = useLiveQuery(
    () => localDb.activityLogs.reverse().toArray(),
    [],
    []
  );

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-lg font-black">Memuat Analisa...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="p-4">
        <AnalyticsAndFeedView
          containers={containers}
          subjects={subjects}
          feedPurchases={feedPurchases}
          activityLogs={activityLogs}
        />
      </div>
    </AppShell>
  );
}
