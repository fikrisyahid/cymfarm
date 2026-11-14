"use client";

import React, { useState, useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { localDb } from "@/lib/offline-db";
import { AppShell } from "@/components/AppShell";
import { LineChart, BarChart3, TrendingUp, Calendar, Utensils, Scissors, Layers, CheckCircle } from "lucide-react";

export default function AnalisaPage() {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("ALL");
  const [rangeMode, setRangeMode] = useState<"7D" | "30D">("7D");

  const modules = useLiveQuery(
    async () => {
      const all = await localDb.farmModules.toArray();
      return all.filter((m) => !m.deletedAt);
    },
    [],
    []
  );

  const logs = useLiveQuery(() => localDb.activityLogs.toArray(), [], []);

  // Hitung rentang tanggal (7 hari atau 30 hari ke belakang)
  const dateList = useMemo(() => {
    const list: string[] = [];
    const count = rangeMode === "7D" ? 7 : 30;
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      list.push(d.toISOString().split("T")[0]);
    }
    return list;
  }, [rangeMode]);

  // Agregasi Data per Tanggal
  const chartData = useMemo(() => {
    if (!logs) return [];

    return dateList.map((dateStr) => {
      const dateLogs = logs.filter((l) => {
        const logDate = l.targetDate || (l.performedAt ? l.performedAt.split("T")[0] : "");
        const matchDate = logDate === dateStr;
        const matchModule = selectedModuleId === "ALL" || l.moduleId === selectedModuleId;
        return matchDate && matchModule;
      });

      const routineCount = dateLogs.filter((l) => l.activityType === "ROUTINE").length;
      const harvestQty = dateLogs
        .filter((l) => l.activityType === "HARVEST")
        .reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

      const d = new Date(dateStr);
      const dayLabel = d.toLocaleDateString("id-ID", { weekday: "short" });
      const dateNum = d.getDate();

      return {
        dateStr,
        dayLabel: rangeMode === "7D" ? `${dayLabel} ${dateNum}` : `${dateNum}`,
        routineCount,
        harvestQty,
      };
    });
  }, [dateList, logs, selectedModuleId, rangeMode]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const totalHarvest = chartData.reduce((sum, d) => sum + d.harvestQty, 0);
    const totalRoutines = chartData.reduce((sum, d) => sum + d.routineCount, 0);
    const daysWithRoutine = chartData.filter((d) => d.routineCount > 0).length;
    const avgRoutine = chartData.length > 0 ? (totalRoutines / chartData.length).toFixed(1) : "0";
    const maxHarvest = Math.max(...chartData.map((d) => d.harvestQty), 1);
    const maxRoutine = Math.max(...chartData.map((d) => d.routineCount), 1);

    return { totalHarvest, totalRoutines, daysWithRoutine, avgRoutine, maxHarvest, maxRoutine };
  }, [chartData]);

  return (
    <AppShell>
      <div className="w-full space-y-5 pb-20">
        {/* Header Analisa */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <LineChart className="h-5 w-5 text-emerald-700" />
            <h2 className="text-xl font-black text-slate-900">Analisa & Tren Lapangan</h2>
          </div>
          <p className="text-xs font-bold text-slate-500">
            Pantau intensitas perawatan pakan dan produktivitas hasil panen mingguan & bulanan.
          </p>

          {/* Filter Bar: Modul & Range */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            {/* Filter Modul Ternak */}
            <select
              value={selectedModuleId}
              onChange={(e) => setSelectedModuleId(e.target.value)}
              className="rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="ALL">Semua Komoditas</option>
              {(modules || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>

            {/* Toggle 7 Hari vs 30 Hari */}
            <div className="flex rounded-xl border-2 border-slate-300 bg-slate-100 p-0.5 text-xs font-black">
              <button
                onClick={() => setRangeMode("7D")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  rangeMode === "7D" ? "bg-white text-emerald-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                7 Hari
              </button>
              <button
                onClick={() => setRangeMode("30D")}
                className={`rounded-lg px-3 py-1.5 transition ${
                  rangeMode === "30D" ? "bg-white text-emerald-950 shadow-xs" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                30 Hari
              </button>
            </div>
          </div>
        </div>

        {/* 1. KARTU METRIK UTAMA (3 KARTU RESPONSIVE) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-3xl border-2 border-slate-300 bg-white p-4 shadow-xs text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-amber-700 uppercase">
              <Scissors className="h-4 w-4" />
              <span>Total Panen</span>
            </div>
            <div className="text-3xl font-black text-slate-900">{stats.totalHarvest}</div>
            <div className="text-[10px] font-bold text-slate-400">Dalam {rangeMode === "7D" ? "7" : "30"} hari terakhir</div>
          </div>

          <div className="rounded-3xl border-2 border-slate-300 bg-white p-4 shadow-xs text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-emerald-700 uppercase">
              <Utensils className="h-4 w-4" />
              <span>Rata-Rata Rawat</span>
            </div>
            <div className="text-3xl font-black text-slate-900">{stats.avgRoutine}x</div>
            <div className="text-[10px] font-bold text-slate-400">Frekuensi pakan per hari</div>
          </div>

          <div className="rounded-3xl border-2 border-slate-300 bg-white p-4 shadow-xs text-center space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-xs font-black text-blue-700 uppercase">
              <CheckCircle className="h-4 w-4" />
              <span>Hari Aktif</span>
            </div>
            <div className="text-3xl font-black text-slate-900">{stats.daysWithRoutine} <span className="text-base text-slate-400 font-bold">/ {chartData.length}</span></div>
            <div className="text-[10px] font-bold text-slate-400">Hari dengan perawatan tercatat</div>
          </div>
        </div>

        {/* 2. GRAFIK TREN PANEN (VERTICAL BAR DIALOG DI HP) */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              <h3 className="text-sm font-black text-slate-900">Grafik Produksi Panen</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Satuan hasil panen</span>
          </div>

          {/* Chart Viewport (Horizontal Scrollable pada mode 30 hari di HP) */}
          <div className="overflow-x-auto no-scrollbar pt-4 pb-2">
            <div className="flex items-end justify-between gap-2 min-w-full h-44 border-b-2 border-slate-200 px-2">
              {chartData.map((d) => {
                const heightPercent = stats.maxHarvest > 0 ? Math.round((d.harvestQty / stats.maxHarvest) * 100) : 0;
                return (
                  <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group min-w-[28px]">
                    <span className="text-[10px] font-black text-amber-900 opacity-0 group-hover:opacity-100 transition">
                      {d.harvestQty}
                    </span>
                    <div
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                      className={`w-full max-w-[24px] rounded-t-lg transition-all duration-300 ${
                        d.harvestQty > 0
                          ? "bg-amber-400 hover:bg-amber-500 shadow-2xs"
                          : "bg-slate-100"
                      }`}
                      title={`${d.dateStr}: ${d.harvestQty} hasil panen`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">
                      {d.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 3. GRAFIK KEDISIPLINAN PERAWATAN & PAKAN */}
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Utensils className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-black text-slate-900">Grafik Frekuensi Rawat / Pakan</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400">Berapa kali pakan per hari</span>
          </div>

          {/* Chart Viewport */}
          <div className="overflow-x-auto no-scrollbar pt-4 pb-2">
            <div className="flex items-end justify-between gap-2 min-w-full h-40 border-b-2 border-slate-200 px-2">
              {chartData.map((d) => {
                const heightPercent = stats.maxRoutine > 0 ? Math.round((d.routineCount / stats.maxRoutine) * 100) : 0;
                return (
                  <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group min-w-[28px]">
                    <span className="text-[10px] font-black text-emerald-900 opacity-0 group-hover:opacity-100 transition">
                      {d.routineCount}x
                    </span>
                    <div
                      style={{ height: `${Math.max(6, heightPercent)}%` }}
                      className={`w-full max-w-[24px] rounded-t-lg transition-all duration-300 ${
                        d.routineCount > 0
                          ? "bg-emerald-600 hover:bg-emerald-700 shadow-2xs"
                          : "bg-slate-100"
                      }`}
                      title={`${d.dateStr}: ${d.routineCount}x pakan`}
                    />
                    <span className="text-[10px] font-bold text-slate-500 truncate w-full text-center">
                      {d.dayLabel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
