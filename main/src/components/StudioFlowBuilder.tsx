"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  PlusCircle,
  CalendarCheck,
  Egg,
  ArrowLeftRight,
  Timer,
  AlertTriangle,
  Scissors,
  Save,
  Sparkles,
  Plus,
  X,
} from "lucide-react";
import {
  localDb,
  type LocalContainer,
  type LocalFarmModule,
} from "@/lib/offline-db";
import type { LegoBlockType, FlowNodeData } from "@/db/schema";

const LEGO_PRIMITIVES: Array<{
  type: LegoBlockType;
  title: string;
  subtitle: string;
  color: string;
  borderColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    type: "INIT_POPULATE",
    title: "1. Init / Populate",
    subtitle: "Masuk Bibit / Isi Kandang",
    color: "bg-sky-50 text-sky-950",
    borderColor: "border-sky-600",
    icon: PlusCircle,
  },
  {
    type: "DAILY_ROUTINE",
    title: "2. Daily Routine",
    subtitle: "Kasih Makan / Siram (Auto-skip kosong)",
    color: "bg-emerald-50 text-emerald-950",
    borderColor: "border-emerald-600",
    icon: CalendarCheck,
  },
  {
    type: "RECURRING_YIELD",
    title: "3. Recurring Yield",
    subtitle: "Panen Telur / Petik Hasil Berulang",
    color: "bg-amber-50 text-amber-950",
    borderColor: "border-amber-600",
    icon: Egg,
  },
  {
    type: "SORT_TRANSFER",
    title: "4. Sort / Transfer",
    subtitle: "Sortir Ukuran / Pindah Wadah",
    color: "bg-lime-50 text-lime-950",
    borderColor: "border-lime-600",
    icon: ArrowLeftRight,
  },
  {
    type: "TIMER_QUARANTINE",
    title: "5. Timer / Quarantine",
    subtitle: "Puasa 3 Hari (Countdown 72h)",
    color: "bg-orange-50 text-orange-950",
    borderColor: "border-orange-600",
    icon: Timer,
  },
  {
    type: "AUTO_RULE",
    title: "6. Auto-Rule Trigger",
    subtitle: "0 Telur > X Hari -> Alert Afkir",
    color: "bg-purple-50 text-purple-950",
    borderColor: "border-purple-600",
    icon: AlertTriangle,
  },
  {
    type: "TERMINATE_HARVEST",
    title: "7. Terminate / Harvest",
    subtitle: "Potong / Panen Akhir -> Kosongkan Slot",
    color: "bg-rose-50 text-rose-950",
    borderColor: "border-rose-600",
    icon: Scissors,
  },
];

