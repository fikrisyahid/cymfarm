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
  Timer,
  CheckCircle2,
} from "lucide-react";
import {
  localDb,
  type LocalActivityLog,
  type LocalContainer,
  type LocalFeedPurchase,
  type LocalFarmModule,
  type LocalSubject,
} from "@/lib/offline-db";
import { toast } from "sonner";

interface AnalyticsAndFeedViewProps {
  modules?: LocalFarmModule[];
  containers: LocalContainer[];
  subjects: LocalSubject[];
  feedPurchases: LocalFeedPurchase[];
  activityLogs: LocalActivityLog[];
}

export function AnalyticsAndFeedView({
  modules = [],
  containers,
  subjects,
  feedPurchases,
  activityLogs,
}: AnalyticsAndFeedViewProps) {
  // Modal State: "AUTO_RULE_<modId>" | "TIMER_<modId>" | "FEED_FORM" | "FEED_HISTORY" | "ACTIVITY_LOGS" | null
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Form State untuk Tambah / Edit Pakan
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [weightInput, setWeightInput] = useState<number>(25);
  const [priceInput, setPriceInput] = useState<number>(215000);
  const [feedNameInput, setFeedNameInput] = useState<string>("Pakan Ayam");
  const [notesInput, setNotesInput] = useState<string>("Beli 1 karung 25kg");
  const [purchasedDateInput, setPurchasedDateInput] = useState<string>(() => new Date().toISOString().split("T")[0]);

  // Prediksi Pakan Karungan (Logistik)
  const activeChickens = subjects.filter(
    (s) => s.moduleId === "mod-ayam-petelur" && s.isActive
  );
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

  // Buka Form Edit Pakan dari Riwayat
  const handleOpenEditFeed = (fp: LocalFeedPurchase) => {
    setEditingFeedId(fp.id);
    setFeedNameInput(fp.feedName);
    setWeightInput(fp.weightKg);
    setPriceInput(fp.priceIdr || 0);
    setNotesInput(fp.notes || "");
    setPurchasedDateInput(fp.purchasedAt ? fp.purchasedAt.split("T")[0] : new Date().toISOString().split("T")[0]);
    setActiveModal("FEED_FORM");
  };

  // Simpan Beli Pakan (Tambah Baru atau Update Edit)
  const handleSaveFeedPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    const purchasedAtIso = new Date(`${purchasedDateInput}T08:00:00`).toISOString();

    if (editingFeedId) {
      await localDb.feedPurchases.update(editingFeedId, {
        feedName: feedNameInput,
        weightKg: weightInput,
        priceIdr: priceInput,
        purchasedAt: purchasedAtIso,
        notes: notesInput,
      });
      toast.success(`Riwayat pakan berhasil diperbarui!`);
    } else {
      await localDb.feedPurchases.put({
        id: `feed-${Date.now()}`,
        feedName: feedNameInput || `Pakan (${weightInput} KG)`,
        weightKg: weightInput,
        priceIdr: priceInput,
        purchasedAt: purchasedAtIso,
        notes: notesInput,
      });
      toast.success(`Catatan beli ${weightInput} KG berhasil disimpan!`);
    }
    setEditingFeedId(null);
    setActiveModal(null);
  };

  // Eksekusi Terminasi / Potong / Panen Akhir Subjek
  const handleTerminateSubject = async (
    subject: LocalSubject,
    actionLabel: string = "Diproses"
  ) => {
    await localDb.subjects.update(subject.id, {
      isActive: false,
    });

    const isSlot = containers.find(
      (c) => c.id === subject.containerId && c.containerType === "CAGE_SLOT"
    );
    if (isSlot) {
      await localDb.containers.update(subject.containerId, {
        status: "VACANT",
      });
    }

    await localDb.activityLogs.put({
      id: `log-term-${Date.now()}`,
      moduleId: subject.moduleId,
      containerId: subject.containerId,
      subjectId: subject.id,
      activityType: "AFKIR_CUT",
      quantity: subject.populationCount,
      note: `${subject.label} ${actionLabel}.`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
    toast.success(`${subject.label} berhasil ${actionLabel}!`);
  };

  return (
    <div className="w-full space-y-4">
      {/* ===================================================================
          1. DYNAMIC EVALUATION CARDS (Di-generate otomatis dari AUTO_RULE tiap modul!)
         =================================================================== */}
      {modules.map((mod) => {
        // Cek apakah modul ini punya blok AUTO_RULE
        const autoRuleNode = mod.flowGraph.nodes.find(
          (n) => n.data.blockType === "AUTO_RULE"
        );
        if (!autoRuleNode) return null;

        const thresholdDays =
          autoRuleNode.data.config?.zeroYieldThresholdDays || 7;

        // Cari subjek-subjek aktif di modul ini yang melewati threshold
        const modSubjects = subjects.filter(
          (s) => s.moduleId === mod.id && s.isActive
        );
        const flaggedSubjects = modSubjects.filter(
          (s) => s.consecutiveZeroYieldDays >= thresholdDays || s.isRecommendedForCut
        );

        const hasFlags = flaggedSubjects.length > 0;
        const modalKey = `AUTO_RULE_${mod.id}`;

        return (
          <div
            key={mod.id}
            className={`rounded-3xl border-3 p-5 shadow-sm transition ${
              hasFlags ? "border-rose-400 bg-rose-50/60" : "border-slate-300 bg-white"
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`rounded-2xl p-3 ${
                    hasFlags ? "bg-rose-200 text-rose-900" : "bg-slate-100 text-slate-700"
                  }`}
                >
                  <TrendingDown className="h-7 w-7" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                    ANALISA MODUL: {mod.name}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">
                    {hasFlags
                      ? `${flaggedSubjects.length} Perlu Tindakan (${autoRuleNode.data.label})`
                      : "Semua Kondisi Normal"}
                  </h3>
                </div>
              </div>
            </div>

            <p className="mt-2 text-sm font-bold text-slate-600">
              {hasFlags
                ? `Rule Aktif: Nilai evaluasi mencapai batas ≥ ${thresholdDays} hari.`
                : `Total ${modSubjects.length} unit/subjek dalam status operasional baik.`}
            </p>

            {hasFlags && (
              <button
                onClick={() => setActiveModal(modalKey)}
                className="mt-4 flex w-full items-center justify-between rounded-2xl bg-rose-700 px-5 py-3.5 text-base font-black text-white shadow-sm hover:bg-rose-800 active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <Scissors className="h-5 w-5" />
                  <span>Lihat & Tindak Lanjut</span>
                </div>
                <ChevronRight className="h-5 w-5" />
              </button>
            )}

            {/* Modal Detail untuk Modul Ini */}
            {activeModal === modalKey && (
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
                        {mod.name} — Evaluasi
                      </h3>
                      <p className="text-xs font-bold text-slate-500">
                        {autoRuleNode.data.description || `Mencapai batas ${thresholdDays} hari`}
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
                    {flaggedSubjects.map((sub) => {
                      const container = containers.find((c) => c.id === sub.containerId);
                      return (
                        <div
                          key={sub.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-black text-slate-900">
                                {sub.label}
                              </span>
                              <span className="rounded-lg bg-white px-2 py-0.5 text-xs font-black text-emerald-800">
                                {container?.name || "Wadah"}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-rose-800">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{sub.consecutiveZeroYieldDays} hari evaluasi</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleTerminateSubject(sub, "Dieksekusi / Dipotong")}
                            className="flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-black text-white active:scale-95"
                          >
                            <Scissors className="h-4 w-4" /> Eksekusi
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ===================================================================
          2. DYNAMIC TIMER / QUARANTINE CARDS (Di-generate otomatis jika modul ada TIMER_QUARANTINE!)
         =================================================================== */}
      {modules.map((mod) => {
        const timerNode = mod.flowGraph.nodes.find(
          (n) => n.data.blockType === "TIMER_QUARANTINE"
        );
        if (!timerNode) return null;

        const timerSubjects = subjects.filter(
          (s) => s.moduleId === mod.id && s.isActive && s.timerEndsAt
        );
        if (timerSubjects.length === 0) return null;

        return (
          <div
            key={`timer-${mod.id}`}
            className="rounded-3xl border-3 border-orange-300 bg-orange-50/60 p-5 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-orange-200 p-3 text-orange-950">
                <Timer className="h-7 w-7" />
              </div>
              <div>
                <div className="text-xs font-black uppercase tracking-wider text-orange-900">
                  STATUS KARANTINA / TIMER: {mod.name}
                </div>
                <h3 className="text-2xl font-black text-slate-900">
                  {timerSubjects.length} Batch Sedang Berjalan
                </h3>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {timerSubjects.map((b) => {
                const nowMs = Date.now();
                const endMs = b.timerEndsAt ? new Date(b.timerEndsAt).getTime() : nowMs;
                const remHours = Math.max(0, Math.ceil((endMs - nowMs) / (1000 * 60 * 60)));
                const isReady = remHours === 0;

                return (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-2xl bg-white p-3 border border-orange-200"
                  >
                    <div>
                      <div className="font-black text-slate-900 text-sm">{b.label}</div>
                      <div className="text-xs font-bold text-slate-500">
                        {isReady ? "🟢 Timer Selesai" : `🔴 Sisa ~${remHours} Jam`}
                      </div>
                    </div>
                    <span className="rounded-xl bg-orange-100 px-3 py-1 text-xs font-black text-orange-900">
                      {b.populationCount} Ekor
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* ===================================================================
          3. KARTU STOK & PREDIKSI PAKAN / BAHAN
         =================================================================== */}
      <div className="rounded-3xl border-3 border-amber-300 bg-amber-50/50 p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-200 p-3 text-amber-950">
              <ShoppingBag className="h-7 w-7" />
            </div>
            <div>
              <div className="text-xs font-black uppercase tracking-wider text-amber-900">
                LOGISTIK & PAKAN TERAKHIR ({latestPurchase?.weightKg || 25} KG)
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
            onClick={() => {
              setEditingFeedId(null);
              setFeedNameInput("Pakan Ayam");
              setWeightInput(25);
              setPriceInput(215000);
              setNotesInput("Beli 1 karung 25kg");
              setPurchasedDateInput(new Date().toISOString().split("T")[0]);
              setActiveModal("FEED_FORM");
            }}
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
          4. KARTU CATATAN AKTIVITAS LOG
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

      {/* MODAL: FORM BELI PAKAN (TAMBAH / EDIT) */}
      {activeModal === "FEED_FORM" && (
        <div
          onClick={() => {
            setEditingFeedId(null);
            setActiveModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveFeedPurchase}
            className="w-full max-w-md rounded-3xl border-3 border-amber-400 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-xl font-black text-slate-900">
                {editingFeedId ? "✏️ Edit Riwayat Pakan" : "+ Catat Beli Bahan / Pakan"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditingFeedId(null);
                  setActiveModal(null);
                }}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  Nama Pakan / Bahan
                </label>
                <input
                  type="text"
                  required
                  value={feedNameInput}
                  onChange={(e) => setFeedNameInput(e.target.value)}
                  placeholder="Misal: Pakan Ayam Petelur"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Berat / Vol (KG)
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={weightInput}
                    onChange={(e) => setWeightInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-black text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Harga Beli (Rp)
                  </label>
                  <input
                    type="number"
                    value={priceInput}
                    onChange={(e) => setPriceInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800">
                  Tanggal Beli
                </label>
                <input
                  type="date"
                  required
                  value={purchasedDateInput}
                  onChange={(e) => setPurchasedDateInput(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800">
                  Catatan
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Misal: Pakan karung baru"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingFeedId(null);
                  setActiveModal(null);
                }}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-base font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-base font-black text-slate-950 active:scale-95"
              >
                {editingFeedId ? "Simpan Perubahan" : "Simpan Baru"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: RIWAYAT PEMBELIAN */}
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
                Riwayat Beli Bahan & Pakan
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
                  className="flex items-center justify-between rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-black text-slate-900 truncate">
                      {fp.feedName} ({fp.weightKg} KG)
                    </div>
                    <div className="text-xs font-bold text-slate-500 truncate">
                      {fp.notes || "-"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-800">
                        {new Date(fp.purchasedAt).toLocaleDateString("id-ID", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      {fp.priceIdr ? (
                        <div className="text-xs font-bold text-slate-500">
                          Rp {fp.priceIdr.toLocaleString("id-ID")}
                        </div>
                      ) : null}
                    </div>

                    <button
                      onClick={() => handleOpenEditFeed(fp)}
                      className="rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-50 active:scale-95 shadow-xs"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CATATAN LOG AKTIVITAS */}
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
