"use client";

import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  QrCode,
  Egg,
  Utensils,
  Wrench,
  CheckCircle2,
  Timer,
  ArrowLeftRight,
  Scissors,
  Plus,
  AlertOctagon,
} from "lucide-react";
import {
  localDb,
  type LocalContainer,
  type LocalSubject,
} from "@/lib/offline-db";

interface WorkerQrViewProps {
  containers: LocalContainer[];
  subjects: LocalSubject[];
}

export function WorkerQrView({ containers, subjects }: WorkerQrViewProps) {
  // Filter scan targets: 6 Set Kandang Ayam + 3 Kolam Lele + 1 Ember Puasa
  const scanTargets = containers.filter(
    (c) =>
      c.containerType === "CAGE_SET" ||
      c.containerType === "POND" ||
      c.containerType === "QUARANTINE_BUCKET"
  );

  const [selectedCode, setSelectedCode] = useState<string>("SET-1A");
  const [showQrModal, setShowQrModal] = useState<boolean>(false);
  const [maintenanceSlotId, setMaintenanceSlotId] = useState<string | null>(
    null
  );
  const [maintenanceNote, setMaintenanceNote] = useState<string>("");
  const [evacuateTargetSlotId, setEvacuateTargetSlotId] = useState<string>("");
  const [fastingCountInput, setFastingCountInput] = useState<number>(20);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3200);
  };

  const activeContainer =
    scanTargets.find((c) => c.code === selectedCode) || scanTargets[0];

  // Child slots if this is a CAGE_SET (e.g. Set Kandang 1A -> 6 Slots)
  const childSlots = containers
    .filter((c) => c.parentId === activeContainer?.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // All vacant chicken slots across the farm (for evacuating a chicken when a cage breaks)
  const allVacantSlots = containers.filter(
    (c) => c.containerType === "CAGE_SLOT" && c.status === "VACANT"
  );

  // One-Tap: Feed All Active Chickens in this Set (Auto-skip VACANT & MAINTENANCE!)
  const handleFeedSet = async () => {
    if (!activeContainer) return;
    const activeSlots = childSlots.filter((s) => s.status === "ACTIVE");
    const skippedCount = childSlots.length - activeSlots.length;

    const nowIso = new Date().toISOString();
    for (const slot of activeSlots) {
      const occupant = subjects.find(
        (sub) => sub.containerId === slot.id && sub.isActive
      );
      if (occupant) {
        await localDb.subjects.update(occupant.id, { fedToday: true });
        await localDb.activityLogs.put({
          id: `log-feed-${slot.id}-${Date.now()}`,
          moduleId: slot.moduleId,
          containerId: slot.id,
          subjectId: occupant.id,
          activityType: "FEED",
          quantity: 1,
          note: `Kasih makan via scan ${activeContainer.code} (Auto-skip kosong/rusak)`,
          performedAt: nowIso,
          syncedToCloud: false,
        });
      }
    }

    triggerToast(
      `🍚 Berhasil kasih makan ${activeSlots.length} kandang aktif! (${skippedCount} kandang kosong/maintenance otomatis di-skip)`
    );
  };

  // One-Tap: Toggle Egg Harvest for a specific chicken slot
  const handleToggleEgg = async (slot: LocalContainer) => {
    if (slot.status !== "ACTIVE") return;
    const occupant = subjects.find(
      (sub) => sub.containerId === slot.id && sub.isActive
    );
    if (!occupant) return;

    const nextEggState = !occupant.eggHarvestedToday;
    const newZeroDays = nextEggState ? 0 : occupant.consecutiveZeroYieldDays;

    await localDb.subjects.update(occupant.id, {
      eggHarvestedToday: nextEggState,
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
        note: `Panen 1 butir telur dari ${slot.name}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
      triggerToast(`🥚 +1 Telur dicatat dari ${slot.name} (${occupant.label})`);
    }
  };

  // Add new chicken to a VACANT slot
  const handlePopulateVacantSlot = async (slot: LocalContainer) => {
    const newId = `subj-ayam-new-${Date.now().toString().slice(-4)}`;
    await localDb.containers.update(slot.id, { status: "ACTIVE" });
    await localDb.subjects.put({
      id: newId,
      moduleId: slot.moduleId,
      containerId: slot.id,
      label: `Ayam Baru (${slot.name})`,
      populationCount: 1,
      currentNodeId: "ayam-node-2",
      consecutiveZeroYieldDays: 0,
      isRecommendedForCut: false,
      isActive: true,
      fedToday: false,
      eggHarvestedToday: false,
    });
    triggerToast(`🐓 Ayam baru berhasil dimasukkan ke ${slot.name}!`);
  };

  // Upgrade Layout: Dynamically add a new Cage Slot to this Cage Set without breaking history
  const handleUpgradeAddSlot = async () => {
    if (!activeContainer) return;
    const nextOrder = childSlots.length + 1;
    const newSlotId = `${activeContainer.id}-slot-${nextOrder}-${Date.now().toString().slice(-3)}`;
    await localDb.containers.put({
      id: newSlotId,
      parentId: activeContainer.id,
      moduleId: activeContainer.moduleId,
      name: `Kandang Upgrade #${activeContainer.code}-${nextOrder}`,
      code: `${activeContainer.code}-${nextOrder}`,
      containerType: "CAGE_SLOT",
      status: "VACANT",
      sortOrder: nextOrder,
    });
    triggerToast(
      `✨ Layout di-upgrade! Slot baru ditambahkan ke ${activeContainer.name} tanpa mengubah histori lama.`
    );
  };

  // Set Maintenance / Broken Cage or Leaking Pond + Evacuate Occupant if needed
  const handleConfirmMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceSlotId) return;
    const targetContainer = containers.find((c) => c.id === maintenanceSlotId);
    if (!targetContainer) return;

    const occupant = subjects.find(
      (s) => s.containerId === targetContainer.id && s.isActive
    );

    if (occupant && evacuateTargetSlotId) {
      // Evacuate chicken/fish to another vacant slot/pond while preserving subject history!
      await localDb.subjects.update(occupant.id, {
        containerId: evacuateTargetSlotId,
      });
      await localDb.containers.update(evacuateTargetSlotId, {
        status: "ACTIVE",
      });
      await localDb.activityLogs.put({
        id: `log-evac-${Date.now()}`,
        moduleId: targetContainer.moduleId,
        containerId: targetContainer.id,
        subjectId: occupant.id,
        activityType: "EVACUATE_SUBJECT",
        quantity: occupant.populationCount,
        note: `Evakuasi ${occupant.label} karena ${targetContainer.name} maintenance: ${maintenanceNote}`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    await localDb.containers.update(targetContainer.id, {
      status: "MAINTENANCE",
      maintenanceNote:
        maintenanceNote.trim() || "Rusak / Bocor (Sedang Diperbaiki)",
    });

    setMaintenanceSlotId(null);
    setMaintenanceNote("");
    setEvacuateTargetSlotId("");
    triggerToast(
      `🛠️ ${targetContainer.name} ditandai MAINTENANCE (Otomatis di-skip saat kasih makan).`
    );
  };

  // Resolve Maintenance -> back to VACANT (or ACTIVE if still occupied)
  const handleResolveMaintenance = async (container: LocalContainer) => {
    const hasOccupant = subjects.some(
      (s) => s.containerId === container.id && s.isActive
    );
    await localDb.containers.update(container.id, {
      status: hasOccupant ? "ACTIVE" : "VACANT",
      maintenanceNote: undefined,
    });
    triggerToast(`✅ ${container.name} selesai diperbaiki & aktif kembali!`);
  };

  // Lele Sortir & Move to 3-Day Fasting Bucket
  const handleMoveLeleToFastingBucket = async (pond: LocalContainer) => {
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
      label: `Sortiran ${pond.name} (${qty} Ekor)`,
      populationCount: qty,
      sizeCategory: "READY_TO_CUT",
      currentNodeId: "lele-node-3",
      consecutiveZeroYieldDays: 0,
      isRecommendedForCut: false,
      timerStartedAt: now.toISOString(),
      timerEndsAt: ends72h.toISOString(),
      isActive: true,
    });

    triggerToast(
      `⏳ ${qty} ekor lele dipindah ke Ember Kecil! Timer Puasa 3 Hari (72 Jam) dimulai.`
    );
    setSelectedCode(bucket.code);
  };

  return (
    <div className="space-y-5">
      {/* Top Bar: Simulated QR Scanner Selector + Print QR Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <QrCode className="h-4 w-4" /> Pilih / Simulasi Scan QR Lokasi:
          </span>
          {scanTargets.map((target) => (
            <button
              key={target.id}
              onClick={() => setSelectedCode(target.code)}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                selectedCode === target.code
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/25"
                  : target.containerType === "QUARANTINE_BUCKET"
                    ? "border border-orange-500/40 bg-orange-950/40 text-orange-300 hover:bg-orange-900/50"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {target.code}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowQrModal(!showQrModal)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
        >
          <QrCode className="h-4 w-4 text-emerald-400" />
          {showQrModal ? "Tutup Stiker QR" : "Lihat / Cetak QR Lokasi Ini"}
        </button>
      </div>

      {/* Feedback Toast Banner */}
      {feedbackToast && (
        <div className=" flex items-center gap-2 rounded-2xl border border-emerald-500/50 bg-emerald-950/90 px-4 py-3 text-sm font-semibold text-emerald-200 shadow-xl">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Printable QR Sticker Preview */}
      {showQrModal && activeContainer && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-white p-6 text-slate-900 shadow-2xl sm:flex-row sm:gap-8">
          <QRCodeSVG
            value={`${typeof window !== "undefined" ? window.location.origin : "https://cymfarm.local"}/?scan=${activeContainer.code}`}
            size={150}
            level="H"
            includeMargin
          />
          <div className="mt-4 text-center sm:mt-0 sm:text-left">
            <div className="text-xs font-bold uppercase tracking-widest text-emerald-700">
              STIKER QR TEMPEL KANDANG / KOLAM
            </div>
            <h3 className="mt-1 text-2xl font-black">{activeContainer.name}</h3>
            <p className="mt-1 font-mono text-sm text-slate-600">
              Kode Scan: <strong>{activeContainer.code}</strong>
            </p>
            <p className="mt-2 max-w-md text-xs text-slate-500">
              Tempel QR ini di {activeContainer.name}. Saat di-scan kamera HP oleh
              keluarga atau tukang, halaman tombol besar di bawah langsung terbuka
              (tetap jalan meskipun sinyal offline).
            </p>
          </div>
        </div>
      )}

      {/* =====================================================================
          CASE 1: WORKER UI FOR CAGE SET (1 Set Kandang = 6 Ayam Berjejer)
         ===================================================================== */}
      {activeContainer?.containerType === "CAGE_SET" && (
        <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
                MODE LAPANGAN • QR: {activeContainer.code}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold text-white">
                {activeContainer.name} ({childSlots.length} Slot Kandang)
              </h2>
              <p className="text-xs text-slate-400">
                Kasih makan & panen telur tidak harus bareng. Kandang kosong atau
                rusak otomatis di-skip!
              </p>
            </div>

            {/* BIG BUTTON: FEED ALL ACTIVE IN THIS SET */}
            <button
              onClick={handleFeedSet}
              className="flex items-center gap-3 rounded-2xl bg-emerald-500 px-6 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/20 transition active:scale-95 hover:bg-emerald-400"
            >
              <Utensils className="h-6 w-6" />
              <div>
                <div>
                  🍚 KASIH MAKAN SET INI (
                  {childSlots.filter((s) => s.status === "ACTIVE").length} AYAM
                  AKTIF)
                </div>
                <div className="text-[11px] font-semibold opacity-80">
                  Auto-skip{" "}
                  {childSlots.filter((s) => s.status !== "ACTIVE").length} slot
                  kosong/maintenance
                </div>
              </div>
            </button>
          </div>

          {/* 6-SLOT ROW GRID (Sesuai posisi berjejer di atas kolam lele) */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-200">
                Tap Kandang yang Ada Telurnya Hari Ini (Atau Lapor Kandang Rusak):
              </h3>
              <button
                onClick={handleUpgradeAddSlot}
                className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-slate-700"
              >
                <Plus className="h-3.5 w-3.5" /> Upgrade Layout (+1 Slot Kandang)
              </button>
            </div>

            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {childSlots.map((slot) => {
                const occupant = subjects.find(
                  (sub) => sub.containerId === slot.id && sub.isActive
                );
                const isMaintenance = slot.status === "MAINTENANCE";
                const isVacant = slot.status === "VACANT" || !occupant;

                return (
                  <div
                    key={slot.id}
                    className={`flex flex-col justify-between rounded-2xl border-2 p-4 transition ${
                      isMaintenance
                        ? "border-orange-500/60 bg-orange-950/25"
                        : isVacant
                          ? "border-dashed border-slate-700 bg-slate-950/50 opacity-75"
                          : occupant?.eggHarvestedToday
                            ? "border-amber-400 bg-amber-950/30 shadow-lg shadow-amber-500/10"
                            : "border-slate-800 bg-slate-950/90"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-extrabold text-white">
                          {slot.name}
                        </span>
                        <span
                          className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold ${
                            isMaintenance
                              ? "bg-orange-500/20 text-orange-300"
                              : isVacant
                                ? "bg-slate-800 text-slate-400"
                                : "bg-emerald-500/20 text-emerald-300"
                          }`}
                        >
                          {isMaintenance
                            ? "🚧 MAINTENANCE"
                            : isVacant
                              ? "⚪ KOSONG (AUTO-SKIP)"
                              : `🟢 ${occupant.label}`}
                        </span>
                      </div>

                      {/* Occupant Info or Maintenance Note */}
                      {isMaintenance && (
                        <p className="mt-2 rounded-xl bg-orange-500/10 p-2.5 text-xs text-orange-200">
                          🛠️ <strong>Catatan Rusak:</strong>{" "}
                          {slot.maintenanceNote}
                        </p>
                      )}

                      {!isVacant && !isMaintenance && occupant && (
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={`rounded-lg px-2 py-1 font-semibold ${
                              occupant.fedToday
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {occupant.fedToday
                              ? "✅ Sudah Makan Hari Ini"
                              : "⏳ Belum Makan"}
                          </span>

                          {occupant.isRecommendedForCut && (
                            <span className="flex items-center gap-1 rounded-lg bg-rose-500/20 px-2 py-1 font-bold text-rose-300">
                              <AlertOctagon className="h-3.5 w-3.5" /> Stop Nelor{" "}
                              {occupant.consecutiveZeroYieldDays} hr (Siap Potong)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons inside each Slot Card */}
                    <div className="mt-4 space-y-2">
                      {!isVacant && !isMaintenance && occupant && (
                        <button
                          onClick={() => handleToggleEgg(slot)}
                          className={`flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-black transition active:scale-95 ${
                            occupant.eggHarvestedToday
                              ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                              : "bg-slate-800 text-amber-300 hover:bg-slate-700"
                          }`}
                        >
                          <Egg className="h-5 w-5" />
                          {occupant.eggHarvestedToday
                            ? "🥚 ADA TELUR HARI INI (TERCATAT)"
                            : "TAP JIKA ADA TELUR HARI INI"}
                        </button>
                      )}

                      {isVacant && !isMaintenance && (
                        <button
                          onClick={() => handlePopulateVacantSlot(slot)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-900/50"
                        >
                          <Plus className="h-4 w-4" /> + Isi Ayam Baru ke Slot Ini
                        </button>
                      )}

                      {isMaintenance ? (
                        <button
                          onClick={() => handleResolveMaintenance(slot)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950"
                        >
                          <CheckCircle2 className="h-4 w-4" /> Selesai Diperbaiki
                          (Aktifkan Lagi)
                        </button>
                      ) : (
                        <button
                          onClick={() => setMaintenanceSlotId(slot.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 py-2 text-[11px] font-semibold text-slate-400 hover:bg-rose-950/50 hover:text-rose-300"
                        >
                          <Wrench className="h-3.5 w-3.5" /> Tandai Kandang Rusak /
                          Bocor
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          CASE 2: WORKER UI FOR LELE POND (Kolam 1, 2, 3 - Sortir & Maintenance)
         ===================================================================== */}
      {activeContainer?.containerType === "POND" && (
        <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-900/70 p-6">
          {(() => {
            const pondBatch = subjects.find(
              (s) => s.containerId === activeContainer.id && s.isActive
            );
            return (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-bold text-sky-400">
                      KOLAM LELE • QR: {activeContainer.code}
                    </span>
                    <h2 className="mt-2 text-2xl font-extrabold text-white">
                      {activeContainer.name}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Pakan lele otomatis dari kotoran 12 ayam (2 set kandang) di
                      atas kolam ini.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-700 bg-slate-950 px-5 py-3 text-right">
                    <div className="text-xs text-slate-400">
                      Estimasi Populasi Saat Ini
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                      {pondBatch?.populationCount || 0} Ekor
                    </div>
                  </div>
                </div>

                {activeContainer.status === "MAINTENANCE" ? (
                  <div className="rounded-2xl border border-orange-500 bg-orange-950/30 p-5">
                    <h3 className="text-base font-bold text-orange-300">
                      🚧 Kolam Sedang Maintenance / Bocor
                    </h3>
                    <p className="mt-1 text-xs text-orange-200">
                      Catatan: {activeContainer.maintenanceNote}
                    </p>
                    <button
                      onClick={() => handleResolveMaintenance(activeContainer)}
                      className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950"
                    >
                      ✅ Kolam Selesai Ditambal / Aktifkan Kembali
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Action 1: Sortir Mandiri ke Ember Puasa 3 Hari */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                      <div className="flex items-center gap-2 text-amber-400">
                        <Timer className="h-5 w-5" />
                        <h3 className="text-base font-bold text-white">
                          Sortir & Pindah ke Ember Puasa (3 Hari)
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        Dipakai saat tukang pecel lele / keluarga mandiri menyortir
                        lele besar ke ember kecil untuk dipuasakan 3 hari sebelum
                        dipotong.
                      </p>
                      <div className="mt-4 flex items-center gap-3">
                        <input
                          type="number"
                          min={1}
                          max={pondBatch?.populationCount || 500}
                          value={fastingCountInput}
                          onChange={(e) =>
                            setFastingCountInput(Number(e.target.value))
                          }
                          className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-center text-base font-bold text-white"
                        />
                        <button
                          onClick={() =>
                            handleMoveLeleToFastingBucket(activeContainer)
                          }
                          className="flex-1 rounded-xl bg-amber-400 py-3.5 text-sm font-black text-slate-950 hover:bg-amber-300"
                        >
                          ⏳ Masuk Ember & Mulai Puasa 3 Hari
                        </button>
                      </div>
                    </div>

                    {/* Action 2: Update Ukuran / Populasi Hasil Sortir Antar Kolam */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
                      <div className="flex items-center gap-2 text-sky-400">
                        <ArrowLeftRight className="h-5 w-5" />
                        <h3 className="text-base font-bold text-white">
                          Sesuaikan Jumlah / Ukuran Sortir Kolam
                        </h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        1 kolam = 1 ukuran. Jika habis sortir ukuran antar kolam,
                        sesuaikan jumlah populasi kolam ini atau lapor jika kolam
                        bocor.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={async () => {
                            if (!pondBatch) return;
                            await localDb.subjects.update(pondBatch.id, {
                              populationCount: pondBatch.populationCount + 25,
                            });
                            triggerToast(
                              `+25 ekor ditambahkan ke ${activeContainer.name}`
                            );
                          }}
                          className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-slate-700"
                        >
                          +25 Ekor (Hasil Sortir Masuk)
                        </button>
                        <button
                          onClick={async () => {
                            if (!pondBatch) return;
                            await localDb.subjects.update(pondBatch.id, {
                              populationCount: Math.max(
                                0,
                                pondBatch.populationCount - 25
                              ),
                            });
                            triggerToast(
                              `-25 ekor dipindahkan dari ${activeContainer.name}`
                            );
                          }}
                          className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-amber-300 hover:bg-slate-700"
                        >
                          -25 Ekor (Sortir Keluar)
                        </button>
                        <button
                          onClick={() => setMaintenanceSlotId(activeContainer.id)}
                          className="rounded-xl border border-rose-500/40 bg-rose-950/30 px-4 py-2.5 text-xs font-bold text-rose-300"
                        >
                          🛠️ Lapor Kolam Bocor / Maintenance
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {/* =====================================================================
          CASE 3: WORKER UI FOR EMBER PUASA LELE (72-Hour Countdown Timer)
         ===================================================================== */}
      {activeContainer?.containerType === "QUARANTINE_BUCKET" && (
        <div className="space-y-4 rounded-3xl border border-orange-500/40 bg-slate-900/80 p-6">
          <div className="border-b border-slate-800 pb-4">
            <span className="rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold text-orange-300">
              KARANTINA PUASA 3 HARI • QR: {activeContainer.code}
            </span>
            <h2 className="mt-2 text-2xl font-extrabold text-white">
              {activeContainer.name}
            </h2>
            <p className="text-xs text-slate-400">
              Lele hasil sortir dipuasakan di air bersih selama 3 hari (72 jam)
              sebelum dipotong supaya bersih dari kotoran.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                    className={`rounded-2xl border-2 p-5 ${
                      isReadyToCut
                        ? "border-emerald-500 bg-emerald-950/30"
                        : "border-orange-500/60 bg-slate-950"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-base font-bold text-white">
                        {batch.label}
                      </span>
                      <span className="rounded-xl bg-white/10 px-3 py-1 text-xs font-black text-white">
                        {batch.populationCount} Ekor
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-black/40 p-3.5">
                      {isReadyToCut ? (
                        <div className="text-sm font-black text-emerald-400">
                          🟢 SUDAH PUASA 3 HARI — SIAP DIPOTONG!
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs font-bold uppercase text-orange-300">
                            🔴 SEDANG PUASA (JANGAN DIPOTONG DULU)
                          </div>
                          <div className="mt-1 text-xl font-black text-white">
                            Sisa {remainingHours} Jam Lagi (~
                            {Math.ceil(remainingHours / 24)} Hari)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      {!isReadyToCut && (
                        <button
                          onClick={async () => {
                            await localDb.subjects.update(batch.id, {
                              timerEndsAt: new Date(
                                Date.now() - 1000
                              ).toISOString(),
                            });
                            triggerToast(
                              `⚡ Simulasi: Timer 3 hari selesai! ${batch.label} sekarang siap potong.`
                            );
                          }}
                          className="rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Simulasi Selesai 3 Hari
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          await localDb.subjects.update(batch.id, {
                            isActive: false,
                          });
                          triggerToast(
                            `🔪 ${batch.label} (${batch.populationCount} ekor) selesai dipotong!`
                          );
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-black text-slate-950 hover:bg-emerald-400"
                      >
                        <Scissors className="h-4 w-4" /> Selesai Potong / Ambil
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: REPORT MAINTENANCE / BROKEN CAGE OR POND + EVACUATE OCCUPANT
         ===================================================================== */}
      {maintenanceSlotId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleConfirmMaintenance}
            className="w-full max-w-md rounded-3xl border border-orange-500/50 bg-slate-900 p-6 shadow-2xl"
          >
            <h3 className="text-lg font-extrabold text-white">
              🛠️ Tandai Wadah Rusak / Bocor (Maintenance)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Wadah yang sedang maintenance otomatis di-skip saat kasih makan dan
              tidak bisa diisi hewan baru sampai selesai diperbaiki.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Keterangan Kerusakan (Contoh: Kolam rembes / Kawat patah)
                </label>
                <input
                  type="text"
                  required
                  value={maintenanceNote}
                  onChange={(e) => setMaintenanceNote(e.target.value)}
                  placeholder="Misal: Terpal pojok bocor, sedang ditambal"
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                />
              </div>

              {allVacantSlots.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Evakuasi Penghuni ke Kandang Kosong Lain (Opsional — Histori
                    Tetap Nyambung!)
                  </label>
                  <select
                    value={evacuateTargetSlotId}
                    onChange={(e) => setEvacuateTargetSlotId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
                  >
                    <option value="">
                      -- Biarkan di tempat / Kosongkan manual --
                    </option>
                    {allVacantSlots.map((vs) => (
                      <option key={vs.id} value={vs.id}>
                        Pindahkan ke {vs.name} ({vs.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMaintenanceSlotId(null)}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300"
              >
                Batal
              </button>
              <button
                type="submit"
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-xs font-black text-slate-950"
              >
                Simpan Status Maintenance
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
