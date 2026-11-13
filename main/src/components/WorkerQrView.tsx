"use client";

import React, { useState } from "react";
import {
  Utensils,
  Egg,
  ChevronLeft,
  ChevronRight,
  Timer,
  Scissors,
  Wrench,
  Plus,
} from "lucide-react";
import {
  getTodayDateStr,
  localDb,
  type LocalContainer,
  type LocalSubject,
} from "@/lib/offline-db";
import { toast } from "sonner";

interface WorkerQrViewProps {
  containers: LocalContainer[];
  subjects: LocalSubject[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  selectedDate?: string;
}

export function WorkerQrView({
  containers,
  subjects,
  selectedCode,
  onSelectCode,
  selectedDate,
}: WorkerQrViewProps) {
  const scanTargets = containers.filter(
    (c) =>
      c.containerType === "CAGE_SET" ||
      c.containerType === "POND" ||
      c.containerType === "QUARANTINE_BUCKET"
  );

  const [maintenanceSlotId, setMaintenanceSlotId] = useState<string | null>(null);
  const [maintenanceNote, setMaintenanceNote] = useState<string>("");
  const [evacuateTargetSlotId, setEvacuateTargetSlotId] = useState<string>("");
  const [fastingCountInput, setFastingCountInput] = useState<number>(20);

  // State Modal Panen Parsial (Partial Cut) Lele / Batch
  const [partialCutBatch, setPartialCutBatch] = useState<LocalSubject | null>(null);
  const [cutQuantityInput, setCutQuantityInput] = useState<number>(5);

  const targetDateStr = selectedDate || getTodayDateStr();

  const triggerToast = (msg: string, type: "success" | "info" | "warning" = "success") => {
    if (type === "warning") {
      toast.warning(msg);
    } else if (type === "info") {
      toast.info(msg);
    } else {
      toast.success(msg);
    }
  };

  const activeIndex = Math.max(
    0,
    scanTargets.findIndex((c) => c.code === selectedCode)
  );
  const activeContainer = scanTargets[activeIndex] || scanTargets[0];

  const handlePrevTarget = () => {
    if (scanTargets.length === 0 || activeIndex <= 0) return;
    onSelectCode(scanTargets[activeIndex - 1].code);
  };

  const handleNextTarget = () => {
    if (scanTargets.length === 0 || activeIndex >= scanTargets.length - 1) return;
    onSelectCode(scanTargets[activeIndex + 1].code);
  };

  const childSlots = containers
    .filter((c) => c.parentId === activeContainer?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const allVacantSlots = containers.filter(
    (c) => c.containerType === "CAGE_SLOT" && c.status === "VACANT"
  );

  const handleFeedAllActive = async () => {
    if (!activeContainer) return;
    const activeSlots = childSlots.filter((s) => s.status === "ACTIVE");
    const nowIso = new Date().toISOString();

    for (const slot of activeSlots) {
      const occupant = subjects.find(
        (sub) => sub.containerId === slot.id && sub.isActive
      );
      if (occupant) {
        await localDb.subjects.update(occupant.id, {
          fedToday: true,
          lastFedDate: targetDateStr,
        });
        await localDb.activityLogs.put({
          id: `log-feed-${slot.id}-${Date.now()}`,
          moduleId: slot.moduleId,
          containerId: slot.id,
          subjectId: occupant.id,
          activityType: "FEED",
          quantity: 1,
          note: `Kasih makan ${activeContainer.name} (${slot.name})`,
          performedAt: nowIso,
          syncedToCloud: false,
        });
      }
    }

    triggerToast(`🍚 ${activeSlots.length} ayam sudah diberi makan!`);
  };

  const handleToggleFeedSlot = async (slot: LocalContainer, e: React.MouseEvent) => {
    e.stopPropagation();
    if (slot.status !== "ACTIVE") return;
    const occupant = subjects.find(
      (sub) => sub.containerId === slot.id && sub.isActive
    );
    if (!occupant) return;

    const isFedToday =
      Boolean(occupant.fedToday) && occupant.lastFedDate === targetDateStr;
    const nextFed = !isFedToday;

    await localDb.subjects.update(occupant.id, {
      fedToday: nextFed,
      lastFedDate: nextFed ? targetDateStr : undefined,
    });

    if (nextFed) {
      await localDb.activityLogs.put({
        id: `log-feed-${slot.id}-${Date.now()}`,
        moduleId: slot.moduleId,
        containerId: slot.id,
        subjectId: occupant.id,
        activityType: "FEED",
        quantity: 1,
        note: `Makan individual ${slot.name}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
      triggerToast(`🍚 ${slot.name}: Sudah makan`);
    } else {
      triggerToast(`${slot.name}: Batal makan`);
    }
  };

  const handleToggleEggSlot = async (slot: LocalContainer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (slot.status !== "ACTIVE") return;
    const occupant = subjects.find(
      (sub) => sub.containerId === slot.id && sub.isActive
    );
    if (!occupant) return;

    const isHarvestedToday =
      Boolean(occupant.eggHarvestedToday) &&
      occupant.lastEggDate === targetDateStr;
    const nextEggState = !isHarvestedToday;
    const newZeroDays = nextEggState ? 0 : occupant.consecutiveZeroYieldDays;

    await localDb.subjects.update(occupant.id, {
      eggHarvestedToday: nextEggState,
      lastEggDate: nextEggState ? targetDateStr : undefined,
      consecutiveZeroYieldDays: newZeroDays,
      isRecommendedForCut: newZeroDays >= 7,
    });

    if (nextEggState) {
      await localDb.activityLogs.put({
        id: `log-egg-${slot.id}-${Date.now()}`,
        moduleId: slot.moduleId,
        containerId: slot.id,
        subjectId: occupant.id,
        activityType: "EGG_HARVEST",
        quantity: 1,
        note: `Panen telur dari ${slot.name}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
      triggerToast(`🥚 ${slot.name}: Ada telur tercatat!`);
    } else {
      triggerToast(`${slot.name}: Catatan telur dibatalkan`);
    }
  };

  const handleConfirmPartialCut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partialCutBatch) return;

    const qty = Math.min(
      Math.max(1, Number(cutQuantityInput) || 1),
      partialCutBatch.populationCount
    );
    const remaining = partialCutBatch.populationCount - qty;
    const isLudes = remaining <= 0;

    if (isLudes) {
      await localDb.subjects.update(partialCutBatch.id, {
        populationCount: 0,
        isActive: false,
      });

      // Update wadah jadi VACANT jika semua lele sudah diambil
      await localDb.containers.update(partialCutBatch.containerId, {
        status: "VACANT",
      });
    } else {
      await localDb.subjects.update(partialCutBatch.id, {
        populationCount: remaining,
      });
    }

    // Catat ke Log Aktivitas
    await localDb.activityLogs.put({
      id: `log-lele-cut-${Date.now()}`,
      moduleId: partialCutBatch.moduleId,
      containerId: partialCutBatch.containerId,
      subjectId: partialCutBatch.id,
      activityType: "FINISH_FASTING_CUT",
      quantity: qty,
      note: `Ambil / potong ${qty} ekor lele dari ${activeContainer?.name} (Sisa di ember: ${remaining} ekor)`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    triggerToast(
      isLudes
        ? `🎉 Semua (${qty} ekor) lele selesai dipotong! Ember sekarang kosong.`
        : `🔪 Berhasil ambil ${qty} ekor lele! Sisa di ember: ${remaining} ekor.`
    );

    setPartialCutBatch(null);
  };

  const handlePopulateVacantSlot = async (slot: LocalContainer, e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = `subj-ayam-new-${Date.now().toString().slice(-4)}`;
    await localDb.containers.update(slot.id, { status: "ACTIVE" });
    await localDb.subjects.put({
      id: newId,
      moduleId: slot.moduleId,
      containerId: slot.id,
      label: `Ayam Baru`,
      populationCount: 1,
      currentNodeId: "ayam-node-2",
      consecutiveZeroYieldDays: 0,
      isRecommendedForCut: false,
      isActive: true,
      fedToday: false,
      eggHarvestedToday: false,
    });
    await localDb.activityLogs.put({
      id: `log-pop-${Date.now()}`,
      moduleId: slot.moduleId,
      containerId: slot.id,
      subjectId: newId,
      activityType: "POPULATE_SUBJECT",
      quantity: 1,
      note: `Isi ayam baru ke ${slot.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
    triggerToast(`Ayam baru dimasukkan ke ${slot.name}!`);
  };

  const handleConfirmMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceSlotId) return;
    const target = containers.find((c) => c.id === maintenanceSlotId);
    if (!target) return;

    const occupant = subjects.find(
      (s) => s.containerId === target.id && s.isActive
    );

    if (occupant && evacuateTargetSlotId) {
      await localDb.subjects.update(occupant.id, {
        containerId: evacuateTargetSlotId,
      });
      await localDb.containers.update(evacuateTargetSlotId, {
        status: "ACTIVE",
      });
      await localDb.activityLogs.put({
        id: `log-evac-${Date.now()}`,
        moduleId: target.moduleId,
        containerId: evacuateTargetSlotId,
        subjectId: occupant.id,
        activityType: "EVACUATE_SUBJECT",
        quantity: 1,
        note: `Evakuasi ${occupant.label} dari ${target.name} ke slot lain karena rusak`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    await localDb.containers.update(target.id, {
      status: "MAINTENANCE",
      maintenanceNote: maintenanceNote.trim() || "Perbaikan",
    });

    await localDb.activityLogs.put({
      id: `log-maint-set-${Date.now()}`,
      moduleId: target.moduleId,
      containerId: target.id,
      activityType: "MAINTENANCE_SET",
      quantity: 1,
      note: `${target.name} ditandai Rusak: ${maintenanceNote.trim() || "Perbaikan"}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setMaintenanceSlotId(null);
    setMaintenanceNote("");
    setEvacuateTargetSlotId("");
    triggerToast(`${target.name} ditandai Rusak.`);
  };

  const handleResolveMaintenance = async (target: LocalContainer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const hasOccupant = subjects.some(
      (s) => s.containerId === target.id && s.isActive
    );
    await localDb.containers.update(target.id, {
      status: hasOccupant ? "ACTIVE" : "VACANT",
      maintenanceNote: undefined,
    });
    await localDb.activityLogs.put({
      id: `log-maint-res-${Date.now()}`,
      moduleId: target.moduleId,
      containerId: target.id,
      activityType: "MAINTENANCE_RESOLVED",
      quantity: 1,
      note: `Perbaikan selesai: ${target.name} aktif kembali`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });
    triggerToast(`${target.name} aktif kembali!`);
  };

  const handleMoveLeleToFasting = async (pond: LocalContainer) => {
    const pondSubject = subjects.find(
      (s) => s.containerId === pond.id && s.isActive
    );
    const bucket = containers.find(
      (c) => c.containerType === "QUARANTINE_BUCKET"
    );
    if (!pondSubject || !bucket) return;

    const qty = Math.min(fastingCountInput, pondSubject.populationCount);
    if (qty <= 0) return;

    const now = new Date();
    const ends72h = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    await localDb.subjects.update(pondSubject.id, {
      populationCount: pondSubject.populationCount - qty,
    });

    await localDb.subjects.put({
      id: `subj-fasting-${Date.now()}`,
      moduleId: pond.moduleId,
      containerId: bucket.id,
      label: `Sortir ${pond.name} (${qty} Ekor)`,
      populationCount: qty,
      sizeCategory: "READY_TO_CUT",
      currentNodeId: "lele-node-3",
      consecutiveZeroYieldDays: 0,
      isRecommendedForCut: false,
      timerStartedAt: now.toISOString(),
      timerEndsAt: ends72h.toISOString(),
      isActive: true,
    });

    triggerToast(`${qty} ekor lele mulai puasa 3 hari!`);
    onSelectCode(bucket.code);
  };

  const isFirst = activeIndex <= 0;
  const isLast = activeIndex >= scanTargets.length - 1;

  return (
    <div className="flex flex-col bg-white">
      {/* 1. TOP NAVIGASI CEPAT ANTAR SET (PREV & NEXT FLEX LEGA DENGAN PADDING) */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-slate-200 bg-slate-50 px-3 py-2.5">
        <button
          onClick={handlePrevTarget}
          disabled={isFirst}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 py-3 text-sm font-black transition active:scale-95 ${
            isFirst
              ? "border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed"
              : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
          }`}
        >
          <ChevronLeft className="h-5 w-5 shrink-0 stroke-[3]" />
          <span>Sebelumnya</span>
        </button>

        <div className="shrink-0 rounded-xl bg-white px-3 py-2 border border-slate-200 text-center text-xs font-black text-slate-600 shadow-xs">
          {activeIndex + 1} / {scanTargets.length}
        </div>

        <button
          onClick={handleNextTarget}
          disabled={isLast}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 py-3 text-sm font-black transition active:scale-95 ${
            isLast
              ? "border-slate-200 bg-slate-100 text-slate-300 cursor-not-allowed"
              : "border-slate-300 bg-white text-slate-900 hover:bg-slate-100 shadow-sm"
          }`}
        >
          <span>Berikutnya</span>
          <ChevronRight className="h-5 w-5 shrink-0 stroke-[3]" />
        </button>
      </div>

      {/* 2. MAIN BODY (KOTAK-KOTAK KANDANG KOSONG PUTIH) */}
      <div className="p-3">
        {activeContainer?.containerType === "CAGE_SET" && (
          <>
            {/* Tombol Kasih Makan Semua di Set Ini */}
            <div className="mb-3">
              <button
                onClick={handleFeedAllActive}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-3.5 text-base font-black text-white shadow active:scale-98"
              >
                <Utensils className="h-5 w-5" />
                <span>Kasih Makan Semua ({activeContainer.name})</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {childSlots.map((slot) => {
                const occupant = subjects.find(
                  (sub) => sub.containerId === slot.id && sub.isActive
                );
                const isMaintenance = slot.status === "MAINTENANCE";
                const isVacant = slot.status === "VACANT" || !occupant;

                const isFedToday =
                  Boolean(occupant?.fedToday) &&
                  occupant?.lastFedDate === targetDateStr;
                const isEggToday =
                  Boolean(occupant?.eggHarvestedToday) &&
                  occupant?.lastEggDate === targetDateStr;

                if (isMaintenance) {
                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col justify-between rounded-3xl border-4 border-dashed border-amber-400 bg-amber-50 p-4 min-h-[160px]"
                    >
                      <div>
                        <div className="text-2xl font-black text-slate-900">
                          {slot.name}
                        </div>
                        <div className="mt-1 rounded-xl bg-amber-200 px-2.5 py-1 text-sm font-black text-amber-950 inline-block">
                          RUSAK
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleResolveMaintenance(slot, e)}
                        className="mt-3 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white active:scale-95"
                      >
                        Selesai Perbaikan
                      </button>
                    </div>
                  );
                }

                if (isVacant) {
                  return (
                    <div
                      key={slot.id}
                      className="flex flex-col justify-between rounded-3xl border-4 border-dashed border-slate-200 bg-slate-50 p-4 min-h-[160px]"
                    >
                      <div>
                        <div className="text-2xl font-black text-slate-400">
                          {slot.name}
                        </div>
                        <div className="mt-1 text-base font-bold text-slate-400">
                          (Kosong)
                        </div>
                      </div>
                      <button
                        onClick={(e) => handlePopulateVacantSlot(slot, e)}
                        className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-300 bg-white py-3 text-sm font-black text-slate-700 active:scale-95"
                      >
                        <Plus className="h-4 w-4" /> Isi Ayam
                      </button>
                    </div>
                  );
                }

                return (
                  <div
                    key={slot.id}
                    className={`flex flex-col justify-between rounded-3xl border-4 p-4 min-h-[160px] transition ${
                      isEggToday
                        ? "border-emerald-600 bg-emerald-50/70 shadow-sm"
                        : "border-slate-300 bg-white shadow-sm"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-2xl font-black text-slate-900">
                          {slot.name}
                        </span>
                        {occupant?.isRecommendedForCut && (
                          <div className="text-xs font-black text-rose-600">
                            ⚠️ Afkir ({occupant.consecutiveZeroYieldDays} hr)
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => setMaintenanceSlotId(slot.id)}
                        title="Lapor Rusak"
                        className="rounded-xl border border-slate-200 p-1.5 text-slate-400 hover:text-rose-600"
                      >
                        <Wrench className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <button
                        onClick={(e) => handleToggleFeedSlot(slot, e)}
                        className={`flex min-h-[52px] w-full flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl border-2 px-2 py-2 text-xs sm:text-sm font-black transition active:scale-95 leading-tight text-center ${
                          isFedToday
                            ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                            : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <Utensils className="h-4 w-4 shrink-0" />
                        <span className="break-words">{isFedToday ? "Sudah Makan" : "Beri Makan"}</span>
                      </button>

                      <button
                        onClick={(e) => handleToggleEggSlot(slot, e)}
                        className={`flex min-h-[52px] w-full flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 rounded-2xl border-2 px-2 py-2 text-xs sm:text-sm font-black transition active:scale-95 leading-tight text-center ${
                          isEggToday
                            ? "border-amber-500 bg-amber-400 text-slate-950 shadow-xs"
                            : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-amber-100"
                        }`}
                      >
                        <Egg className="h-4 w-4 shrink-0" />
                        <span className="break-words">{isEggToday ? "ADA TELUR" : "Ada Telur?"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeContainer?.containerType === "POND" && (
          <div className="space-y-4 rounded-3xl border-2 border-slate-200 bg-slate-50 p-5">
            {(() => {
              const pondBatch = subjects.find(
                (s) => s.containerId === activeContainer.id && s.isActive
              );
              return (
                <>
                  <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                    <div className="text-base font-bold text-slate-600">
                      Populasi Ikan Lele
                    </div>
                    <div className="text-4xl font-black text-sky-900">
                      {pondBatch?.populationCount || 0} Ekor
                    </div>
                  </div>

                  <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4">
                    <div className="text-lg font-black text-amber-950">
                      Ambil ke Ember Puasa 3 Hari:
                    </div>
                    <div className="mt-3 flex gap-3">
                      <input
                        type="number"
                        min={1}
                        max={pondBatch?.populationCount || 500}
                        value={fastingCountInput}
                        onChange={(e) => setFastingCountInput(Number(e.target.value))}
                        className="w-28 rounded-2xl border-2 border-slate-400 bg-white px-3 py-3 text-center text-xl font-black text-slate-900"
                      />
                      <button
                        onClick={() => handleMoveLeleToFasting(activeContainer)}
                        className="flex-1 rounded-2xl bg-amber-500 py-3.5 text-lg font-black text-slate-950 shadow active:scale-95"
                      >
                        Mulai Puasa
                      </button>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeContainer?.containerType === "QUARANTINE_BUCKET" && (
          <div className="space-y-4">
            {subjects
              .filter(
                (s) => s.containerId === activeContainer.id && s.isActive
              )
              .map((batch) => {
                const nowMs = Date.now();
                const endMs = batch.timerEndsAt
                  ? new Date(batch.timerEndsAt).getTime()
                  : nowMs;
                const remainingHours = Math.max(
                  0,
                  Math.ceil((endMs - nowMs) / (1000 * 60 * 60))
                );
                const isReadyToCut = remainingHours === 0;

                return (
                  <div
                    key={batch.id}
                    className={`rounded-3xl border-4 p-5 ${
                      isReadyToCut
                        ? "border-emerald-600 bg-emerald-50"
                        : "border-amber-500 bg-amber-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-black text-slate-900">
                        {batch.label}
                      </span>
                      <span className="rounded-xl bg-slate-900 px-3 py-1 text-base font-black text-white">
                        {batch.populationCount} Ekor
                      </span>
                    </div>

                    <div className="mt-4 rounded-2xl bg-white p-4">
                      {isReadyToCut ? (
                        <div className="text-xl font-black text-emerald-800">
                          🟢 SUDAH 3 HARI — SIAP POTONG!
                        </div>
                      ) : (
                        <div>
                          <div className="text-sm font-black text-rose-700">
                            🔴 SEDANG PUASA (JANGAN DIPOTONG)
                          </div>
                          <div className="mt-1 text-2xl font-black text-slate-900">
                            Sisa: {remainingHours} Jam (~
                            {Math.ceil(remainingHours / 24)} Hari)
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setPartialCutBatch(batch);
                        setCutQuantityInput(Math.min(5, batch.populationCount));
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 text-lg font-black text-white shadow active:scale-95 hover:bg-emerald-800"
                    >
                      <Scissors className="h-6 w-6" /> Ambil / Potong Lele
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {/* VIEW D: JIKA WADAH CUSTOM / MODUL BARU LAINNYA (BATCH / TANAMAN / DLL) */}
        {activeContainer?.containerType === "CUSTOM" && (
          <div className="space-y-4 rounded-3xl border-2 border-slate-200 bg-slate-50 p-5">
            {(() => {
              const customBatch = subjects.find(
                (s) => s.containerId === activeContainer.id && s.isActive
              );

              return (
                <>
                  <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                    <div className="text-xs font-black uppercase tracking-wider text-slate-500">
                      STATUS AREA AKTIF
                    </div>
                    <div className="text-3xl font-black text-slate-900 mt-1">
                      {customBatch?.label || activeContainer.name}
                    </div>
                    <div className="mt-2 inline-block rounded-xl bg-emerald-100 px-4 py-1.5 text-lg font-black text-emerald-950">
                      Populasi: {customBatch?.populationCount || 0} Unit
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      onClick={async () => {
                        triggerToast(`Rutin harian untuk ${activeContainer.name} selesai!`);
                      }}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 text-base font-black text-white shadow active:scale-98"
                    >
                      <Utensils className="h-5 w-5" />
                      <span>Selesai Rawat / Siram</span>
                    </button>

                    <button
                      onClick={() => setMaintenanceSlotId(activeContainer.id)}
                      className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-white py-4 text-base font-black text-slate-800 hover:bg-slate-100 active:scale-98"
                    >
                      <Wrench className="h-5 w-5 text-rose-600" />
                      <span>Lapor Kendala / Rusak</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* MODAL LAPOR RUSAK */}
      {maintenanceSlotId && (
        <div
          onClick={() => setMaintenanceSlotId(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmMaintenance}
            className="w-full max-w-md rounded-3xl border-4 border-amber-500 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-xl font-black text-slate-900">
              🛠️ Lapor Kandang Rusak
            </h3>

            <div className="mt-3 space-y-3">
              <div>
                <label className="block text-sm font-extrabold text-slate-700">
                  Keterangan Kerusakan:
                </label>
                <input
                  type="text"
                  required
                  value={maintenanceNote}
                  onChange={(e) => setMaintenanceNote(e.target.value)}
                  placeholder="Misal: Kawat patah"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3 py-3 text-base font-bold text-slate-900"
                />
              </div>

              {allVacantSlots.length > 0 && (
                <div>
                  <label className="block text-sm font-extrabold text-slate-700">
                    Pindah Ayam ke Kandang Kosong:
                  </label>
                  <select
                    value={evacuateTargetSlotId}
                    onChange={(e) => setEvacuateTargetSlotId(e.target.value)}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3 py-3 text-base font-bold text-slate-900"
                  >
                    <option value="">-- Jangan dipindah --</option>
                    {allVacantSlots.map((vs) => (
                      <option key={vs.id} value={vs.id}>
                        {vs.name} ({vs.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setMaintenanceSlotId(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-base font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-amber-500 py-3 text-base font-black text-slate-950"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP MODAL: AMBIL / POTONG LELE SECARA PARSIAL */}
      {partialCutBatch && (
        <div
          onClick={() => setPartialCutBatch(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleConfirmPartialCut}
            className="w-full max-w-sm rounded-3xl border-3 border-emerald-600 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-emerald-800 border-b-2 border-slate-200 pb-3">
              <Scissors className="h-6 w-6 shrink-0" />
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  Ambil / Potong Lele
                </h3>
                <p className="text-xs font-bold text-slate-500">
                  Total di ember saat ini:{" "}
                  <strong className="text-slate-900">
                    {partialCutBatch.populationCount} ekor
                  </strong>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                Berapa ekor yang diambil hari ini?
              </label>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setCutQuantityInput((prev) => Math.max(1, prev - 1))
                  }
                  className="h-12 w-12 rounded-2xl border-2 border-slate-300 bg-slate-100 text-2xl font-black text-slate-800 hover:bg-slate-200 active:scale-95 flex items-center justify-center"
                >
                  -
                </button>
                <input
                  type="number"
                  min={1}
                  max={partialCutBatch.populationCount}
                  value={cutQuantityInput}
                  onChange={(e) => setCutQuantityInput(Number(e.target.value))}
                  className="flex-1 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 py-2.5 text-center text-3xl font-black text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() =>
                    setCutQuantityInput((prev) =>
                      Math.min(partialCutBatch.populationCount, prev + 1)
                    )
                  }
                  className="h-12 w-12 rounded-2xl border-2 border-slate-300 bg-slate-100 text-2xl font-black text-slate-800 hover:bg-slate-200 active:scale-95 flex items-center justify-center"
                >
                  +
                </button>
              </div>

              {/* Tombol Cepat Pilihan Jumlah */}
              <div className="flex gap-2 pt-1">
                {[5, 10, partialCutBatch.populationCount].map((qty, idx) => {
                  if (qty > partialCutBatch.populationCount && idx < 2) return null;
                  const label =
                    idx === 2
                      ? `Semua (${qty})`
                      : `${qty} Ekor`;

                  return (
                    <button
                      key={qty}
                      type="button"
                      onClick={() => setCutQuantityInput(qty)}
                      className={`flex-1 rounded-xl py-2 text-xs font-black border transition active:scale-95 ${
                        cutQuantityInput === qty
                          ? "border-emerald-700 bg-emerald-100 text-emerald-950 font-black shadow-xs"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 text-xs font-bold text-slate-600 border border-slate-200">
                Sisa di ember setelah diambil:{" "}
                <strong className="text-emerald-800">
                  {Math.max(0, partialCutBatch.populationCount - cutQuantityInput)}{" "}
                  ekor
                </strong>
                {partialCutBatch.populationCount - cutQuantityInput === 0 && (
                  <span className="block text-slate-500 mt-0.5">
                    (Ember akan otomatis kosong & siap dipakai lagi)
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setPartialCutBatch(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-base font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-base font-black text-white active:scale-95 hover:bg-emerald-800 shadow-sm"
              >
                Konfirmasi Potong
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
