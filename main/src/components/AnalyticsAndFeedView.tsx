"use client";

import React, { useState } from "react";
import {
  ShoppingBag,
  Scissors,
  AlertTriangle,
  Calendar,
  TrendingDown,
  History,
  Plus,
} from "lucide-react";
import {
  localDb,
  type LocalActivityLog,
  type LocalContainer,
  type LocalFeedPurchase,
  type LocalSubject,
} from "@/lib/offline-db";

interface AnalyticsAndFeedViewProps {
  containers: LocalContainer[];
  subjects: LocalSubject[];
  feedPurchases: LocalFeedPurchase[];
  activityLogs: LocalActivityLog[];
}

export function AnalyticsAndFeedView({
  containers,
  subjects,
  feedPurchases,
  activityLogs,
}: AnalyticsAndFeedViewProps) {
  const [weightInput, setWeightInput] = useState<number>(25);
  const [priceInput, setPriceInput] = useState<number>(215000);
  const [notesInput, setNotesInput] = useState<string>(
    "Beli 1 karung 25kg (+ stok serep aman)"
  );

  // Active chickens count (Auto-excluding vacant & maintenance cages)
  const activeChickens = subjects.filter(
    (s) => s.moduleId === "mod-ayam-petelur" && s.isActive
  );

  // Chickens recommended for cutting (Afkir: stopped laying eggs >= 7 days)
  const afkirChickens = activeChickens.filter((s) => s.isRecommendedForCut);

  // Feed Depletion Estimation (Based on historical purchase interval + active chickens)
  // Average daily feed per laying hen ~ 110g (0.11 kg/day).
  // For 33 active chickens, 25kg lasts ~ 6.8 - 14 days depending on portioning.
  // We combine historical interval (~14 days per 25kg sack in this farm) scaled by active chicken count.
  const sortedPurchases = [...feedPurchases].sort(
    (a, b) =>
      new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
  );
  const latestPurchase = sortedPurchases[0];

  const estimatedDaysPerKg =
    activeChickens.length > 0 ? 14 / Math.max(1, activeChickens.length) : 0.5;
  const estimatedTotalDaysForLatestSack = latestPurchase
    ? Math.round((latestPurchase.weightKg / 25) * 14 * (33 / Math.max(1, activeChickens.length)))
    : 14;

  const daysSinceLatestPurchase = latestPurchase
    ? Math.floor(
        (Date.now() - new Date(latestPurchase.purchasedAt).getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : 0;

  const estimatedRemainingDays = Math.max(
    0,
    estimatedTotalDaysForLatestSack - daysSinceLatestPurchase
  );

  const estimatedDepletionDate = latestPurchase
    ? new Date(
        new Date(latestPurchase.purchasedAt).getTime() +
          estimatedTotalDaysForLatestSack * 24 * 60 * 60 * 1000
      )
    : new Date();

  const handleAddFeedPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    await localDb.feedPurchases.put({
      id: `feed-${Date.now()}`,
      feedName: `Pakan Ayam Petelur (${weightInput} KG)`,
      weightKg: weightInput,
      priceIdr: priceInput,
      purchasedAt: new Date().toISOString(),
      notes: notesInput,
    });
    setNotesInput("Beli karung baru untuk serep");
  };

  // Cut / Afkir a chicken that stopped laying eggs -> automatically frees its Cage Slot to VACANT!
  const handleCutChicken = async (chicken: LocalSubject) => {
    await localDb.subjects.update(chicken.id, {
      isActive: false,
    });
    await localDb.containers.update(chicken.containerId, {
      status: "VACANT",
    });
    await localDb.activityLogs.put({
      id: `log-cut-${Date.now()}`,
      moduleId: chicken.moduleId,
      containerId: chicken.containerId,
      subjectId: chicken.id,
      activityType: "AFKIR_CUT",
      quantity: 1,
      note: `${chicken.label} dipotong (afkir karena stop bertelur ${chicken.consecutiveZeroYieldDays} hari). Kandang sekarang KOSONG.`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* LEFT COLUMN: REKOMENDASI POTONG AYAM (AFKIR / STOP BERTELUR) */}
      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-rose-500/20 p-2.5 text-rose-400">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Analisa Ayam Afkir (Rekomendasi Potong)
              </h2>
              <p className="text-xs text-slate-400">
                Otomatis mendeteksi ayam yang sudah tidak bertelur &ge; 7 hari
                berturut-turut.
              </p>
            </div>
          </div>
          <span className="rounded-xl bg-rose-500/20 px-3 py-1 text-xs font-black text-rose-300">
            {afkirChickens.length} Ayam Siap Potong
          </span>
        </div>

        {afkirChickens.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center text-xs text-slate-400">
            🎉 Semua ayam aktif ({activeChickens.length} ekor) masih produktif
            bertelur! Belum ada rekomendasi potong.
          </div>
        ) : (
          <div className="space-y-3">
            {afkirChickens.map((chk) => {
              const slot = containers.find((c) => c.id === chk.containerId);
              const parentSet = containers.find((c) => c.id === slot?.parentId);
              return (
                <div
                  key={chk.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/40 bg-rose-950/20 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-black text-white">
                        {chk.label}
                      </span>
                      <span className="rounded-lg bg-slate-800 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                        {slot?.name} ({parentSet?.name})
                      </span>
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                      <AlertTriangle className="h-3.5 w-3.5" /> Sudah{" "}
                      <strong>{chk.consecutiveZeroYieldDays} hari</strong> tidak
                      ada log telur di kandang ini.
                    </p>
                  </div>

                  <button
                    onClick={() => handleCutChicken(chk)}
                    className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-xs font-black text-slate-950 hover:bg-rose-400"
                  >
                    <Scissors className="h-4 w-4" /> Potong Ayam & Kosongkan
                    Kandang
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Farm Activity Logs (Immutable History) */}
        <div className="pt-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            <History className="h-4 w-4" /> Log Aktivitas Lapangan Terbaru
            (Offline-First Queue)
          </div>
          <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-500">
                Belum ada log hari ini. Coba klik kasih makan atau panen telur di
                tab Mode Lapangan (Scan QR).
              </div>
            ) : (
              activityLogs.slice(0, 12).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950 px-3.5 py-2.5 text-xs"
                >
                  <div>
                    <span className="font-bold text-emerald-400">
                      [{log.activityType}]
                    </span>{" "}
                    <span className="text-slate-200">{log.note}</span>
                  </div>
                  <span className="ml-2 shrink-0 font-mono text-[10px] text-slate-500">
                    {new Date(log.performedAt).toLocaleTimeString("id-ID", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: LOG HISTORIS BELI PAKAN (25KG) & ESTIMASI HABIS */}
      <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-6">
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
          <div className="rounded-xl bg-amber-500/20 p-2.5 text-amber-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">
              Historis Beli Pakan Ayam & Estimasi Habis
            </h2>
            <p className="text-xs text-slate-400">
              Simpel tanpa ribet nimbang harian & tidak pernah memblokir tombol
              kasih makan tukang!
            </p>
          </div>
        </div>

        {/* Smart Forecast Banner */}
        <div className="rounded-2xl border border-amber-500/40 bg-amber-950/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                📊 Prediksi Habis Karung Saat Ini ({latestPurchase?.weightKg || 25}{" "}
                KG)
              </div>
              <div className="mt-1 text-xl font-black text-white">
                Estimasi Habis: ~{estimatedRemainingDays} Hari Lagi (
                {estimatedDepletionDate.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                })}
                )
              </div>
            </div>
            <div className="rounded-xl bg-black/40 px-3.5 py-2 text-right">
              <div className="text-[11px] text-slate-400">
                Basis Ayam Aktif Saat Ini
              </div>
              <div className="text-sm font-black text-emerald-400">
                {activeChickens.length} Ekor (Kandang Kosong Di-skip)
              </div>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-300">
            💡 Dihitung otomatis dari riwayat tanggal beli karung sebelumnya dan
            jumlah ayam yang aktif makan ({activeChickens.length} ekor). Kalau
            karung serep sudah dipakai, tinggal catat tanggal beli karung baru di
            bawah.
          </p>
        </div>

        {/* Form: Catat Beli Pakan Baru */}
        <form
          onSubmit={handleAddFeedPurchase}
          className="rounded-2xl border border-slate-800 bg-slate-950 p-4"
        >
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            + Catat Beli Karung Pakan Baru
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-[11px] text-slate-400">
                Berat / Volume (KG)
              </label>
              <input
                type="number"
                required
                min={1}
                value={weightInput}
                onChange={(e) => setWeightInput(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400">
                Harga Beli (Rp - Opsional)
              </label>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-bold text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400">
                Catatan Singkat
              </label>
              <input
                type="text"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-amber-400 py-2.5 text-xs font-black text-slate-950 hover:bg-amber-300"
          >
            <Plus className="h-4 w-4" /> Simpan Histori Beli Pakan
          </button>
        </form>

        {/* Historical Feed Purchases List */}
        <div className="space-y-2">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Riwayat Pembelian Pakan
          </div>
          {sortedPurchases.map((fp) => (
            <div
              key={fp.id}
              className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5"
            >
              <div>
                <div className="text-sm font-bold text-white">
                  {fp.feedName} ({fp.weightKg} KG)
                </div>
                <div className="text-xs text-slate-400">{fp.notes}</div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 text-xs font-bold text-amber-300">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date(fp.purchasedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                {fp.priceIdr && (
                  <div className="text-[11px] text-slate-400">
                    Rp {fp.priceIdr.toLocaleString("id-ID")}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
