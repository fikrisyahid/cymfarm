"use client";

import React, { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import {
  localDb,
  type LocalFarmModule,
  type LocalContainer,
  type LocalSubject,
} from "@/lib/offline-db";
import { Sparkles, Plus, Trash2, Edit2, Layers, Check, X, Box, QrCode } from "lucide-react";
import { QrViewModal } from "./QrViewModal";
import { runFarmSync } from "@/lib/sync-engine";

export function AdminModularStudio() {
  const rawModules = useLiveQuery(() => localDb.farmModules.toArray(), [], []);
  const rawContainers = useLiveQuery(() => localDb.containers.toArray(), [], []);
  const moduleCategories = useLiveQuery(
    () => localDb.farmModuleCategories.toArray(),
    [],
    []
  );

  // Filter hanya yang aktif (tidak soft deleted)
  const modules = (rawModules || []).filter((m) => !m.deletedAt);
  const containers = (rawContainers || []).filter((c) => !c.deletedAt);

  const [showModal, setShowModal] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // Modal QR Code View/Download
  const [selectedQrContainer, setSelectedQrContainer] = useState<LocalContainer | null>(null);
  const [selectedQrModule, setSelectedQrModule] = useState<LocalFarmModule | null>(null);

  // Form State
  const [modName, setModName] = useState("");
  const [modCategory, setModCategory] = useState("LIVESTOCK");
  const [trackingMode, setTrackingMode] = useState<"INDIVIDUAL" | "BATCH">("BATCH");
  const [routineActionLabel, setRoutineActionLabel] = useState("Kasih Pakan");
  const [harvestType, setHarvestType] = useState<"RECURRING" | "ONCE">("RECURRING");
  const [harvestActionLabel, setHarvestActionLabel] = useState("Panen Telur / Hasil");
  const [harvestUnitLabel, setHarvestUnitLabel] = useState("Butir");
  const [harvestAlertDays, setHarvestAlertDays] = useState<number>(2);

  // Modal Tambah Wadah Baru ke Modul Tertentu
  const [showAddContainerModal, setShowAddContainerModal] = useState(false);
  const [targetModuleForContainer, setTargetModuleForContainer] = useState<LocalFarmModule | null>(null);
  const [newContainerName, setNewContainerName] = useState("");
  const [newContainerCode, setNewContainerCode] = useState("");
  const [newContainerCapacity, setNewContainerCapacity] = useState(100);

  // Modal CRUD Kategori Modul Baru
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🍄");

  // Wadah Fisik Awal saat buat modul baru
  const [containerName, setContainerName] = useState("");
  const [containerCode, setContainerCode] = useState("");
  const [containerCapacity, setContainerCapacity] = useState(100);

  const handleOpenCreate = () => {
    setEditingModuleId(null);
    setModName("");
    setModCategory("LIVESTOCK");
    setTrackingMode("BATCH");
    setRoutineActionLabel("Kasih Pakan");
    setHarvestType("RECURRING");
    setHarvestActionLabel("Panen Telur / Hasil");
    setHarvestUnitLabel("Butir");
    setHarvestAlertDays(2);
    setContainerName("Wadah Utama A");
    setContainerCode("WADAH-A");
    setContainerCapacity(100);
    setShowModal(true);
  };

  const handleOpenEditModule = (m: LocalFarmModule) => {
    setEditingModuleId(m.id);
    setModName(m.name);
    setModCategory(m.category);
    setTrackingMode(m.trackingMode);
    setRoutineActionLabel(m.config.routineActionLabel);
    setHarvestType(m.config.harvestType);
    setHarvestActionLabel(m.config.harvestActionLabel);
    setHarvestUnitLabel(m.config.harvestUnitLabel || "Butir");
    setHarvestAlertDays(m.config.harvestAlertDays ?? (m.config.harvestType === "RECURRING" ? 2 : 0));
    setShowModal(true);
  };

  // Handler Tambah Wadah Baru ke Modul
  const handleOpenAddContainer = (m: LocalFarmModule) => {
    setTargetModuleForContainer(m);
    const existingCount = (containers || []).filter((c) => c.moduleId === m.id).length;
    setNewContainerName(`Wadah ${existingCount + 1}`);
    setNewContainerCode(`WADAH-${existingCount + 1}`);
    setNewContainerCapacity(100);
    setShowAddContainerModal(true);
  };

  const handleSaveNewContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetModuleForContainer || !newContainerName.trim() || !newContainerCode.trim()) return;

    const cleanCode = newContainerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const contId = `cont-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    const newCont: LocalContainer = {
      id: contId,
      moduleId: targetModuleForContainer.id,
      name: newContainerName.trim(),
      code: cleanCode,
      capacity: Number(newContainerCapacity) || 1,
      status: "ACTIVE",
      sortOrder: (containers?.length || 0) + 1,
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    };
    await localDb.containers.put(newCont);

    const newSubj: LocalSubject = {
      id: `subj-${contId}`,
      moduleId: targetModuleForContainer.id,
      containerId: contId,
      label: `${newContainerName.trim()} (Populasi Awal)`,
      populationCount: Number(newContainerCapacity) || 1,
      isActive: true,
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    };
    await localDb.subjects.put(newSubj);

    await localDb.activityLogs.put({
      id: `log-cont-crt-${Date.now()}`,
      moduleId: targetModuleForContainer.id,
      containerId: contId,
      activityType: "CREATE",
      quantity: Number(newContainerCapacity) || 1,
      note: `Tambah wadah baru: ${newContainerName.trim()} (${cleanCode}) pada ${targetModuleForContainer.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setShowAddContainerModal(false);
    runFarmSync().catch(() => {});
  };

  // Handler Buat Kategori Modul Baru
  const handleSaveNewCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const catId = `cat-${Date.now()}`;
    await localDb.farmModuleCategories.put({
      id: catId,
      name: newCatName.trim(),
      icon: newCatIcon || "🌾",
    });
    setModCategory(catId);
    setNewCatName("");
    setShowCatModal(false);
    runFarmSync().catch(() => {});
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName.trim()) return;
    if (!editingModuleId && (!containerName.trim() || !containerCode.trim())) return;

    const modId = editingModuleId || `mod-${Date.now()}`;

    const newModule: LocalFarmModule = {
      id: modId,
      name: modName.trim(),
      category: modCategory,
      trackingMode,
      config: {
        routineActionLabel: routineActionLabel.trim() || "Rawat Harian",
        harvestType,
        harvestActionLabel: harvestActionLabel.trim() || "Panen Hasil",
        harvestUnitLabel: harvestType === "RECURRING" ? harvestUnitLabel.trim() || "Unit" : undefined,
        harvestAlertDays: Number(harvestAlertDays) >= 0 ? Number(harvestAlertDays) : 0,
      },
      updatedAt: new Date().toISOString(),
      syncedToCloud: false,
    };

    await localDb.farmModules.put(newModule);

    // Jika membuat modul baru, buatkan wadah fisik awal & subjek awalnya
    if (!editingModuleId) {
      const cleanCode = containerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
      const contId = `cont-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;
      const newCont: LocalContainer = {
        id: contId,
        moduleId: modId,
        name: containerName.trim(),
        code: cleanCode,
        capacity: Number(containerCapacity) || 1,
        status: "ACTIVE",
        sortOrder: (containers?.length || 0) + 1,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      };
      await localDb.containers.put(newCont);

      const newSubj: LocalSubject = {
        id: `subj-${contId}`,
        moduleId: modId,
        containerId: contId,
        label: `${containerName.trim()} (Populasi Awal)`,
        populationCount: Number(containerCapacity) || 1,
        isActive: true,
        updatedAt: new Date().toISOString(),
        syncedToCloud: false,
      };
      await localDb.subjects.put(newSubj);

      await localDb.activityLogs.put({
        id: `log-mod-crt-${Date.now()}`,
        moduleId: modId,
        containerId: contId,
        activityType: "CREATE",
        quantity: Number(containerCapacity) || 1,
        note: `Buat sistem farm baru: ${modName.trim()} (${cleanCode})`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    setShowModal(false);
    runFarmSync().catch(() => {});
  };

  const handleDeleteModule = async (m: LocalFarmModule) => {
    if (!confirm(`Yakin ingin menghapus seluruh sistem ternak "${m.name}" dan semua wadahnya?`)) return;

    const nowIso = new Date().toISOString();
    const relatedContainers = (containers || []).filter((c) => c.moduleId === m.id);
    for (const c of relatedContainers) {
      // Soft-delete containers & subjects
      await localDb.containers.update(c.id, {
        deletedAt: nowIso,
        updatedAt: nowIso,
        syncedToCloud: false,
      });
      const subjs = await localDb.subjects.where("containerId").equals(c.id).toArray();
      for (const s of subjs) {
        await localDb.subjects.update(s.id, {
          deletedAt: nowIso,
          updatedAt: nowIso,
          syncedToCloud: false,
        });
      }
    }
    await localDb.farmModules.update(m.id, {
      deletedAt: nowIso,
      updatedAt: nowIso,
      syncedToCloud: false,
    });

    await localDb.activityLogs.put({
      id: `log-mod-del-${Date.now()}`,
      moduleId: m.id,
      containerId: "system",
      activityType: "TERMINATE",
      quantity: 1,
      note: `Hapus sistem modul: ${m.name}`,
      performedAt: nowIso,
      syncedToCloud: false,
    });
    runFarmSync().catch(() => {});
  };

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header Studio */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl border-2 border-slate-300 bg-white p-5 sm:p-6 shadow-sm">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-emerald-700">
            ADMIN STUDIO
          </span>
          <h2 className="text-2xl font-black text-slate-900 mt-0.5">
            Kelola Sistem Ternak Modular
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            Tambah jenis ternak atau tanaman baru tanpa koding ulang alur.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-sm font-black text-white shadow-md hover:bg-emerald-800 active:scale-95 transition"
        >
          <Sparkles className="h-5 w-5" />
          <span>+ Buat Sistem Ternak Baru</span>
        </button>
      </div>

      {/* List Modul yang Terdaftar */}
      <div className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">
          Sistem Ternak Aktif ({modules?.length || 0})
        </h3>

        {(!modules || modules.length === 0) ? (
          <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 p-12 text-center">
            <Layers className="mx-auto h-12 w-12 text-slate-300" />
            <h4 className="mt-3 text-base font-black text-slate-700">
              Belum Ada Sistem Ternak
            </h4>
            <p className="mt-1 text-xs font-bold text-slate-400 max-w-sm mx-auto">
              Tekan tombol &quot;+ Buat Sistem Ternak Baru&quot; di atas untuk mendaftarkan jenis ternak pertama Anda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules.map((m) => {
              const cat = (moduleCategories || []).find((c) => c.id === m.category);
              const relatedCount = (containers || []).filter((c) => c.moduleId === m.id).length;

              return (
                <div
                  key={m.id}
                  className="flex flex-col justify-between rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-sm hover:border-emerald-600 transition"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700 border border-slate-200">
                        <span>{cat?.icon || "🌾"}</span>
                        <span>{cat?.name || m.category}</span>
                      </span>
                      <span className="rounded-xl bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800 border border-emerald-200">
                        {m.trackingMode === "INDIVIDUAL" ? "Individu" : "Koloni / Batch"}
                      </span>
                    </div>

                    <h4 className="text-lg font-black text-slate-900 mt-3">
                      {m.name}
                    </h4>

                    {/* Rincian Tombol Lapangan */}
                    <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3.5 border border-slate-200 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-500">Tombol Rawat:</span>
                        <span className="font-black text-emerald-800">
                          &quot;{m.config?.routineActionLabel}&quot;
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-500">Tombol Panen:</span>
                        <span className="font-black text-amber-800">
                          &quot;{m.config?.harvestActionLabel}&quot;
                          {m.config?.harvestUnitLabel ? ` (${m.config.harvestUnitLabel})` : ""}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-500">Daftar Wadah & QR:</span>
                          <span className="font-black text-slate-800">
                            {relatedCount} Lokasi Aktif
                          </span>
                        </div>
                        {/* List preview wadah dengan tombol QR */}
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {(containers || [])
                            .filter((c) => c.moduleId === m.id)
                            .map((cont) => (
                              <div
                                key={cont.id}
                                className="flex items-center justify-between gap-2 rounded-xl bg-white p-2 border border-slate-200"
                              >
                                <div className="min-w-0">
                                  <div className="font-black text-slate-800 truncate leading-tight">
                                    {cont.name}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    {cont.code}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedQrContainer(cont);
                                    setSelectedQrModule(m);
                                  }}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-800 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition shrink-0"
                                  title="Lihat / Cetak / Download QR Code"
                                >
                                  <QrCode className="h-3.5 w-3.5" />
                                  <span>QR</span>
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 pt-3 border-t border-slate-100 flex-wrap">
                    <button
                      onClick={() => handleOpenAddContainer(m)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-emerald-700 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-100 active:scale-95"
                    >
                      <Plus className="h-4 w-4 text-emerald-700" />
                      <span>Tambah Wadah</span>
                    </button>
                    <button
                      onClick={() => handleOpenEditModule(m)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-100 active:scale-95"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span>Edit Info</span>
                    </button>
                    <button
                      onClick={() => handleDeleteModule(m)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 active:scale-95"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: FORM LEGO PEMBUAT SISTEM TERNAK */}
      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveModule}
            className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl border-2 border-emerald-700 bg-white p-5 sm:p-6 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  {editingModuleId ? "Edit Sistem Ternak" : "Buat Sistem Ternak Baru"}
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Isi 4 kotak di bawah untuk menentukan tombol di HP pekerja
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1">
              {/* KOTAK 1: NAMA & KATEGORI */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  1. Nama & Kategori
                </span>
                <div>
                  <label className="block text-xs font-black text-slate-700">
                    Nama Sistem Ternak / Tanaman *
                  </label>
                  <input
                    type="text"
                    required
                    value={modName}
                    onChange={(e) => setModName(e.target.value)}
                    placeholder="Misal: Jamur Tiram / Bebek Petelur / Kangkung"
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-slate-700">
                      Pilih Kategori
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCatModal(true)}
                      className="text-xs font-black text-emerald-700 hover:underline"
                    >
                      + Buat Kategori Baru
                    </button>
                  </div>
                  <select
                    value={modCategory}
                    onChange={(e) => setModCategory(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    {(moduleCategories || []).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* KOTAK 2: MODEL WADAH FISIK AWAL */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  2. Model Wadah Fisik
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTrackingMode("BATCH")}
                    className={`rounded-xl border-2 p-3 text-left transition ${
                      trackingMode === "BATCH"
                        ? "border-emerald-700 bg-emerald-50 font-black text-emerald-950"
                        : "border-slate-200 bg-white font-bold text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-black">Koloni / Batch</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Contoh: Kolam Lele, Kumbung Jamur, Pot
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTrackingMode("INDIVIDUAL")}
                    className={`rounded-xl border-2 p-3 text-left transition ${
                      trackingMode === "INDIVIDUAL"
                        ? "border-emerald-700 bg-emerald-50 font-black text-emerald-950"
                        : "border-slate-200 bg-white font-bold text-slate-700"
                    }`}
                  >
                    <div className="text-sm font-black">Satu per Satu</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Contoh: Kandang Baterai Ayam Petelur
                    </div>
                  </button>
                </div>

                {!editingModuleId && (
                  <div className="pt-2 border-t border-slate-200 space-y-2.5">
                    <div className="text-xs font-black text-slate-700">
                      Daftarkan Wadah Fisik Pertama:
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        required
                        value={containerName}
                        onChange={(e) => setContainerName(e.target.value)}
                        placeholder="Nama: Rak Jamur A / Kolam 1"
                        className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        required
                        value={containerCode}
                        onChange={(e) => setContainerCode(e.target.value)}
                        placeholder="Kode QR: RAK-A / KOLAM-1"
                        className="rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Kapasitas / Populasi Awal
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={containerCapacity}
                        onChange={(e) => setContainerCapacity(Number(e.target.value))}
                        className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* KOTAK 3: TOMBOL RAWAT HARIAN */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  3. Tombol Perawatan Harian
                </span>
                <div>
                  <label className="block text-xs font-black text-slate-700">
                    Teks di Tombol HP Pekerja *
                  </label>
                  <input
                    type="text"
                    required
                    value={routineActionLabel}
                    onChange={(e) => setRoutineActionLabel(e.target.value)}
                    placeholder="Misal: Kasih Pakan / Semprot Kabut Air / Siram AB Mix"
                    className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    Tombol ini akan otomatis dicentang hijau saat pekerja menekan tombolnya di lapangan.
                  </p>
                </div>
              </div>

              {/* KOTAK 4: TOMBOL PANEN */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                  4. Tombol Panen / Hasil
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-black text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="harvestType"
                      checked={harvestType === "RECURRING"}
                      onChange={() => setHarvestType("RECURRING")}
                      className="h-4 w-4 text-emerald-600"
                    />
                    <span>Panen Berkala (Hewan/Pohon Tetap Hidup)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-black text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="harvestType"
                      checked={harvestType === "ONCE"}
                      onChange={() => setHarvestType("ONCE")}
                      className="h-4 w-4 text-emerald-600"
                    />
                    <span>Panen Sekali Habis (Wadah Kosong)</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600">
                      Teks Tombol Panen *
                    </label>
                    <input
                      type="text"
                      required
                      value={harvestActionLabel}
                      onChange={(e) => setHarvestActionLabel(e.target.value)}
                      placeholder="Misal: Panen Telur / Petik Jamur / Panen Ikan"
                      className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  {harvestType === "RECURRING" && (
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600">
                        Satuan Unit *
                      </label>
                      <input
                        type="text"
                        required
                        value={harvestUnitLabel}
                        onChange={(e) => setHarvestUnitLabel(e.target.value)}
                        placeholder="Misal: Butir / Kg / Ikat"
                        className="mt-1 w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Pengaturan Alert Keterlambatan Panen */}
                <div className="pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block text-xs font-black text-slate-700">
                        Alert Keterlambatan Panen (Hari)
                      </label>
                      <p className="text-[11px] font-bold text-slate-500">
                        Munculkan highlight peringatan jika tidak ada panen selama X hari (Isi 0 jika tidak butuh alert).
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={harvestAlertDays}
                        onChange={(e) => setHarvestAlertDays(Number(e.target.value))}
                        className="w-16 rounded-xl border-2 border-slate-300 bg-white px-2.5 py-1.5 text-center text-sm font-black text-slate-900 focus:border-emerald-600 focus:outline-none"
                      />
                      <span className="text-xs font-bold text-slate-600">Hari</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 active:scale-95 transition"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white shadow-md hover:bg-emerald-800 active:scale-95 transition"
              >
                Simpan Sistem Ternak
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: TAMBAH WADAH BARU */}
      {showAddContainerModal && targetModuleForContainer && (
        <div
          onClick={() => setShowAddContainerModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveNewContainer}
            className="w-full max-w-md rounded-3xl border-2 border-emerald-700 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  + Tambah Wadah Baru
                </h3>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Untuk sistem: {targetModuleForContainer.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddContainerModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700">
                  Nama Wadah Fisik *
                </label>
                <input
                  type="text"
                  required
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  placeholder="Misal: Rak Jamur B / Kolam 2 / Kandang B"
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700">
                  Kode QR Singkat *
                </label>
                <input
                  type="text"
                  required
                  value={newContainerCode}
                  onChange={(e) => setNewContainerCode(e.target.value)}
                  placeholder="Misal: RAK-B / KOLAM-2"
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700">
                  Kapasitas / Populasi Awal
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={newContainerCapacity}
                  onChange={(e) => setNewContainerCapacity(Number(e.target.value))}
                  className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddContainerModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800"
              >
                Daftarkan Wadah
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: BUAT KATEGORI BARU */}
      {showCatModal && (
        <div
          onClick={() => setShowCatModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveNewCategory}
            className="w-full max-w-sm rounded-3xl border-2 border-emerald-700 bg-white p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-xl font-black text-slate-900">
                Buat Kategori Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700">
                Nama Kategori *
              </label>
              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Misal: Kambing / Lebah Madu / Anggrek"
                className="mt-1 w-full rounded-xl border-2 border-slate-300 p-3 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700">
                Pilih Ikon Emoji
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                {["🍄", "🐝", "🐑", "🐐", "🐄", "🦆", "🐟", "🐓", "🌾", "🌿", "🌱", "🪵"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setNewCatIcon(emoji)}
                    className={`h-10 w-10 rounded-xl text-xl flex items-center justify-center border-2 transition ${
                      newCatIcon === emoji
                        ? "border-emerald-700 bg-emerald-100 scale-105"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800"
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL LIHAT / DOWNLOAD / CETAK QR CODE */}
      {selectedQrContainer && (
        <QrViewModal
          container={selectedQrContainer}
          module={selectedQrModule || undefined}
          onClose={() => {
            setSelectedQrContainer(null);
            setSelectedQrModule(null);
          }}
        />
      )}
    </div>
  );
}