function LegoBlockNode({ data }: { data: FlowNodeData }) {
  const meta =
    LEGO_PRIMITIVES.find((p) => p.type === data.blockType) || LEGO_PRIMITIVES[0];
  const Icon = meta.icon;

  return (
    <div
      className={`min-w-[230px] max-w-[260px] rounded-2xl border-2 ${meta.borderColor} ${meta.color} p-4 shadow-md`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3.5 !w-3.5 !bg-slate-900"
      />
      <div className="flex items-center gap-2.5">
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[11px] font-black uppercase tracking-wider opacity-75">
            {data.blockType.replace("_", " ")}
          </div>
          <div className="text-base font-black text-slate-900">{data.label}</div>
        </div>
      </div>
      {data.description && (
        <p className="mt-2 text-xs font-bold leading-relaxed text-slate-700">
          {data.description}
        </p>
      )}
      {data.config?.timerHours && (
        <div className="mt-2 inline-block rounded-lg bg-white px-2.5 py-1 text-xs font-black text-orange-800 shadow-sm">
          ⏱️ Timer: {data.config.timerHours} Jam
        </div>
      )}
      {data.config?.zeroYieldThresholdDays && (
        <div className="mt-2 inline-block rounded-lg bg-white px-2.5 py-1 text-xs font-black text-purple-800 shadow-sm">
          ⚠️ Rule: 0 Hasil &ge; {data.config.zeroYieldThresholdDays} Hari
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3.5 !w-3.5 !bg-slate-900"
      />
    </div>
  );
}

const nodeTypes = {
  legoNode: LegoBlockNode,
};

interface StudioFlowBuilderProps {
  modules: LocalFarmModule[];
  containers?: LocalContainer[];
}

export function StudioFlowBuilder({
  modules,
  containers = [],
}: StudioFlowBuilderProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    modules[0]?.id || "mod-ayam-petelur"
  );
  const [newModName, setNewModName] = useState("");
  const [newModCategory, setNewModCategory] = useState<
    "LIVESTOCK" | "AQUACULTURE" | "PLANT"
  >("PLANT");
  const [newModTracking, setNewModTracking] = useState<"INDIVIDUAL" | "BATCH">(
    "BATCH"
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewContainerModal, setShowNewContainerModal] = useState(false);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Form State untuk Tambah Area / Wadah Fisik Baru
  const [newContainerName, setNewContainerName] = useState("");
  const [newContainerCode, setNewContainerCode] = useState("");
  const [newContainerModuleId, setNewContainerModuleId] = useState(modules[0]?.id || "");
  const [newContainerSlotCount, setNewContainerSlotCount] = useState(6);
  const [newContainerBatchPop, setNewContainerBatchPop] = useState(50);

  // State untuk Edit Node / Blok Lego yang Diklik di Kanvas
  const [editingNode, setEditingNode] = useState<Node<FlowNodeData> | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTimerHours, setEditTimerHours] = useState(72);
  const [editThresholdDays, setEditThresholdDays] = useState(7);

  const activeModule = useMemo(
    () => modules.find((m) => m.id === selectedModuleId) || modules[0],
    [modules, selectedModuleId]
  );

  const initialNodes: Node<FlowNodeData>[] = useMemo(
    () =>
      (activeModule?.flowGraph.nodes || []).map((n) => ({
        ...n,
        type: "legoNode",
      })),
    [activeModule]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      (activeModule?.flowGraph.edges || []).map((e) => ({
        ...e,
        animated: true,
        style: { stroke: "#047857", strokeWidth: 2.5 },
      })),
    [activeModule]
  );

  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<FlowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    if (!activeModule) return;
    setNodes(
      activeModule.flowGraph.nodes.map((n) => ({
        ...n,
        type: "legoNode",
      }))
    );
    setEdges(
      activeModule.flowGraph.edges.map((e) => ({
        ...e,
        animated: true,
        style: { stroke: "#047857", strokeWidth: 2.5 },
      }))
    );
  }, [activeModule, setNodes, setEdges]);

  // Handler ketika salah satu node di kanvas diklik
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const legoNode = node as Node<FlowNodeData>;
    setEditingNode(legoNode);
    setEditLabel(legoNode.data.label || "");
    setEditDesc(legoNode.data.description || "");
    setEditTimerHours(legoNode.data.config?.timerHours || 72);
    setEditThresholdDays(legoNode.data.config?.zeroYieldThresholdDays || 7);
  }, []);

  // Simpan hasil edit node ke daftar nodes kanvas
  const handleSaveNodeEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNode) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === editingNode.id) {
          return {
            ...n,
            data: {
              ...n.data,
              label: editLabel.trim() || n.data.label,
              description: editDesc.trim(),
              config: {
                ...n.data.config,
                timerHours: editTimerHours,
                zeroYieldThresholdDays: editThresholdDays,
              },
            },
          };
        }
        return n;
      })
    );

    setEditingNode(null);
    setSaveNotice(`Blok "${editLabel}" diperbarui! Tekan Simpan Rakitan Flow untuk mematenkan.`);
    setTimeout(() => setSaveNotice(null), 3500);
  };

  // Hapus node dari kanvas
  const handleDeleteNode = () => {
    if (!editingNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== editingNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== editingNode.id && e.target !== editingNode.id));
    setEditingNode(null);
    setSaveNotice(`Blok berhasil dihapus dari alur!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#047857", strokeWidth: 2.5 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const handleAddLegoBlock = (primitive: (typeof LEGO_PRIMITIVES)[number]) => {
    const newNode: Node<FlowNodeData> = {
      id: `node-${Date.now()}`,
      type: "legoNode",
      position: {
        x: 120 + (nodes.length % 3) * 260,
        y: 100 + Math.floor(nodes.length / 3) * 140,
      },
      data: {
        label: primitive.title.replace(/^\d+\.\s*/, ""),
        blockType: primitive.type,
        description: primitive.subtitle,
        config:
          primitive.type === "TIMER_QUARANTINE"
            ? { timerHours: 72 }
            : primitive.type === "AUTO_RULE"
              ? { zeroYieldThresholdDays: 7 }
              : { autoSkipVacant: true },
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleSaveFlow = async () => {
    if (!activeModule) return;
    await localDb.farmModules.update(activeModule.id, {
      flowGraph: {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: "legoNode",
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: typeof e.label === "string" ? e.label : undefined,
        })),
      },
    });

    await localDb.activityLogs.put({
      id: `log-flow-${Date.now()}`,
      moduleId: activeModule.id,
      containerId: "system",
      activityType: "MODULE_FLOW_UPDATE",
      quantity: nodes.length,
      note: `Update alur Lego diagram modul ${activeModule.name} (${nodes.length} blok, ${edges.length} koneksi)`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setSaveNotice(`Flow "${activeModule.name}" berhasil disimpan!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  const handleCreateNewModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModName.trim()) return;
    const id = `mod-${newModName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-3)}`;
    const newModule: LocalFarmModule = {
      id,
      name: newModName.trim(),
      category: newModCategory,
      trackingMode: newModTracking,
      description: `Modul dinamis (${newModCategory} - ${newModTracking})`,
      flowGraph: {
        nodes: [
          {
            id: `${id}-n1`,
            position: { x: 80, y: 120 },
            data: {
              label: "Inisiasi / Tanam / Bibit",
              blockType: "INIT_POPULATE",
              description: "Blok awal siklus hidup",
            },
          },
          {
            id: `${id}-n2`,
            position: { x: 380, y: 120 },
            data: {
              label: "Perawatan Harian",
              blockType: "DAILY_ROUTINE",
              description: "Siram / Pakan harian (Auto-skip kosong)",
              config: { autoSkipVacant: true },
            },
          },
          {
            id: `${id}-n3`,
            position: { x: 680, y: 120 },
            data: {
              label: "Panen Hasil",
              blockType: "TERMINATE_HARVEST",
              description: "Panen akhir & kosongkan wadah",
            },
          },
        ],
        edges: [
          { id: `${id}-e1`, source: `${id}-n1`, target: `${id}-n2` },
          { id: `${id}-e2`, source: `${id}-n2`, target: `${id}-n3` },
        ],
      },
    };
    await localDb.farmModules.put(newModule);

    await localDb.activityLogs.put({
      id: `log-mod-crt-${Date.now()}`,
      moduleId: id,
      containerId: "system",
      activityType: "MODULE_CREATE",
      quantity: 1,
      note: `Buat modul baru: ${newModName.trim()} (${newModCategory} - ${newModTracking})`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setSelectedModuleId(id);
    setNewModName("");
    setShowNewModal(false);
  };

  const cageSets = containers.filter((c) => c.containerType === "CAGE_SET");

  const handleAddSlotToSet = async (cageSet: LocalContainer) => {
    const existingSlots = containers.filter((c) => c.parentId === cageSet.id);
    const nextOrder = existingSlots.length + 1;
    const newSlotId = `${cageSet.id}-slot-${nextOrder}-${Date.now().toString().slice(-3)}`;
    await localDb.containers.put({
      id: newSlotId,
      parentId: cageSet.id,
      moduleId: cageSet.moduleId,
      name: `Kandang Baru (${cageSet.code}-${nextOrder})`,
      code: `${cageSet.code}-${nextOrder}`,
      containerType: "CAGE_SLOT",
      status: "VACANT",
      sortOrder: nextOrder,
    });

    await localDb.activityLogs.put({
      id: `log-slot-crt-${Date.now()}`,
      moduleId: cageSet.moduleId,
      containerId: newSlotId,
      activityType: "CONTAINER_CREATE",
      quantity: 1,
      note: `Tambah +1 Slot kandang ke ${cageSet.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setSaveNotice(`+1 Slot Kandang ditambahkan ke ${cageSet.name} (Histori aman!)`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Buat Area / Wadah Fisik Baru untuk Modul Apa Pun
  const handleCreateNewContainer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContainerName.trim() || !newContainerCode.trim()) return;

    const mod = modules.find((m) => m.id === newContainerModuleId) || modules[0];
    const cleanCode = newContainerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    const containerId = `area-${cleanCode.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    const isIndividual = mod?.trackingMode === "INDIVIDUAL";

    if (isIndividual) {
      // Buat Set Wadah (Parent)
      await localDb.containers.put({
        id: containerId,
        parentId: null,
        moduleId: mod.id,
        name: newContainerName.trim(),
        code: cleanCode,
        containerType: "CAGE_SET",
        status: "ACTIVE",
        sortOrder: containers.length + 1,
      });

      // Buat Slot-Slot Anaknya (Child Slots)
      const childSlots: LocalContainer[] = [];
      for (let s = 1; s <= newContainerSlotCount; s++) {
        childSlots.push({
          id: `${containerId}-slot-${s}`,
          parentId: containerId,
          moduleId: mod.id,
          name: `${cleanCode} #${s}`,
          code: `${cleanCode}-${s}`,
          containerType: "CAGE_SLOT",
          status: "VACANT",
          sortOrder: s,
        });
      }
      await localDb.containers.bulkPut(childSlots);

      await localDb.activityLogs.put({
        id: `log-set-crt-${Date.now()}`,
        moduleId: mod.id,
        containerId: containerId,
        activityType: "CONTAINER_CREATE",
        quantity: newContainerSlotCount,
        note: `Daftarkan area set baru: ${newContainerName.trim()} (${newContainerSlotCount} slot)`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    } else {
      // Buat Wadah Komunal / Batch (POND / CUSTOM)
      await localDb.containers.put({
        id: containerId,
        parentId: null,
        moduleId: mod.id,
        name: newContainerName.trim(),
        code: cleanCode,
        containerType: mod.category === "AQUACULTURE" ? "POND" : "CUSTOM",
        status: "ACTIVE",
        sortOrder: containers.length + 1,
      });

      // Masukkan populasi batch subjek
      await localDb.subjects.put({
        id: `subj-${containerId}`,
        moduleId: mod.id,
        containerId: containerId,
        label: `${newContainerName.trim()} (Batch 1)`,
        populationCount: newContainerBatchPop,
        currentNodeId: mod.flowGraph.nodes[0]?.id || "node-1",
        consecutiveZeroYieldDays: 0,
        isRecommendedForCut: false,
        isActive: true,
      });

      await localDb.activityLogs.put({
        id: `log-pond-crt-${Date.now()}`,
        moduleId: mod.id,
        containerId: containerId,
        activityType: "CONTAINER_CREATE",
        quantity: newContainerBatchPop,
        note: `Daftarkan wadah komunal baru: ${newContainerName.trim()} (${newContainerBatchPop} ekor/unit)`,
        performedAt: new Date().toISOString(),
        syncedToCloud: false,
      });
    }

    setSaveNotice(`Area baru "${newContainerName}" (${cleanCode}) berhasil didaftarkan!`);
    setTimeout(() => setSaveNotice(null), 3000);
    setNewContainerName("");
    setNewContainerCode("");
    setShowNewContainerModal(false);
  };

  return (
    <div className="w-full max-w-full space-y-5 overflow-hidden">
      {/* Top Module Switcher & Create New Farm Module */}
      <div className="flex flex-col gap-3 rounded-3xl border-2 border-slate-300 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-500">
            Pilih Modul Alur:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {modules.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedModuleId(m.id)}
                className={`flex w-full flex-col items-start gap-1 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-98 ${
                  m.id === selectedModuleId
                    ? "border-emerald-900 bg-emerald-700 text-white shadow-sm"
                    : "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                  m.id === selectedModuleId ? "bg-black/20 text-white" : "bg-slate-200 text-slate-700"
                }`}>
                  {m.trackingMode}
                </span>
                <span className="text-sm font-black leading-snug">{m.name}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              onClick={() => setShowNewModal(true)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-700 bg-emerald-50 py-3 text-sm font-black text-emerald-900 hover:bg-emerald-100 active:scale-98"
            >
              <Sparkles className="h-4 w-4" /> + Buat Modul Baru
            </button>
            <button
              onClick={() => {
                setNewContainerModuleId(activeModule?.id || modules[0]?.id || "");
                setShowNewContainerModal(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-emerald-700 bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800 active:scale-98"
            >
              <Plus className="h-4 w-4" /> + Daftarkan Area / Wadah Fisik Baru
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 border-t border-slate-200 pt-3">
          {saveNotice ? (
            <span className="rounded-xl border border-emerald-600 bg-emerald-50 px-3 py-2 text-center text-xs font-black text-emerald-900">
              {saveNotice}
            </span>
          ) : <div />}
          <button
            onClick={handleSaveFlow}
            className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-sky-700 px-6 py-3.5 text-sm font-black text-white shadow hover:bg-sky-800 active:scale-98"
          >
            <Save className="h-5 w-5" /> Simpan Rakitan Flow
          </button>
        </div>
      </div>

      {/* Modal: Create New Farm Module */}
      {showNewModal && (
        <div
          onClick={() => setShowNewModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateNewModule}
            className="w-full max-w-lg rounded-3xl border-2 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-xl font-black text-slate-900">
              Buat Modul Peternakan / Tanaman Baru
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-600">
              Pilih jenis modul, lalu rakit alur kerjanya dengan 7 Blok Lego di bawah.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  Nama Modul (Contoh: Cabai / Bebek / Maggot)
                </label>
                <input
                  type="text"
                  required
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  placeholder="Misal: Hidroponik Pakcoy"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Kategori
                  </label>
                  <select
                    value={newModCategory}
                    onChange={(e) =>
                      setNewModCategory(
                        e.target.value as "LIVESTOCK" | "AQUACULTURE" | "PLANT"
                      )
                    }
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                  >
                    <option value="PLANT">🌱 Tanaman</option>
                    <option value="LIVESTOCK">🐓 Peternakan</option>
                    <option value="AQUACULTURE">🐟 Perikanan</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Mode Tracking
                  </label>
                  <select
                    value={newModTracking}
                    onChange={(e) =>
                      setNewModTracking(e.target.value as "INDIVIDUAL" | "BATCH")
                    }
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                  >
                    <option value="BATCH">Batch (Kolam/Bedeng)</option>
                    <option value="INDIVIDUAL">Individual (1 Hewan)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white"
              >
                Buat Modul
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create New Container/Area for Any Module */}
      {showNewContainerModal && (
        <div
          onClick={() => setShowNewContainerModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateNewContainer}
            className="w-full max-w-lg rounded-3xl border-2 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <h3 className="text-xl font-black text-slate-900">
              Daftarkan Area / Wadah Fisik Baru
            </h3>
            <p className="mt-1 text-xs font-bold text-slate-600">
              Area ini akan langsung muncul di halaman Lapangan (QR / Lokasi) dan Analisa!
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  Untuk Modul Apa?
                </label>
                <select
                  value={newContainerModuleId}
                  onChange={(e) => setNewContainerModuleId(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                >
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.trackingMode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800">
                  Nama Area / Wadah (Misal: Kandang Bebek A / Talang Pakcoy 2)
                </label>
                <input
                  type="text"
                  required
                  value={newContainerName}
                  onChange={(e) => setNewContainerName(e.target.value)}
                  placeholder="Nama lokasi fisik"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800">
                  Kode Area Singkat (Misal: BEBEK-A / PAKCOY-2)
                </label>
                <input
                  type="text"
                  required
                  value={newContainerCode}
                  onChange={(e) => setNewContainerCode(e.target.value)}
                  placeholder="Kode huruf kapital"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900 uppercase"
                />
              </div>

              {modules.find((m) => m.id === newContainerModuleId)?.trackingMode === "INDIVIDUAL" ? (
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Jumlah Kotak / Slot Kandang di Set Ini
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={newContainerSlotCount}
                    onChange={(e) => setNewContainerSlotCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-black text-slate-800">
                    Kapasitas / Populasi Awal Batch (Ekor / Tanaman)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newContainerBatchPop}
                    onChange={(e) => setNewContainerBatchPop(Number(e.target.value))}
                    className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-3 text-sm font-bold text-slate-900"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewContainerModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white"
              >
                Daftarkan Area
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Split View: Left 7 Lego Block Palette + Center React Flow Canvas */}
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 w-full max-w-full">
        {/* 7 Lego Block Palette (Full Width Stretch on Mobile, 0 Horizontal Scroll) */}
        <div className="w-full rounded-3xl border-2 border-slate-300 bg-white p-4 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              7 Lego Block Primitives
            </h3>
            <span className="text-[11px] font-bold text-slate-500">
              Ketuk untuk pasang
            </span>
          </div>

          <div className="mt-3 flex flex-col gap-2 w-full">
            {LEGO_PRIMITIVES.map((prim) => {
              const Icon = prim.icon;
              return (
                <button
                  key={prim.type}
                  onClick={() => handleAddLegoBlock(prim)}
                  className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border-2 ${prim.borderColor} ${prim.color} p-2.5 text-left transition active:scale-98`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="rounded-xl bg-white p-2 shadow-xs shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                        {prim.title}
                      </div>
                      <div className="text-[10px] font-bold opacity-75 line-clamp-1">
                        {prim.subtitle}
                      </div>
                    </div>
                  </div>

                  <span className="shrink-0 rounded-xl bg-white px-2.5 py-1 text-[11px] font-black text-slate-900 shadow-xs">
                    + Pasang
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas Diagram */}
        <div className="h-[460px] sm:h-[540px] w-full max-w-full overflow-hidden rounded-3xl border-2 border-slate-300 bg-slate-50 shadow-inner lg:col-span-8">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#94a3b8" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* MODAL EDIT BLOK LEGO YANG DIKLIK DI KANVAS */}
      {editingNode && (
        <div
          onClick={() => setEditingNode(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveNodeEdit}
            className="w-full max-w-md rounded-3xl border-3 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  EDIT BLOK: {editingNode.data.blockType}
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Pengaturan Blok Alur
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingNode(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-800">
                  Judul / Label Blok
                </label>
                <input
                  type="text"
                  required
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-900"
                />
              </div>

              {/* Setting khusus jika Blok AUTO_RULE */}
              {editingNode.data.blockType === "AUTO_RULE" && (
                <div className="rounded-2xl border-2 border-purple-300 bg-purple-50/70 p-3.5">
                  <label className="block text-xs font-black text-purple-950">
                    Ambang Batas Evaluasi (Threshold Hari):
                  </label>
                  <p className="text-[11px] font-bold text-purple-800 mt-0.5">
                    Memicu kartu peringatan otomatis di Analisa jika mencapai hari ini.
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    required
                    value={editThresholdDays}
                    onChange={(e) => setEditThresholdDays(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border-2 border-purple-400 bg-white px-3 py-2 text-base font-black text-purple-950"
                  />
                </div>
              )}

              {/* Setting khusus jika Blok TIMER_QUARANTINE */}
              {editingNode.data.blockType === "TIMER_QUARANTINE" && (
                <div className="rounded-2xl border-2 border-orange-300 bg-orange-50/70 p-3.5">
                  <label className="block text-xs font-black text-orange-950">
                    Durasi Hitung Mundur Timer (Jam):
                  </label>
                  <p className="text-[11px] font-bold text-orange-800 mt-0.5">
                    Contoh: 72 Jam (3 Hari Puasa Lele) atau 48 Jam.
                  </p>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    required
                    value={editTimerHours}
                    onChange={(e) => setEditTimerHours(Number(e.target.value))}
                    className="mt-2 w-full rounded-xl border-2 border-orange-400 bg-white px-3 py-2 text-base font-black text-orange-950"
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleDeleteNode}
                className="rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3 text-xs font-black text-rose-800 hover:bg-rose-100 active:scale-95"
              >
                Hapus Blok
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800 active:scale-95"
              >
                Terapkan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Admin Container Upgrade Section */}
      {cageSets.length > 0 && (
        <div className="w-full rounded-3xl border-2 border-slate-300 bg-white p-4 sm:p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">
            Upgrade Layout Kandang (Histori Tetap Aman)
          </h3>
          <p className="mt-0.5 text-xs font-bold text-slate-500">
            Tambah slot kandang baru ke Set Kandang tanpa menghapus histori lama.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 w-full">
            {cageSets.map((cs) => (
              <button
                key={cs.id}
                onClick={() => handleAddSlotToSet(cs)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-50 py-3 text-xs sm:text-sm font-black text-slate-900 hover:bg-emerald-50 hover:border-emerald-600 active:scale-98"
              >
                <Plus className="h-4 w-4 text-emerald-700" />
                <span>+1 Slot ke {cs.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
