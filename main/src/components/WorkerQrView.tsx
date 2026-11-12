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

interface WorkerQrViewProps {
  containers: LocalContainer[];
  subjects: LocalSubject[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
}

export function WorkerQrView({
  containers,
  subjects,
  selectedCode,
  onSelectCode,
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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayDateStr = getTodayDateStr();

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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
          lastFedDate: todayDateStr,
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
      Boolean(occupant.fedToday) && occupant.lastFedDate === todayDateStr;
    const nextFed = !isFedToday;

    await localDb.subjects.update(occupant.id, {
      fedToday: nextFed,
      lastFedDate: nextFed ? todayDateStr : undefined,
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
      occupant.lastEggDate === todayDateStr;
    const nextEggState = !isHarvestedToday;
    const newZeroDays = nextEggState ? 0 : occupant.consecutiveZeroYieldDays;

    await localDb.subjects.update(occupant.id, {
      eggHarvestedToday: nextEggState,
      lastEggDate: nextEggState ? todayDateStr : undefined,
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
    }

    await localDb.containers.update(target.id, {
      status: "MAINTENANCE",
      maintenanceNote: maintenanceNote.trim() || "Perbaikan",
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
      {/* TOAST NOTIFIKASI KECIL DI ATAS */}
      {toastMessage && (
        <div className="mx-4 mt-2 rounded-2xl bg-slate-900 px-4 py-3 text-center text-base font-bold text-white shadow-lg">
          {toastMessage}
        </div>
      )}

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
                  occupant?.lastFedDate === todayDateStr;
                const isEggToday =
                  Boolean(occupant?.eggHarvestedToday) &&
                  occupant?.lastEggDate === todayDateStr;

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
                        className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm sm:text-base font-black transition active:scale-95 ${
                          isFedToday
                            ? "border-emerald-700 bg-emerald-700 text-white shadow-xs"
                            : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        <Utensils className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="truncate">{isFedToday ? "Sudah Makan" : "Beri Makan"}</span>
                      </button>

                      <button
                        onClick={(e) => handleToggleEggSlot(slot, e)}
                        className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 text-sm sm:text-base font-black transition active:scale-95 ${
                          isEggToday
                            ? "border-amber-500 bg-amber-400 text-slate-950 shadow-xs"
                            : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-amber-100"
                        }`}
                      >
                        <Egg className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
                        <span className="truncate">{isEggToday ? "ADA TELUR" : "Ada Telur?"}</span>
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
                      onClick={async () => {
                        await localDb.subjects.update(batch.id, {
                          isActive: false,
                        });
                        triggerToast(`Lele selesai dipotong!`);
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 py-4 text-lg font-black text-white shadow active:scale-95"
                    >
                      <Scissors className="h-6 w-6" /> Selesai Potong
                    </button>
                  </div>
                );
              })}
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
    </div>
  );
}
