"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialCleanState, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { Activity, Calendar, FileText } from "lucide-react";

export default function AnalisaPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureInitialCleanState().then(() => setReady(true));
  }, []);

  const logs = useLiveQuery(
    () => localDb.activityLogs.reverse().toArray(),
    [],
    []
  );

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-sm font-black">Memuat Riwayat...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-lg space-y-4 pb-20">
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-700" />
            <h2 className="text-xl font-black text-slate-900">
              Riwayat Aktivitas Lapangan
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Catatan setiap aksi rawat & panen yang dikerjakan keluarga di kandang.
          </p>
        </div>

        {(!logs || logs.length === 0) ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <h4 className="mt-3 text-base font-black text-slate-700">
              Belum Ada Catatan Aktivitas
            </h4>
            <p className="mt-1 text-xs font-bold text-slate-400">
              Setiap kali tombol rawat atau panen ditekan di lapangan, catatannya akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => {
              const dateObj = new Date(log.performedAt);
              const timeStr = dateObj.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const dateStr = dateObj.toLocaleDateString("id-ID", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });

              const isRoutine = log.activityType === "ROUTINE";
              const isHarvest = log.activityType === "HARVEST";

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isRoutine
                            ? "bg-emerald-100 text-emerald-900"
                            : isHarvest
                            ? "bg-amber-100 text-amber-950"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {log.activityType}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {dateStr} • {timeStr}
                      </span>
                    </div>
                    <div className="text-sm font-black text-slate-900 mt-1">
                      {log.note || "Aktivitas lapangan"}
                    </div>
                  </div>

                  {isHarvest && log.quantity && (
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-amber-900">
                        +{log.quantity}
                      </div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase">
                        {log.unit || "Unit"}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
