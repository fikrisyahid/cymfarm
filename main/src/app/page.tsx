"use client";

import React, { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  QrCode,
  Workflow,
  BarChart3,
  Wifi,
  WifiOff,
  RotateCcw,
  Egg,
  Fish,
  Layers,
} from "lucide-react";
import { ensureInitialFarmSeed, localDb } from "@/lib/offline-db";
import { WorkerQrView } from "@/components/WorkerQrView";
import { StudioFlowBuilder } from "@/components/StudioFlowBuilder";
import { AnalyticsAndFeedView } from "@/components/AnalyticsAndFeedView";

type ActiveTab = "WORKER_QR" | "STUDIO_BUILDER" | "ANALYTICS_FEED";

export default function CymFarmHomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("WORKER_QR");
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [seeded, setSeeded] = useState<boolean>(false);

  useEffect(() => {
    ensureInitialFarmSeed().then(() => setSeeded(true));
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const modules = useLiveQuery(() => localDb.farmModules.toArray(), [], []);
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

  // Quick summary metrics
  const activeChickens = subjects.filter(
    (s) => s.moduleId === "mod-ayam-petelur" && s.isActive
  );
  const eggsTodayCount = activeChickens.filter(
    (s) => s.eggHarvestedToday
  ).length;
  const afkirCount = activeChickens.filter((s) => s.isRecommendedForCut).length;
  const totalLele = subjects
    .filter((s) => s.moduleId === "mod-lele-konsumsi" && s.isActive)
    .reduce((acc, cur) => acc + cur.populationCount, 0);

  const handleResetDemoData = async () => {
    await localDb.delete();
    await localDb.open();
    await ensureInitialFarmSeed();
  };

  if (!seeded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="mt-3 text-sm font-semibold">
            Menyiapkan Database Offline-First CymFarm...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 font-black text-slate-950 shadow-lg shadow-emerald-500/20">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-white">
                  CymFarm
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  PWA Offline-First
                </span>
              </div>
              <p className="text-xs text-slate-400">
                3 Kolam Lele • 6 Set Kandang • 36 Slot Ayam • Modular Builder
              </p>
            </div>
          </div>

          {/* Right Status & Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold ${
                isOnline
                  ? "border-emerald-500/30 bg-emerald-950/40 text-emerald-300"
                  : "border-amber-500/40 bg-amber-950/40 text-amber-300"
              }`}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5" /> Online (IndexedDB + Supabase
                  Ready)
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5" /> Mode Offline Aktif
                </>
              )}
            </div>

            <button
              onClick={handleResetDemoData}
              title="Reset ke Data Awal"
              className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset Simulasi
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 sm:px-6">
        {/* Top KPI Summary Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Ayam Aktif / Total Slot</span>
              <Egg className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {activeChickens.length}
              </span>
              <span className="text-xs text-slate-400">
                /{" "}
                {
                  containers.filter((c) => c.containerType === "CAGE_SLOT")
                    .length
                }{" "}
                Kandang
              </span>
            </div>
            <div className="mt-1 text-[11px] text-emerald-400">
              🥚 Panen Hari Ini: <strong>{eggsTodayCount} Telur</strong>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Rekomendasi Potong (Afkir)</span>
              <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                Auto-Rule
              </span>
            </div>
            <div className="mt-1.5 text-2xl font-black text-rose-400">
              {afkirCount} Ekor Ayam
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Stop bertelur &ge; 7 hari berturut-turut
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Populasi 3 Kolam Lele + Ember</span>
              <Fish className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-sky-400">
              {totalLele} Ekor
            </div>
            <div className="mt-1 text-[11px] text-orange-300">
              ⏳ 1 Batch di Ember Puasa (Timer 72 Jam)
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
              <span>Modul Peternakan / Tanaman</span>
              <Layers className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-1.5 text-2xl font-black text-white">
              {modules.length} Modul Aktif
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Dirakit dengan 7 Lego Block Primitives
            </div>
          </div>
        </div>

        {/* Navigation Tabs: Dual Mode (Lapangan QR vs Studio Flow Builder vs Analisa & Pakan) */}
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-900/90 p-2">
          <button
            onClick={() => setActiveTab("WORKER_QR")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition sm:text-sm ${
              activeTab === "WORKER_QR"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <QrCode className="h-4 w-4" />
            1. Mode Lapangan (Scan QR Kandang & Kolam)
          </button>

          <button
            onClick={() => setActiveTab("STUDIO_BUILDER")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition sm:text-sm ${
              activeTab === "STUDIO_BUILDER"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Workflow className="h-4 w-4" />
            2. Studio Mode (Drag & Drop 7 Lego Flow Builder)
          </button>

          <button
            onClick={() => setActiveTab("ANALYTICS_FEED")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition sm:text-sm ${
              activeTab === "ANALYTICS_FEED"
                ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                : "text-slate-300 hover:bg-slate-800"
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            3. Analisa Potong Ayam & Historis Pakan (25kg)
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "WORKER_QR" && (
          <WorkerQrView containers={containers} subjects={subjects} />
        )}

        {activeTab === "STUDIO_BUILDER" && (
          <StudioFlowBuilder modules={modules} />
        )}

        {activeTab === "ANALYTICS_FEED" && (
          <AnalyticsAndFeedView
            containers={containers}
            subjects={subjects}
            feedPurchases={feedPurchases}
            activityLogs={activityLogs}
          />
        )}
      </main>
    </div>
  );
}
