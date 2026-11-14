"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureInitialCleanState, localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { Activity, FileText, Search, X } from "lucide-react";
import type { LocalActivityLog } from "@/lib/offline-db";

type FilterType = "ALL" | "ROUTINE" | "HARVEST" | "POPULATION_CHANGE" | "MAINTENANCE" | "UNDO";

export default function RiwayatPage() {
  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<FilterType>("ALL");

  useEffect(() => {
    ensureInitialCleanState().then(() => setReady(true));
  }, []);

  const logs = useLiveQuery(
    async () => {
      const all = await localDb.activityLogs.toArray();
      // Sort descending berdasarkan waktu dilakukan terbaru (ISO 8601 string sortable)
      return all.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
    },
    [],
    []
  );

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      // Filter category
      if (selectedFilter !== "ALL" && log.activityType !== selectedFilter) {
        return false;
      }
      // Filter search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const noteMatch = (log.note || "").toLowerCase().includes(query);
        const typeMatch = (log.activityType || "").toLowerCase().includes(query);
        const unitMatch = (log.unit || "").toLowerCase().includes(query);
        return noteMatch || typeMatch || unitMatch;
      }
      return true;
    });
  }, [logs, selectedFilter, searchQuery]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-900">
        <p className="text-sm font-black">Memuat Riwayat...</p>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-4 pb-20">
        {/* Header */}
        <div className="rounded-3xl border-2 border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
              Riwayat Aktivitas Lapangan
            </h2>
          </div>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">
            Catatan setiap aksi rawat, pakan, & panen yang dikerjakan keluarga di kandang.
          </p>

          {/* Search Box */}
          <div className="mt-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari aktivitas (contoh: lele, pakan, panen)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Hapus pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Quick Filter Pills (Scrollable horizontally without visible scrollbar bar) */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setSelectedFilter("ALL")}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 transition-colors ${
                selectedFilter === "ALL"
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              Semua ({logs?.length || 0})
            </button>
            <button
              onClick={() => setSelectedFilter("ROUTINE")}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 transition-colors ${
                selectedFilter === "ROUTINE"
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100"
              }`}
            >
              🍚 Rawat / Pakan
            </button>
            <button
              onClick={() => setSelectedFilter("HARVEST")}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 transition-colors ${
                selectedFilter === "HARVEST"
                  ? "bg-amber-600 text-white"
                  : "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-300 hover:bg-amber-100"
              }`}
            >
              🧺 Panen
            </button>
            <button
              onClick={() => setSelectedFilter("POPULATION_CHANGE")}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 transition-colors ${
                selectedFilter === "POPULATION_CHANGE"
                  ? "bg-blue-600 text-white"
                  : "bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 hover:bg-blue-100"
              }`}
            >
              📊 Populasi
            </button>
            <button
              onClick={() => setSelectedFilter("MAINTENANCE")}
              className={`px-3 py-1.5 rounded-full text-xs font-black shrink-0 transition-colors ${
                selectedFilter === "MAINTENANCE"
                  ? "bg-rose-600 text-white"
                  : "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-300 hover:bg-rose-100"
              }`}
            >
              ⚠️ Kendala
            </button>
          </div>
        </div>

        {/* Logs List */}
        {filteredLogs.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-700" />
            <h4 className="mt-3 text-base font-black text-slate-700 dark:text-slate-300">
              {logs?.length === 0 ? "Belum Ada Catatan Aktivitas" : "Tidak Ada Riwayat Yang Cocok"}
            </h4>
            <p className="mt-1 text-xs font-bold text-slate-400">
              {logs?.length === 0
                ? "Setiap kali tombol rawat atau panen ditekan di lapangan, catatannya akan muncul di sini."
                : "Coba ubah kata kunci pencarian atau ganti filter kategori."}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredLogs.map((log) => {
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
              const isMaintenance = log.activityType === "MAINTENANCE";
              const isPopulation = log.activityType === "POPULATION_CHANGE";
              const isUndo = (log.activityType as any) === "UNDO";

              return (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                          isRoutine
                            ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                            : isHarvest
                            ? "bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-300"
                            : isPopulation
                            ? "bg-blue-100 text-blue-950 dark:bg-blue-950/60 dark:text-blue-300"
                            : isMaintenance
                            ? "bg-rose-100 text-rose-950 dark:bg-rose-950/60 dark:text-rose-300"
                            : isUndo
                            ? "bg-purple-100 text-purple-950 dark:bg-purple-950/60 dark:text-purple-300"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {isRoutine
                          ? "Rawat"
                          : isHarvest
                          ? "Panen"
                          : isPopulation
                          ? "Populasi"
                          : isMaintenance
                          ? "Kendala"
                          : isUndo
                          ? "Batal (Undo)"
                          : log.activityType}
                      </span>
                      <span className="text-xs font-bold text-slate-400">
                        {dateStr} • {timeStr}
                      </span>
                      {log.targetDate && log.targetDate !== log.performedAt.split("T")[0] && (
                        <span className="rounded bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 text-[10px] font-black text-amber-900 dark:text-amber-300">
                          Target: {log.targetDate}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1">
                      {log.note || "Aktivitas lapangan"}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {(isHarvest || isPopulation) && log.quantity !== undefined && (
                      <div className="text-right">
                        <div
                          className={`text-base font-black ${
                            isHarvest
                              ? "text-amber-900 dark:text-amber-400"
                              : Number(log.quantity) > 0
                              ? "text-blue-900 dark:text-blue-400"
                              : "text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {Number(log.quantity) > 0 ? `+${log.quantity}` : log.quantity}
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 uppercase">
                          {log.unit || "Ekor / Unit"}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
