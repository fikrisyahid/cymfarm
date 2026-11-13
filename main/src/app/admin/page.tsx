"use client";

import React, { useEffect, useState } from "react";
import { ensureInitialCleanState } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { AdminModularStudio } from "@/components/AdminModularStudio";

export default function AdminPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureInitialCleanState().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-sm font-black">Memuat Studio Admin...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <AdminModularStudio />
    </AppShell>
  );
}
