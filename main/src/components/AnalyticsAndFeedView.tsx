"use client";

import React, { useState } from "react";
import {
  Scissors,
  AlertTriangle,
  Calendar,
  TrendingDown,
  ShoppingBag,
  History,
  Plus,
  X,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import {
  localDb,
  type LocalActivityLog,
  type LocalContainer,
  type LocalFeedPurchase,
  type LocalSubject,
} from "@/lib/offline-db";
import { toast } from "sonner";

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
  // Modal State: "AFKIR" | "FEED_FORM" | "FEED_HISTORY" | "ACTIVITY_LOGS" | null
  const [activeModal, setActiveModal] = useState<
    "AFKIR" | "FEED_FORM" | "FEED_HISTORY" | "ACTIVITY_LOGS" | null
  >(null);

  const [weightInput, setWeightInput] = useState<number>(25);
  const [priceInput, setPriceInput] = useState<number>(215000);
  const [notesInput, setNotesInput] = useState<string>("Beli 1 karung 25kg");

  // 1. Data Ayam Aktif & Afkir
  const activeChickens = subjects.filter(
    (s) => s.moduleId === "mod-ayam-petelur" && s.isActive
  );
  const afkirChickens = activeChickens.filter((s) => s.isRecommendedForCut);

  // 2. Data Prediksi Pakan
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

  // Simpan Beli Pakan
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
    toast.success(`Catatan beli pakan ${weightInput} KG berhasil disimpan!`);
    setActiveModal(null);
  };

  // Potong Ayam Afkir
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
      note: `${chicken.label} dipotong (stop bertelur ${chicken.consecutiveZeroYieldDays} hari).`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
    toast.success(`${chicken.label} selesai dipotong! Kandang sekarang kosong.`);
  };

  return (
    <div className="mx-auto max-w-lg space-y-4">
      {/* ===================================================================
          KARTU RINGKASAN 1: AYAM AFKIR / REKOMENDASI POTONG
         =================================================================== */}
      <div
        className={`rounded-3xl border-3 p-5 shadow-sm transition ${
          afkirChickens.length > 0
            ? "border-rose-400 bg-rose-50/60"
            : "border-slate-300 bg-white"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-2xl p-3 ${
                afkirChickens.length > 0
                  ? "bg-rose-200 text-rose-900"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              <TrendingDown className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                PRODUKTIVITAS AYAM
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                {afkirChickens.length > 0
                  ? `${afkirChickens.length} Ayam Siap Potong`
                  : "Semua Ayam Produktif"}
              </h3>
            </div>
          </div>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-600">
          {afkirChickens.length > 0
            ? "Ada ayam yang sudah tidak bertelur ≥ 7 hari berturut-turut."
            : `Seluruh ${activeChickens.length} ekor ayam masih aktif bertelur normal.`}
        </p>

        {afkirChickens.length > 0 && (
          <button
            onClick={() => setActiveModal("AFKIR")}
            className="mt-4 flex w-full items-center justify-between rounded-2xl bg-rose-700 px-5 py-3.5 text-base font-black text-white shadow-sm hover:bg-rose-800 active:scale-98"
          >
            <div className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              <span>Lihat & Potong Ayam</span>
            </div>
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ===================================================================
          KARTU RINGKASAN 2: STOK & PREDIKSI PAKAN
         =================================================================== */}
      <div className="rounded-3xl border-3 border-amber-300 bg-amber-50/50 p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-200 p-3 text-amber-950">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-900">
                PREDIKSI PAKAN (25 KG)
              </div>
              <h3 className="text-2xl font-black text-slate-900">
                ~{estimatedRemainingDays} Hari Lagi
              </h3>
            </div>
          </div>
        </div>

        <p className="mt-2 text-sm font-bold text-slate-700">
          Perkiraan habis tgl{" "}
          <strong className="text-slate-900">
            {estimatedDepletionDate.toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </strong>{" "}
          (untuk {activeChickens.length} ayam aktif).
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setActiveModal("FEED_FORM")}
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 py-3.5 text-sm font-black text-slate-950 shadow-sm hover:bg-amber-400 active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Catat Beli Pakan</span>
          </button>

          <button
            onClick={() => setActiveModal("FEED_HISTORY")}
            className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-300 bg-white py-3.5 text-sm font-black text-slate-800 hover:bg-slate-100 active:scale-98"
          >
            <Calendar className="h-4 w-4 text-emerald-700" />
            <span>Riwayat Beli</span>
          </button>
        </div>
      </div>

      {/* ===================================================================
          KARTU RINGKASAN 3: LOG KEGIATAN HARI INI
         =================================================================== */}
      <div className="rounded-3xl border-3 border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-100 p-3 text-slate-800">
              <History className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                CATATAN AKTIVITAS
              </div>
              <h3 className="text-xl font-black text-slate-900">
                {activityLogs.length} Kegiatan Tercatat
              </h3>
            </div>
          </div>

          <button
            onClick={() => setActiveModal("ACTIVITY_LOGS")}
            className="rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-800 hover:bg-slate-100 active:scale-95"
          >
            Lihat
          </button>
        </div>
      </div>

      {/* ===================================================================
          MODAL 1: DAFTAR AYAM AFKIR (POP-UP / DRAWER)
         =================================================================== */}
      {activeModal === "AFKIR" && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Ayam Rekomendasi Potong
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Sudah tidak bertelur ≥ 7 hari
                </p>
              </div>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {afkirChickens.map((chk) => {
                const slot = containers.find((c) => c.id === chk.containerId);
                const parentSet = containers.find(
                  (c) => c.id === slot?.parentId
                );
                return (
                  <div
                    key={chk.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-slate-900">
                          {chk.label}
                        </span>
                        <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black text-emerald-800">
                          {slot?.name} ({parentSet?.name})
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-rose-800">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{chk.consecutiveZeroYieldDays} hari 0 telur</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCutChicken(chk)}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-black text-white active:scale-95"
                    >
                      <Scissors className="h-4 w-4" /> Potong
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: FORM CATAT BELI PAKAN BARU
         =================================================================== */}
      {activeModal === "FEED_FORM" && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleAddFeedPurchase}
            className="w-full max-w-md rounded-3xl border-3 border-amber-400 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-xl font-black text-slate-900">
                + Catat Beli Pakan
              </h3>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-black text-slate-800">
                  Berat Karung (KG)
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={weightInput}
                  onChange={(e) => setWeightInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-lg font-black text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-800">
                  Harga Beli (Rp - Opsional)
                </label>
                <input
                  type="number"
                  value={priceInput}
                  onChange={(e) => setPriceInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-sm font-black text-slate-800">
                  Catatan
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Misal: Stok karung baru"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-base font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3.5 text-base font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3.5 text-base font-black text-slate-950 active:scale-95"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: RIWAYAT PEMBELIAN PAKAN
         =================================================================== */}
      {activeModal === "FEED_HISTORY" && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-xl font-black text-slate-900">
                Riwayat Beli Pakan
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-2.5 overflow-y-auto pr-1">
              {sortedPurchases.map((fp) => (
                <div
                  key={fp.id}
                  className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5"
                >
                  <div>
                    <div className="text-base font-black text-slate-900">
                      {fp.feedName} ({fp.weightKg} KG)
                    </div>
                    <div className="text-xs font-bold text-slate-500">
                      {fp.notes || "-"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-emerald-800">
                      {new Date(fp.purchasedAt).toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                    {fp.priceIdr && (
                      <div className="text-xs font-bold text-slate-500">
                        Rp {fp.priceIdr.toLocaleString("id-ID")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 4: CATATAN LOG KEGIATAN
         =================================================================== */}
      {activeModal === "ACTIVITY_LOGS" && (
        <div
          onClick={() => setActiveModal(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-2 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-2xl max-h-[85vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-xl font-black text-slate-900">
                Log Aktivitas Lapangan
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {activityLogs.length === 0 ? (
                <div className="p-4 text-center text-sm font-bold text-slate-400">
                  Belum ada log kegiatan hari ini.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-800"
                  >
                    <div>
                      <span className="font-black text-emerald-700">
                        [{log.activityType}]
                      </span>{" "}
                      <span>{log.note}</span>
                    </div>
                    <span className="ml-2 shrink-0 font-mono text-[11px] text-slate-400">
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
      )}
    </div>
  );
}
