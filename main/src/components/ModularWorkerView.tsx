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
  LayoutGrid,
  Check,
  X,
  Edit3,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { QrScannerModal } from "./QrScannerModal";
import { runFarmSync } from "@/lib/sync-engine";
import { useOperasionalDate } from "@/context/DateContext";

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
  const { selectedDate, isToday } = useOperasionalDate();

  // Semua container yang terdaftar tetap ditampilkan
  const displayContainers = containers;

  // Modal Panen & Revisi Panen
  const [harvestInput, setHarvestInput] = useState<number>(1);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [isHarvestRevision, setIsHarvestRevision] = useState(false);

  // Modal Revisi Pakan/Rawat
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [routineCountInput, setRoutineCountInput] = useState<number>(0);

  // Modal Lapor Kendala
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);

  // Modal kelola populasi (tambah / kurang / set langsung)
  const [showPopulationModal, setShowPopulationModal] = useState(false);
  const [popChangeType, setPopChangeType] = useState<"ADD" | "SUBTRACT" | "SET">("ADD");
  const [popChangeAmount, setPopChangeAmount] = useState<number>(1);
  const [popChangeReason, setPopChangeReason] = useState<string>("");

  // Modal Grid Selector (Opsi 3) & Scanner Kamera QR (Opsi 1)
  const [showGridModal, setShowGridModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);

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

  // Query semua aktivitas pada target date terpilih (selectedDate)
  const allDateLogs = useLiveQuery(
    async () => {
      const logs = await localDb.activityLogs.toArray();
      return logs.filter((l) => {
        const logDate = l.targetDate || l.performedAt.split("T")[0];
        return logDate === selectedDate;
      });
    },
    [selectedDate],
    []
  );

  // Set ID container yang sudah dikasih pakan/rawat pada target date
  const fedContainerIdsOnDate = new Set(
    (allDateLogs || [])
      .filter((l) => {
        if (l.activityType !== "ROUTINE") return false;
        // Jika ada kuantitas 0 (revisi jadi 0), jangan anggap sudah dikasih pakan
        return (l.quantity ?? 1) > 0;
      })
      .map((l) => l.containerId)
  );

  // Query log aktivitas target date untuk container aktif
  const selectedDateLogs = (allDateLogs || []).filter(
    (l) => l.containerId === currentContainer?.id
  );

  // Query panen historis paling akhir kapanpun untuk container aktif
  const lastEverHarvestLog = useLiveQuery(
    async () => {
      if (!currentContainer) return null;
      const logs = await localDb.activityLogs
        .where("containerId")
        .equals(currentContainer.id)
        .filter((l) => l.activityType === "HARVEST" && (l.quantity ?? 0) > 0)
        .toArray();
      if (!logs.length) return null;
      return logs.sort((a, b) => b.performedAt.localeCompare(a.performedAt))[0];
    },
    [currentContainer?.id],
    null
  );

  // Evaluasi Routine Count pada target date
  // Aksi append-only: Ambil log routine terbaru pada target date untuk menentukan state hari itu.
  // Jika log terbaru punya catatan revisi langsung atau kuantitas, atau hitung jumlah.
  const routineLogsOnDate = (selectedDateLogs || [])
    .filter((l) => l.activityType === "ROUTINE")
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  const lastRoutineLog = routineLogsOnDate[0] || null;
  // Jika entri terakhir adalah REVISION (ditandai dengan note revisi atau kuantitas eksplisit), gunakan kuantitasnya,
  // jika normal tanpa revisi, kuantitas adalah jumlah aksi rutin pada hari itu.
  const routineCountOnDate = lastRoutineLog
    ? (lastRoutineLog.note?.includes("Revisi") || lastRoutineLog.quantity !== undefined
        ? Number(lastRoutineLog.quantity)
        : routineLogsOnDate.length)
    : 0;

  const isRoutineDoneOnDate = routineCountOnDate > 0;

  const lastRoutineTimeStr = lastRoutineLog
    ? new Date(lastRoutineLog.performedAt).toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  // Evaluasi Harvest pada target date
  const harvestLogsOnDate = (selectedDateLogs || [])
    .filter((l) => l.activityType === "HARVEST")
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));

  const lastHarvestLog = harvestLogsOnDate[0] || null;
  const isHarvestRevisionActive = lastHarvestLog && lastHarvestLog.note?.includes("Revisi");
  
  // Total kuantitas panen pada tanggal ini
  const totalHarvestQtyOnDate = isHarvestRevisionActive
    ? Number(lastHarvestLog?.quantity || 0)
    : harvestLogsOnDate.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  const isHarvestDoneOnDate = totalHarvestQtyOnDate > 0;

  // Threshold alert dari modul (default: RECURRING = 2 hari, ONCE = 0 alias non-aktif)
  const alertThresholdDays =
    currentModule?.config.harvestAlertDays !== undefined
      ? currentModule.config.harvestAlertDays
      : currentModule?.config.harvestType === "RECURRING"
      ? 2
      : 0;

  let harvestTimestampDisplay = "Belum pernah panen";
  let daysSinceLastHarvest: number | null = null;
  let isOverdueHarvest = false;

  if (lastEverHarvestLog) {
    const harvestDate = new Date(lastEverHarvestLog.performedAt);
    const harvestDateStr = lastEverHarvestLog.targetDate || lastEverHarvestLog.performedAt.split("T")[0];

    const todayStr = getTodayDateStr();
    const todayDateObj = new Date(todayStr);
    const prevDateObj = new Date(harvestDateStr);
    const diffTime = todayDateObj.getTime() - prevDateObj.getTime();
    daysSinceLastHarvest = Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));

    if (harvestDateStr === todayStr) {
      const timeStr = harvestDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      harvestTimestampDisplay = `Hari ini • ${timeStr} WIB`;
    } else {
      const formattedDate = harvestDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      harvestTimestampDisplay = `${formattedDate} (${daysSinceLastHarvest} hari lalu)`;

      if (alertThresholdDays > 0 && daysSinceLastHarvest >= alertThresholdDays) {
        isOverdueHarvest = true;
      }
    }
  }

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

  // 1. Kelola Perubahan Populasi
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
        ? `Tambah bibit/populasi baru (${diff > 0 ? `+${diff}` : diff})`
        : popChangeType === "SUBTRACT"
        ? `Pengurangan / mutasi / potong (${diff})`
        : `Revisi jumlah populasi (${oldPop} -> ${newPop})`;

    const finalReason = popChangeReason.trim() || defaultReason;

    if (currentSubject) {
      await localDb.subjects.update(currentSubject.id, {
        populationCount: newPop,
        isActive: true,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    } else {
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

    await localDb.containers.update(currentContainer.id, {
      status: "ACTIVE",
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    const newLogId = `log-pop-${Date.now()}`;
    await localDb.activityLogs.put({
      id: newLogId,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      subjectId: currentSubject?.id,
      activityType: "POPULATION_CHANGE",
      quantity: newPop,
      unit: "Unit",
      note: `${finalReason} di ${currentContainer.name} (Tanggal ${selectedDate}). Populasi: ${newPop}`,
      targetDate: selectedDate,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`📊 Populasi ${currentContainer.name} diubah menjadi ${newPop}!`);
    setShowPopulationModal(false);
    setPopChangeAmount(1);
    setPopChangeReason("");
    runFarmSync().catch(() => {});
  };

  // 2. Aksi Cepat Tambah Rawat / Pakan (+1)
  const handleQuickAddRoutine = async () => {
    if (!currentContainer || !currentSubject) return;

    const newCount = routineCountOnDate + 1;

    await localDb.subjects.update(currentSubject.id, {
      lastRoutineDate: selectedDate,
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    const newLogId = `log-rtn-${Date.now()}`;
    await localDb.activityLogs.put({
      id: newLogId,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      subjectId: currentSubject.id,
      activityType: "ROUTINE",
      quantity: newCount,
      unit: "Kali",
      note: `${currentModule?.config.routineActionLabel || "Perawatan"} ke-${newCount} pada ${currentContainer.name}`,
      targetDate: selectedDate,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`✅ ${currentModule?.config.routineActionLabel || "Aksi"} selesai (${newCount}x)!`);
    runFarmSync().catch(() => {});
  };

  // 3. Revisi Nilai Rutin / Pakan (Langsung set ke angka tertentu misal 0, 1, 2, dll)
  const handleSaveRoutineRevision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContainer || !currentSubject) return;

    const targetCount = Math.max(0, routineCountInput);

    await localDb.subjects.update(currentSubject.id, {
      lastRoutineDate: targetCount > 0 ? selectedDate : currentSubject.lastRoutineDate,
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    const newLogId = `log-rtn-${Date.now()}`;
    await localDb.activityLogs.put({
      id: newLogId,
      moduleId: currentContainer.moduleId,
      containerId: currentContainer.id,
      subjectId: currentSubject.id,
      activityType: "ROUTINE",
      quantity: targetCount,
      unit: "Kali",
      note: `Revisi pemberian ${currentModule?.config.routineActionLabel || "pakan"} tanggal ${selectedDate} menjadi ${targetCount}x`,
      targetDate: selectedDate,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    toast.success(`👌 Frekuensi ${currentModule?.config.routineActionLabel || "pakan"} direvisi menjadi ${targetCount}x.`);
    setShowRoutineModal(false);
    runFarmSync().catch(() => {});
  };

  // 4. Eksekusi Tombol Panen / Revisi Panen
  const handleSaveHarvest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentContainer || !currentSubject) return;

    const harvestType = currentModule?.config.harvestType || "RECURRING";
    const qtyValue = Math.max(0, Number(harvestInput) || 0);

    if (harvestType === "RECURRING") {
      await localDb.subjects.update(currentSubject.id, {
        lastHarvestDate: qtyValue > 0 ? selectedDate : currentSubject.lastHarvestDate,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      const noteText = isHarvestRevision
        ? `Revisi hasil panen tanggal ${selectedDate} menjadi ${qtyValue} ${currentModule?.config.harvestUnitLabel || ""}`
        : `Panen ${currentContainer.name}: ${qtyValue} ${currentModule?.config.harvestUnitLabel || ""}`;

      const newLogId = `log-hrv-${Date.now()}`;
      await localDb.activityLogs.put({
        id: newLogId,
        moduleId: currentContainer.moduleId,
        containerId: currentContainer.id,
        subjectId: currentSubject.id,
        activityType: "HARVEST",
        quantity: qtyValue,
        unit: currentModule?.config.harvestUnitLabel || "Unit",
        note: noteText,
        targetDate: selectedDate,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(
        qtyValue > 0
          ? `🎉 Berhasil mencatat panen: ${qtyValue} ${currentModule?.config.harvestUnitLabel || ""}!`
          : `👌 Hasil panen tanggal ${selectedDate} telah diatur menjadi 0.`
      );
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

      const newLogId = `log-trm-${Date.now()}`;
      await localDb.activityLogs.put({
        id: newLogId,
        moduleId: currentContainer.moduleId,
        containerId: currentContainer.id,
        subjectId: currentSubject.id,
        activityType: "TERMINATE",
        quantity: currentSubject.populationCount,
        note: `Panen total & kosongkan wadah ${currentContainer.name} (Tanggal ${selectedDate})`,
        targetDate: selectedDate,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });

      toast.success(`🎉 Panen total selesai. Wadah ${currentContainer.name} sekarang kosong.`);
    }

    setShowHarvestModal(false);
    runFarmSync().catch(() => {});
  };

  // 5. Lapor Kerusakan / Kendala
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
      targetDate: selectedDate,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setShowMaintenanceModal(false);
    toast.warning(`Wadah ${currentContainer.name} ditandai butuh perbaikan.`);
    runFarmSync().catch(() => {});
  };

  if (!currentContainer) {
    return (
      <div className="w-full p-6 text-center">
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
    <div className="w-full space-y-4 pb-20">
      {/* Peringatan jika sedang melihat / mengedit data masa lalu */}
      {!isToday && (
        <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 font-bold shadow-2xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-amber-700 shrink-0" />
            <span>Mode Tanggal Lampau: Mengedit catatan untuk <strong>{selectedDate}</strong></span>
          </div>
        </div>
      )}

      {/* 1. CAROUSEL NAVIGASI LOKASI / WADAH */}
      <div className="flex items-center justify-between gap-2 rounded-3xl border-2 border-slate-300 bg-white p-3 shadow-xs">
        <button
          onClick={handlePrev}
          disabled={activeIndex === 0}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition shrink-0"
          title="Kandang Sebelumnya"
        >
          <ChevronLeft className="h-6 w-6 stroke-[3]" />
        </button>

        {/* Center Carousel: Title Info */}
        <div className="text-center min-w-0 flex-1 px-1">
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
          className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-slate-200 text-slate-700 hover:bg-slate-100 disabled:opacity-30 active:scale-95 transition shrink-0"
          title="Kandang Berikutnya"
        >
          <ChevronRight className="h-6 w-6 stroke-[3]" />
        </button>
      </div>

      {/* QUICK ACTIONS BAR: LIHAT & PILIH SEMUA KANDANG */}
      <div>
        <button
          onClick={() => setShowGridModal(true)}
          className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white py-3 px-4 text-xs font-black text-slate-800 shadow-xs hover:bg-slate-50 active:scale-95 transition"
        >
          <LayoutGrid className="h-4 w-4 text-emerald-700" />
          <span>Buka Semua Kandang ({displayContainers.length} Wadah)</span>
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

      {/* 3 & 4. DUA TOMBOL UTAMA LAPANGAN DENGAN OPSI REVISI CEPAT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* TOMBOL #1: PERAWATAN HARIAN DENGAN REVISI */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleQuickAddRoutine}
            className={`flex min-h-[110px] w-full flex-col items-center justify-center gap-1.5 rounded-3xl border-4 p-5 text-center transition active:scale-98 shadow-md ${
              isRoutineDoneOnDate
                ? "border-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
                : "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2 text-xl font-black">
              {isRoutineDoneOnDate ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              ) : (
                <Utensils className="h-7 w-7" />
              )}
              <span>{currentModule?.config.routineActionLabel || "Perawatan"}</span>
            </div>
            <div className="text-xs font-bold opacity-90">
              {isRoutineDoneOnDate ? (
                <span className="inline-flex items-center gap-1.5 font-black text-emerald-900">
                  <span>Sudah {routineCountOnDate}x pada tanggal ini</span>
                  {lastRoutineTimeStr && <span>• {lastRoutineTimeStr} WIB</span>}
                  <span className="text-[10px] font-normal opacity-75">(Tap +1)</span>
                </span>
              ) : (
                <span>Belum dilakukan — Tap untuk +1</span>
              )}
            </div>
          </button>

          {/* Tombol Revisi Pakan */}
          <button
            type="button"
            onClick={() => {
              setRoutineCountInput(routineCountOnDate);
              setShowRoutineModal(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-500" />
            <span>Revisi Jumlah Kasih Pakan ({routineCountOnDate}x)</span>
          </button>
        </div>

        {/* TOMBOL #2: PANEN / HASIL DENGAN OPSI REVISI */}
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => {
              setHarvestInput(1);
              setIsHarvestRevision(false);
              setShowHarvestModal(true);
            }}
            className={`relative flex min-h-[110px] w-full flex-col items-center justify-center gap-1.5 rounded-3xl border-4 p-5 text-center transition active:scale-98 shadow-md overflow-hidden ${
              isHarvestDoneOnDate
                ? "border-amber-400 bg-amber-300 text-slate-950 hover:bg-amber-200"
                : isOverdueHarvest
                ? "border-rose-500 bg-amber-400 text-slate-950 hover:bg-amber-300 ring-4 ring-rose-400/50 animate-pulse"
                : "border-amber-500 bg-amber-400 text-slate-950 hover:bg-amber-300"
            }`}
          >
            {isOverdueHarvest && daysSinceLastHarvest !== null && (
              <span className="absolute top-2.5 right-3 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-black uppercase text-white shadow-xs">
                ⚠️ {daysSinceLastHarvest} Hari Belum Panen
              </span>
            )}

            <div className="flex items-center gap-2 text-xl font-black">
              <Scissors className="h-7 w-7" />
              <span>{currentModule?.config.harvestActionLabel || "Panen Hasil"}</span>
            </div>

            <div className="text-xs font-bold text-slate-900 opacity-95">
              {isHarvestDoneOnDate ? (
                <span className="inline-flex items-center gap-1.5 font-black">
                  <span>Tercatat: {totalHarvestQtyOnDate} {currentModule?.config.harvestUnitLabel || "Unit"}</span>
                  <span>•</span>
                  <span>{harvestTimestampDisplay}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <span>{currentModule?.config.harvestType === "RECURRING" ? "Belum panen pada tanggal ini" : "Panen total"}</span>
                  <span>•</span>
                  <span className={`font-black ${isOverdueHarvest ? "text-rose-900 underline" : ""}`}>
                    {harvestTimestampDisplay}
                  </span>
                </span>
              )}
            </div>
          </button>

          {/* Tombol Revisi Panen */}
          <button
            type="button"
            onClick={() => {
              setHarvestInput(totalHarvestQtyOnDate);
              setIsHarvestRevision(true);
              setShowHarvestModal(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
          >
            <Edit3 className="h-3.5 w-3.5 text-slate-500" />
            <span>Revisi Hasil Panen ({totalHarvestQtyOnDate} {currentModule?.config.harvestUnitLabel || ""})</span>
          </button>
        </div>
      </div>

      {/* 5. LAPOR KENDALA / RUSAK */}
      <div className="pt-2">
        <button
          onClick={() => setShowMaintenanceModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 py-3 text-xs font-black text-slate-600 hover:bg-slate-100 active:scale-95 transition"
        >
          <Wrench className="h-4 w-4 text-rose-600" />
          <span>Lapor Kendala / Kerusakan Wadah Ini</span>
        </button>
      </div>

      {/* MODAL REVISI PAKAN / RAWAT */}
      {showRoutineModal && (
        <div
          onClick={() => setShowRoutineModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveRoutineRevision}
            className="w-full max-w-sm rounded-3xl border-2 border-emerald-600 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900">
                Revisi {currentModule?.config.routineActionLabel || "Pemberian Pakan"}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Wadah: {currentContainer.name} • Tanggal: {selectedDate}
              </p>
            </div>

            <div className="rounded-2xl bg-emerald-50 p-4 text-center border border-emerald-200">
              <label className="block text-xs font-black text-slate-700">
                Berapa kali sudah diberi pakan pada tanggal ini?
              </label>
              <div className="mt-3 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRoutineCountInput((v) => Math.max(0, v - 1))}
                  className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300 active:scale-95"
                >
                  -
                </button>
                <input
                  type="number"
                  min={0}
                  required
                  value={routineCountInput}
                  onChange={(e) => setRoutineCountInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-24 rounded-xl border-2 border-emerald-500 bg-white py-2 text-center text-3xl font-black text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRoutineCountInput((v) => v + 1)}
                  className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300 active:scale-95"
                >
                  +
                </button>
              </div>

              {routineCountInput === 0 && (
                <p className="text-[11px] font-bold text-amber-700 mt-2">
                  Mengatur ke 0 akan mereset status menjadi belum diberi pakan.
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowRoutineModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-black text-white hover:bg-emerald-700"
              >
                Simpan Revisi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL PANEN & REVISI PANEN */}
      {showHarvestModal && (
        <div
          onClick={() => setShowHarvestModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveHarvest}
            className="w-full max-w-sm rounded-3xl border-2 border-amber-500 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="text-center">
              <h3 className="text-xl font-black text-slate-900">
                {isHarvestRevision ? "Revisi Panen" : currentModule?.config.harvestActionLabel || "Catat Panen"}
              </h3>
              <p className="text-xs font-bold text-slate-500 mt-1">
                Wadah: {currentContainer.name} • Tanggal: {selectedDate}
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
                    onClick={() => setHarvestInput((v) => Math.max(0, Number((v - 1).toFixed(1))))}
                    className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300 active:scale-95"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min={0}
                    step={0.1}
                    required
                    value={harvestInput}
                    onChange={(e) => setHarvestInput(Number(e.target.value))}
                    className="w-24 rounded-xl border-2 border-amber-400 bg-white py-2 text-center text-2xl font-black text-slate-900 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setHarvestInput((v) => Number((v + 1).toFixed(1)))}
                    className="h-12 w-12 rounded-xl bg-white text-xl font-black border border-slate-300 active:scale-95"
                  >
                    +
                  </button>
                </div>
                {isHarvestRevision && harvestInput === 0 && (
                  <p className="text-[11px] font-bold text-amber-800 mt-2">
                    Mengatur panen ke 0 akan membatalkan hasil panen tanggal ini.
                  </p>
                )}
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
                {isHarvestRevision ? "Simpan Revisi" : "Simpan Panen"}
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

      {/* MODAL SCANNER KAMERA QR (OPSI 1) */}
      {showScannerModal && (
        <QrScannerModal
          onScanSuccess={(code) => {
            setShowScannerModal(false);
            const found = displayContainers.find(
              (c) => c.code.toLowerCase() === code.toLowerCase()
            );
            if (found) {
              onSelectCode(found.code);
              toast.success(`🎯 Langsung membuka ${found.name}!`);
            } else {
              toast.error(`Kode "${code}" tidak ditemukan pada daftar wadah.`);
            }
          }}
          onClose={() => setShowScannerModal(false)}
        />
      )}

      {/* MODAL GRID SELECTOR DENGAN STATUS WARNA (OPSI 3) */}
      {showGridModal && (
        <div
          onClick={() => setShowGridModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-3xl border-2 border-emerald-700 bg-white p-5 sm:p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-emerald-700" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Pilih Wadah / Kandang ({displayContainers.length})
                  </h3>
                  <div className="flex items-center gap-3 text-[11px] font-bold mt-0.5">
                    <span className="flex items-center gap-1 text-emerald-800">
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
                      Sudah Dirawat ({selectedDate})
                    </span>
                    <span className="flex items-center gap-1 text-amber-900">
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block" />
                      Belum Dirawat
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowGridModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid Kartu Wadah */}
            <div className="flex-1 overflow-y-auto py-4 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {displayContainers.map((item) => {
                  const isCurrent = item.code === currentContainer.code;
                  const isFedToday = fedContainerIdsOnDate.has(item.id);
                  const itemModule = modules.find((m) => m.id === item.moduleId);
                  const itemSubject = subjects.find(
                    (s) => s.containerId === item.id && s.isActive
                  );
                  const pop = itemSubject?.populationCount ?? 0;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectCode(item.code);
                        setShowGridModal(false);
                      }}
                      className={`flex flex-col justify-between p-3.5 rounded-2xl border-2 text-left transition active:scale-95 ${
                        isCurrent
                          ? "border-emerald-700 bg-emerald-50/70 ring-2 ring-emerald-600"
                          : isFedToday
                          ? "border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50"
                          : "border-amber-300 bg-amber-50/40 hover:bg-amber-50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <div className="text-[10px] font-black uppercase text-slate-400">
                            {itemModule?.name || "Sistem"}
                          </div>
                          <div className="text-sm font-black text-slate-900 leading-tight mt-0.5">
                            {item.name}
                          </div>
                          <div className="text-xs font-mono font-bold text-slate-500">
                            {item.code}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div className="shrink-0 text-right">
                          {isFedToday ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-900">
                              <Check className="h-3 w-3 text-emerald-700 stroke-[3]" />
                              <span>Selesai</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-950">
                              <span>Belum</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-[11px] font-bold pt-2 border-t border-slate-200/60">
                        <span className="text-slate-500">
                          Populasi: <strong className="text-slate-800">{pop} unit</strong>
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">
                            ● Sedang Dibuka
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowGridModal(false)}
                className="w-full rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-xs font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
