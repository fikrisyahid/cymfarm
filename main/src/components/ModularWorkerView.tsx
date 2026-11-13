"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  localDb,
  type LocalContainer,
  type LocalSubject,
  type LocalFarmModule,
  getTodayDateStr,
} from "@/lib/offline-db";
import {
  ChevronLeft,
  ChevronRight,
  Utensils,
  Scissors,
  CheckCircle2,
  Wrench,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface ModularWorkerViewProps {
  containers: LocalContainer[];
  subjects: LocalSubject[];
  modules: LocalFarmModule[];
  selectedCode?: string;
  onSelectCode: (code: string) => void;
}

export function ModularWorkerView({
  containers = [],
  subjects = [],
  modules = [],
  selectedCode,
  onSelectCode,
}: ModularWorkerViewProps) {
  // Semua container yang terdaftar tetap ditampilkan (termasuk yang populasinya 0 atau berstatus kosong)
  const displayContainers = containers;

  const [harvestInput, setHarvestInput] = useState<number>(1);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Modal kelola populasi (tambah / kurang / set langsung)
  const [showPopulationModal, setShowPopulationModal] = useState(false);
  const [popChangeType, setPopChangeType] = useState<"ADD" | "SUBTRACT" | "SET">("ADD");
  const [popChangeAmount, setPopChangeAmount] = useState<number>(1);
  const [popChangeReason, setPopChangeReason] = useState<string>("");

  const activeIndex = Math.max(
    0,
    displayContainers.findIndex((c) => c.code === selectedCode)
  );
  const currentContainer = displayContainers[activeIndex] || displayContainers[0];

  const currentModule = modules.find((m) => m.id === currentContainer?.moduleId);
  const currentSubject = subjects.find(
    (s) => s.containerId === currentContainer?.id && s.isActive
  );

  const currentPopulation = currentSubject?.populationCount ?? 0;

  const todayStr = getTodayDateStr();

  // Query log aktivitas hari ini untuk container aktif
  const todayLogs = useLiveQuery(
    async () => {
      if (!currentContainer) return [];
      const logs = await localDb.activityLogs
        .where("containerId")
        .equals(currentContainer.id)
        .toArray();
      return logs.filter((l) => l.performedAt.startsWith(todayStr));
    },
    [currentContainer?.id, todayStr],
    []
  );

  // Hitung berapa kali pakan/rawat hari ini & kapan terakhir
  const routineLogsToday = (todayLogs || []).filter((l) => l.activityType === "ROUTINE");
  const routineCountToday = routineLogsToday.length;
  const lastRoutineLog = routineLogsToday.sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
  const lastRoutineTimeStr = lastRoutineLog
    ? new Date(lastRoutineLog.performedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Hitung berapa kali panen hari ini, total panen, & kapan terakhir
  const harvestLogsToday = (todayLogs || []).filter((l) => l.activityType === "HARVEST");
  const harvestCountToday = harvestLogsToday.length;
  const totalHarvestQtyToday = harvestLogsToday.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);
  const lastHarvestLog = harvestLogsToday.sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
  const lastHarvestTimeStr = lastHarvestLog
    ? new Date(lastHarvestLog.performedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const isRoutineDoneToday = routineCountToday > 0;
  const isHarvestDoneToday = harvestCountToday > 0;

  const handlePrev = () => {
    if (activeIndex > 0) {
      onSelectCode(displayContainers[activeIndex - 1].code);
    }
  };

  const handleNext = () => {
    if (activeIndex < displayContainers.length - 1) {
      onSelectCode(displayContainers[activeIndex + 1].code);
    }
  };

  // 1. Kelola Perubahan Populasi (Tambah / Kurang / Atur Ulang)
  const handleUpdatePopulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContainer) return;

    const oldPop = currentSubject?.populationCount ?? 0;
    let newPop = oldPop;
    let diff = 0;

    if (popChangeType === "ADD") {
      diff = Math.max(1, popChangeAmount);
      newPop = oldPop + diff;
    } else if (popChangeType === "SUBTRACT") {
      diff = -Math.min(oldPop, Math.max(1, popChangeAmount));
      newPop = Math.max(0, oldPop + diff);
    } else {
      newPop = Math.max(0, popChangeAmount);
      diff = newPop - oldPop;
    }

    const defaultReason =
      popChangeType === "ADD"
        ? `Tambah populasi bibit/ayam baru (${diff > 0 ? `+${diff}` : diff})`
        : popChangeType === "SUBTRACT"
        ? `Pengurangan / pemotongan / mutasi (${diff})`
        : `Penyesuaian stok populasi (${oldPop} -> ${newPop})`;

    const finalReason = popChangeReason.trim() || defaultReason;

    if (currentSubject) {
      // Update subject yang ada
      await localDb.subjects.update(currentSubject.id, {
        populationCount: newPop,
        isActive: true, // tetap aktif meskipun 0, agar bisa ditambah lagi nanti
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    } else {
      // Jika wadah belum memiliki subject, buat subject baru
      await localDb.subjects.put({
        id: `subj-${currentContainer.code}-${Date.now()}`,
        moduleId: currentContainer.moduleId,
        containerId: currentContainer.id,
        label: `${currentContainer.name} Batch`,
        populationCount: newPop,
        isActive: true,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    // Pastikan status wadah ACTIVE
    await localDb.containers.update(currentContainer.id, {
      status: "ACTIVE",
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    // Catat ke Activity Log
    await localDb.activityLogs.put({
      id: `log-pop-${Date.now()}`,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      subjectId: currentSubject?.id,
      activityType: "POPULATION_CHANGE",
      quantity: diff,
      unit: "Unit",
      note: `${finalReason} di ${currentContainer.name}. Populasi kini: ${newPop}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`📊 Populasi ${currentContainer.name} diubah menjadi ${newPop}!`);
    setShowPopulationModal(false);
    setPopChangeAmount(1);
    setPopChangeReason("");
  };

  // 2. Eksekusi Tombol Rawat Harian
  const handleRoutineAction = async () => {
    if (!currentContainer || !currentSubject) return;

    await localDb.subjects.update(currentSubject.id, {
      lastRoutineDate: todayStr,
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    await localDb.activityLogs.put({
      id: `log-rtn-${Date.now()}`,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      subjectId: currentSubject.id,
      activityType: "ROUTINE",
      quantity: 1,
      note: `${currentModule?.config.routineActionLabel || "Perawatan"} pada ${currentContainer.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`✅ ${currentModule?.config.routineActionLabel || "Aksi"} selesai!`);
  };

  // 2. Eksekusi Tombol Panen Hasil
  const handleHarvestAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContainer || !currentSubject) return;

    const harvestType = currentModule?.config.harvestType || "RECURRING";

    if (harvestType === "RECURRING") {
      // Panen berkala
      await localDb.subjects.update(currentSubject.id, {
        lastHarvestDate: todayStr,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      await localDb.activityLogs.put({
        id: `log-hrv-${Date.now()}`,
        moduleId: currentContainer.moduleId,
        containerId: currentContainer.id,
        subjectId: currentSubject.id,
        activityType: "HARVEST",
        quantity: Number(harvestInput) || 1,
        unit: currentModule?.config.harvestUnitLabel || "Unit",
        note: `Panen ${currentContainer.name}: ${harvestInput} ${currentModule?.config.harvestUnitLabel || ""}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(`🎉 Berhasil mencatat panen: ${harvestInput} ${currentModule?.config.harvestUnitLabel || ""}!`);
    } else {
      // Panen sekali habis (Kosongkan wadah)
      await localDb.subjects.update(currentSubject.id, {
        isActive: false,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      await localDb.containers.update(currentContainer.id, {
        status: "VACANT",
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      await localDb.activityLogs.put({
        id: `log-trm-${Date.now()}`,
        moduleId: currentContainer.moduleId,
        containerId: currentContainer.id,
        subjectId: currentSubject.id,
        activityType: "TERMINATE",
        quantity: currentSubject.populationCount,
        note: `Panen total & kosongkan wadah ${currentContainer.name}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(`🎉 Panen total selesai. Wadah ${currentContainer.name} sekarang kosong.`);
    }

    setShowHarvestModal(false);
  };

  // 3. Lapor Kerusakan / Kendala
  const handleReportMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContainer) return;

    await localDb.containers.update(currentContainer.id, {
      status: "MAINTENANCE",
      maintenanceNote: maintenanceNote.trim() || "Kendala teknis di lapangan",
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    await localDb.activityLogs.put({
      id: `log-mnt-${Date.now()}`,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      activityType: "MAINTENANCE",
      quantity: 1,
      note: `Lapor kendala: ${maintenanceNote.trim()}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setShowMaintenanceModal(false);
    toast.warning(`Wadah ${currentContainer.name} ditandai butuh perbaikan.`);
  };

  if (!currentContainer) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-12">
          <h3 className="text-xl font-black text-slate-800">Tidak Ada Area Terdaftar</h3>
          <p className="mt-2 text-xs font-bold text-slate-500">
            Silakan masuk ke halaman Admin untuk membuat sistem ternak & mendaftarkan wadah pertama Anda.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-20">
      {/* 1. CAROUSEL NAVIGASI LOKASI / WADAH */}
      <div className="flex items-center justify-between gap-2 rounded-3xl border-2 border-slate-300 bg-white p-3 shadow-xs">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition"
        >
          <ChevronLeft className="h-6 w-6 stroke-[3]" />
        </button>

        <div className="text-center min-w-0 flex-1">
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-950">
            {currentModule?.name || "Sistem Ternak"}
          </span>
          <h2 className="text-xl font-black text-slate-900 truncate mt-0.5">
            {currentContainer.name}
          </h2>
          <div className="text-xs font-bold text-slate-500">
            Kode: <span className="font-black text-slate-800">{currentContainer.code}</span> • {activeIndex + 1} dari {displayContainers.length}
          </div>
        </div>

        <button
          onClick={handleNext}
          disabled={activeIndex === displayContainers.length - 1}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition"
        >
          <ChevronRight className="h-6 w-6 stroke-[3]" />
        </button>
      </div>

      {/* 2. KARTU STATUS POPULASI & QUICK ADJUST */}
      <div className="rounded-3xl border-2 border-slate-300 bg-white p-5 text-center shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black uppercase tracking-wider text-slate-400">
            Populasi Saat Ini
          </span>
          {currentPopulation === 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-500">
              Wadah Kosong / 0
            </span>
          )}
        </div>

        <div className="text-4xl font-black text-slate-900 mt-1">
          {currentPopulation}{" "}
          <span className="text-base font-bold text-slate-500">Ekor / Unit</span>
        </div>

        {/* Action Button untuk Tambah/Ubah Populasi */}
        <div className="mt-4">
          <button
            onClick={() => {
              setPopChangeType("ADD");
              setPopChangeAmount(1);
              setShowPopulationModal(true);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 py-3 text-xs font-black text-slate-800 hover:bg-slate-100 active:scale-95 transition shadow-2xs"
          >
            <span>Update Jumlah Ternak / Bibit</span>
          </button>
        </div>
      </div>

      {/* 3. TOMBOL RAKSASA #1: PERAWATAN HARIAN */}
      <button
        onClick={handleRoutineAction}
        className={`flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-3xl border-4 p-5 text-center transition active:scale-98 shadow-md ${
          isRoutineDoneToday
            ? "border-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
            : "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
        }`}
      >
        <div className="flex items-center gap-2 text-xl font-black">
          {isRoutineDoneToday ? (
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          ) : (
            <Utensils className="h-7 w-7" />
          )}
          <span>{currentModule?.config.routineActionLabel || "Perawatan Harian"}</span>
        </div>
        <div className="text-xs font-bold opacity-90">
          {isRoutineDoneToday ? (
            <span className="inline-flex items-center gap-1.5 font-black text-emerald-900">
              <span>Sudah {routineCountToday}x hari ini</span>
              <span>•</span>
              <span>Terakhir: {lastRoutineTimeStr} WIB</span>
              <span className="text-[10px] font-normal opacity-75">(Tap untuk tambah lagi)</span>
            </span>
          ) : (
            <span>Belum dilakukan hari ini — Tap tombol ini</span>
          )}
        </div>
      </button>

      {/* 4. TOMBOL RAKSASA #2: PANEN / HASIL */}
      <button
        onClick={() => setShowHarvestModal(true)}
        className="flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-3xl border-4 border-amber-500 bg-amber-400 p-5 text-center text-slate-950 transition active:scale-98 shadow-md hover:bg-amber-300"
      >
        <div className="flex items-center gap-2 text-xl font-black">
          <Scissors className="h-7 w-7" />
          <span>{currentModule?.config.harvestActionLabel || "Panen Hasil"}</span>
        </div>
        <div className="text-xs font-bold text-slate-900 opacity-90">
          {isHarvestDoneToday ? (
            <span className="inline-flex items-center gap-1.5 font-black">
              <span>Sudah {harvestCountToday}x</span>
              {currentModule?.config.harvestType === "RECURRING" && (
                <span>(Total: {totalHarvestQtyToday} {currentModule?.config.harvestUnitLabel || "Unit"})</span>
              )}
              <span>•</span>
              <span>Terakhir: {lastHarvestTimeStr} WIB</span>
            </span>
          ) : (
            <span>
              {currentModule?.config.harvestType === "RECURRING"
                ? `Belum panen hari ini (${currentModule?.config.harvestUnitLabel || "Unit"})`
                : "Panen total sekaligus (Kosongkan wadah)"}
            </span>
          )}
        </div>
      </button>

      {/* 5. LAPOR KENDALA / RUSAK */}
      <div className="pt-2">
        <button
          onClick={() => setShowMaintenanceModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 py-3.5 text-xs font-black text-slate-600 hover:bg-slate-100 active:scale-95 transition"
        >
          <Wrench className="h-4 w-4 text-rose-600" />
          <span>Lapor Kendala / Kerusakan Wadah Ini</span>
        </button>
      </div>

      {/* MODAL PANEN */}
      {showHarvestModal && (
        <div
          onClick={() => setShowHarvestModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleHarvestAction}
            className="w-full max-w-sm rounded-3xl border-2 border-amber-500 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900">
                {currentModule?.config.harvestActionLabel}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Wadah: {currentContainer.name}
              </p>
            </div>

            {currentModule?.config.harvestType === "RECURRING" && (
              <div className="rounded-2xl bg-amber-50 p-4 text-center border border-amber-200">
                <label className="block text-xs font-black text-slate-700">
                  Jumlah Hasil ({currentModule?.config.harvestUnitLabel || "Unit"})
                </label>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setHarvestInput((v) => Math.max(1, v - 1))}
                    className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0.1}
                    step={0.1}
                    required
                    value={harvestInput}
                    onChange={(e) => setHarvestInput(Number(e.target.value))}
                    className="w-24 rounded-xl border-2 border-amber-400 bg-white py-2 text-center text-2xl font-black text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setHarvestInput((v) => v + 1)}
                    className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowHarvestModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-sm font-black text-slate-950 hover:bg-amber-400"
              >
                Simpan Panen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL LAPOR KENDALA */}
      {showMaintenanceModal && (
        <div
          onClick={() => setShowMaintenanceModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleReportMaintenance}
            className="w-full max-w-sm rounded-3xl border-2 border-rose-600 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <AlertTriangle className="mx-auto h-8 w-8 text-rose-600" />
              <h3 className="text-xl font-black text-slate-900 mt-2">
                Lapor Kendala Wadah
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-0.5">
                {currentContainer.name} ({currentContainer.code})
              </p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700">
                Catatan Kendala (Bocor / Rusak / Mati)
              </label>
              <textarea
                required
                rows={3}
                value={maintenanceNote}
                onChange={(e) => setMaintenanceNote(e.target.value)}
                placeholder="Contoh: Talang bocor atau kawat patah..."
                className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-rose-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-rose-600 py-3 text-sm font-black text-white hover:bg-rose-700"
              >
                Tandai Rusak
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL KELOLA POPULASI (TAMBAH / KURANG / ATUR ULANG) */}
      {showPopulationModal && (
        <div
          onClick={() => setShowPopulationModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleUpdatePopulation}
            className="w-full max-w-sm rounded-3xl border-2 border-blue-500 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900">
                Kelola Populasi Ternak / Bibit
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Wadah: {currentContainer.name} ({currentContainer.code})
              </p>
            </div>

            {/* Pilihan Aksi: Tambah / Kurang / Set Nilai */}
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPopChangeType("ADD")}
                className={`py-2 text-xs font-black rounded-xl transition ${
                  popChangeType === "ADD"
                    ? "bg-white text-emerald-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                + Tambah
              </button>
              <button
                type="button"
                onClick={() => setPopChangeType("SUBTRACT")}
                className={`py-2 text-xs font-black rounded-xl transition ${
                  popChangeType === "SUBTRACT"
                    ? "bg-white text-rose-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                - Kurangi
              </button>
              <button
                type="button"
                onClick={() => {
                  setPopChangeType("SET");
                  setPopChangeAmount(currentPopulation);
                }}
                className={`py-2 text-xs font-black rounded-xl transition ${
                  popChangeType === "SET"
                    ? "bg-white text-blue-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Atur Total
              </button>
            </div>

            {/* Input Angka */}
            <div className="rounded-2xl bg-blue-50 p-4 text-center border border-blue-200">
              <label className="block text-xs font-black text-slate-700">
                {popChangeType === "ADD"
                  ? "Jumlah yang Ditambahkan"
                  : popChangeType === "SUBTRACT"
                  ? "Jumlah yang Dipotong / Dikeluarkan"
                  : "Tetapkan Total Populasi Baru"}
              </label>

              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPopChangeAmount((v) => Math.max(1, v - (popChangeType === "SET" ? 5 : 1)))}
                  className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300"
                >
                  -
                </button>
                <input
                  type="number"
                  min={popChangeType === "SET" ? 0 : 1}
                  required
                  value={popChangeAmount}
                  onChange={(e) => setPopChangeAmount(Number(e.target.value))}
                  className="w-24 rounded-xl border-2 border-blue-400 bg-white py-2 text-center text-2xl font-black text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setPopChangeAmount((v) => v + (popChangeType === "SET" ? 5 : 1))}
                  className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300"
                >
                  +
                </button>
              </div>

              <div className="mt-2 text-xs font-bold text-slate-600">
                Hasil: {currentPopulation} →{" "}
                <span className="font-black text-blue-900">
                  {popChangeType === "ADD"
                    ? currentPopulation + Math.max(1, popChangeAmount)
                    : popChangeType === "SUBTRACT"
                    ? Math.max(0, currentPopulation - Math.max(1, popChangeAmount))
                    : Math.max(0, popChangeAmount)}{" "}
                  Ekor / Unit
                </span>
              </div>
            </div>

            {/* Alasan / Catatan Opsional */}
            <div>
              <label className="block text-xs font-black text-slate-700">
                Keterangan / Alasan (Opsional)
              </label>
              <input
                type="text"
                value={popChangeReason}
                onChange={(e) => setPopChangeReason(e.target.value)}
                placeholder={
                  popChangeType === "ADD"
                    ? "Contoh: Beli bibit baru 50 ekor..."
                    : popChangeType === "SUBTRACT"
                    ? "Contoh: Potong ayam untuk konsumsi..."
                    : "Contoh: Hitung ulang fisik..."
                }
                className="mt-1 w-full rounded-xl border-2 border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowPopulationModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-blue-600 py-3 text-sm font-black text-white hover:bg-blue-700 shadow-md"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
