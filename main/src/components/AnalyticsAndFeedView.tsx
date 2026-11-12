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

  const activeChickens = subjects.filter(
    (s) => s.moduleId === "mod-ayam-petelur" && s.isActive
  );

  const afkirChickens = activeChickens.filter((s) => s.isRecommendedForCut);

  const sortedPurchases = [...feedPurchases].sort(
    (a, b) =>
      new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime()
  );
  const latestPurchase = sortedPurchases[0];

  const estimatedTotalDaysForLatestSack = latestPurchase
    ? Math.round(
        (latestPurchase.weightKg / 25) *
          14 *
          (33 / Math.max(1, activeChickens.length))
      )
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
      feedName: `Pakan Ayam (${weightInput} KG)`,
      weightKg: weightInput,
      priceIdr: priceInput,
      purchasedAt: new Date().toISOString(),
      notes: notesInput,
    });
    setNotesInput("Beli karung baru untuk serep");
  };

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
      note: `${chicken.label} dipotong (stop bertelur ${chicken.consecutiveZeroYieldDays} hari). Kandang sekarang KOSONG.`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* LEFT COLUMN: REKOMENDASI POTONG AYAM */}
      <div className="space-y-6 rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm lg:col-span-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-rose-100 p-3 text-rose-800">
              <TrendingDown className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Ayam Siap Potong (Stop Bertelur)
              </h2>
              <p className="text-base font-bold text-slate-600">
                Daftar ayam yang sudah tidak bertelur &ge; 7 hari
              </p>
            </div>
          </div>
          <span className="rounded-2xl bg-rose-600 px-4 py-2 text-lg font-black text-white">
            {afkirChickens.length} Ekor
          </span>
        </div>

        {afkirChickens.length === 0 ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-6 text-center text-xl font-black text-emerald-950">
            🎉 Semua ayam ({activeChickens.length} ekor) masih rajin bertelur!
          </div>
        ) : (
          <div className="space-y-4">
            {afkirChickens.map((chk) => {
              const slot = containers.find((c) => c.id === chk.containerId);
              const parentSet = containers.find((c) => c.id === slot?.parentId);
              return (
                <div
                  key={chk.id}
                  className="flex flex-col justify-between gap-4 rounded-3xl border-4 border-rose-500 bg-rose-50 p-5 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl font-black text-slate-900">
                        {chk.label}
                      </span>
                      <span className="rounded-xl bg-white px-3 py-1 text-base font-black text-emerald-900 shadow-sm">
                        {slot?.name} ({parentSet?.name})
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-2 text-lg font-extrabold text-rose-900">
                      <AlertTriangle className="h-6 w-6 shrink-0 text-rose-700" />
                      Sudah <strong>{chk.consecutiveZeroYieldDays} hari</strong>{" "}
                      tidak bertelur
                    </p>
                  </div>

                  <button
                    onClick={() => handleCutChicken(chk)}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-rose-700 px-6 py-4 text-lg font-black text-white shadow hover:bg-rose-800 active:scale-95"
                  >
                    <Scissors className="h-6 w-6" /> POTONG AYAM INI
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* RIWAYAT AKTIVITAS HARI INI */}
        <div className="pt-4">
          <div className="mb-3 flex items-center gap-2 text-xl font-black text-slate-900">
            <History className="h-7 w-7 text-emerald-700" />
            <span>Catatan Kegiatan Kandang Terbaru</span>
          </div>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
            {activityLogs.length === 0 ? (
              <div className="rounded-2xl border-2 border-slate-300 bg-slate-50 p-5 text-lg font-bold text-slate-600">
                Belum ada kegiatan hari ini.
              </div>
            ) : (
              activityLogs.slice(0, 12).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900"
                >
                  <div>
                    <span className="font-black text-emerald-800">
                      [{log.activityType}]
                    </span>{" "}
                    <span>{log.note}</span>
                  </div>
                  <span className="ml-3 shrink-0 rounded-lg bg-white px-2.5 py-1 text-sm font-black text-slate-700">
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

      {/* RIGHT COLUMN: CATATAN BELI PAKAN AYAM (25KG) */}
      <div className="space-y-6 rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm lg:col-span-6">
        <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4">
          <div className="rounded-2xl bg-amber-100 p-3 text-amber-900">
            <ShoppingBag className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Catatan Beli Pakan Ayam (Karung 25 KG)
            </h2>
            <p className="text-base font-bold text-slate-600">
              Catat tanggal beli pakan & lihat perkiraan kapan habis
            </p>
          </div>
        </div>

        {/* PERKIRAAN HABIS PAKAN */}
        <div className="rounded-3xl border-4 border-amber-500 bg-amber-50 p-5">
          <div className="text-base font-black uppercase text-amber-900">
            📊 Perkiraan Pakan Habis ({latestPurchase?.weightKg || 25} KG)
          </div>
          <div className="mt-2 text-3xl font-black text-slate-900">
            Cukup untuk ~{estimatedRemainingDays} Hari Lagi (Sampai{" "}
            {estimatedDepletionDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
            })}
            )
          </div>
          <p className="mt-2 text-lg font-bold text-slate-800">
            Dihitung untuk <strong>{activeChickens.length} ekor ayam</strong> yang
            aktif saat ini.
          </p>
        </div>

        {/* FORM CATAT BELI PAKAN */}
        <form
          onSubmit={handleAddFeedPurchase}
          className="space-y-4 rounded-3xl border-2 border-slate-300 bg-slate-50 p-5"
        >
          <h3 className="text-xl font-black text-slate-900">
            + Catat Beli Pakan Baru
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-base font-extrabold text-slate-900">
                Berat Karung (KG)
              </label>
              <input
                type="number"
                required
                min={1}
                value={weightInput}
                onChange={(e) => setWeightInput(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border-2 border-slate-400 bg-white px-4 py-3.5 text-xl font-black text-slate-900"
              />
            </div>
            <div>
              <label className="block text-base font-extrabold text-slate-900">
                Harga Beli (Rp)
              </label>
              <input
                type="number"
                value={priceInput}
                onChange={(e) => setPriceInput(Number(e.target.value))}
                className="mt-1 w-full rounded-2xl border-2 border-slate-400 bg-white px-4 py-3.5 text-xl font-black text-slate-900"
              />
            </div>
          </div>
          <div>
            <label className="block text-base font-extrabold text-slate-900">
              Catatan
            </label>
            <input
              type="text"
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              className="mt-1 w-full rounded-2xl border-2 border-slate-400 bg-white px-4 py-3.5 text-lg font-bold text-slate-900"
            />
          </div>
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 py-5 text-xl font-black text-slate-950 shadow hover:bg-amber-400 active:scale-95"
          >
            <Plus className="h-7 w-7" /> SIMPAN CATATAN BELI PAKAN
          </button>
        </form>

        {/* DAFTAR RIWAYAT BELI PAKAN */}
        <div className="space-y-3">
          <div className="text-xl font-black text-slate-900">
            Riwayat Beli Pakan Sebelumnya
          </div>
          {sortedPurchases.map((fp) => (
            <div
              key={fp.id}
              className="flex items-center justify-between rounded-2xl border-2 border-slate-300 bg-slate-50 p-4"
            >
              <div>
                <div className="text-xl font-black text-slate-900">
                  {fp.feedName} ({fp.weightKg} KG)
                </div>
                <div className="text-base font-bold text-slate-700">
                  {fp.notes}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1.5 text-base font-black text-emerald-800">
                  <Calendar className="h-5 w-5" />
                  {new Date(fp.purchasedAt).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </div>
                {fp.priceIdr && (
                  <div className="text-base font-extrabold text-slate-700">
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
