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
  Edit2,
  Trash2,
  Copy,
  Box,
  Layers,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  localDb,
  DEFAULT_MODULE_CATEGORIES,
  type LocalContainer,
  type LocalFarmModule,
  type LocalFarmModuleCategory,
  type LocalSubject,
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
      {data.config?.singleActionLabel && (
        <div className="mt-2 inline-block rounded-lg bg-white px-2 py-0.5 text-[11px] font-black text-slate-800 shadow-sm mr-1">
          🔘 Tombol: &ldquo;{data.config.singleActionLabel}&rdquo;
        </div>
      )}
      {data.config?.batchActionLabel && (
        <div className="mt-2 inline-block rounded-lg bg-white px-2 py-0.5 text-[11px] font-black text-slate-800 shadow-sm mr-1">
          ⚡ Batch: &ldquo;{data.config.batchActionLabel}&rdquo;
        </div>
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
  moduleCategories?: LocalFarmModuleCategory[];
  containers?: LocalContainer[];
  subjects?: LocalSubject[];
}

export function StudioFlowBuilder({
  modules,
  moduleCategories = [],
  containers = [],
  subjects = [],
}: StudioFlowBuilderProps) {
  const activeModuleCategories =
    moduleCategories.length > 0 ? moduleCategories : DEFAULT_MODULE_CATEGORIES;

  const [selectedModuleId, setSelectedModuleId] = useState<string>(
    modules[0]?.id || "mod-ayam-petelur"
  );
  const [newModName, setNewModName] = useState("");
  const [newModCategory, setNewModCategory] = useState<string>("PLANT");
  const [newModTracking, setNewModTracking] = useState<"INDIVIDUAL" | "BATCH">(
    "BATCH"
  );
  const [showNewModal, setShowNewModal] = useState(false);
  const [showNewContainerModal, setShowNewContainerModal] = useState(false);
  const [showCreateModCatModal, setShowCreateModCatModal] = useState(false);
  const [newModCatName, setNewModCatName] = useState("");
  const [newModCatIcon, setNewModCatIcon] = useState("🍄");
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // State Modal Edit Info Modul
  const [showEditModModal, setShowEditModModal] = useState(false);
  const [editModName, setEditModName] = useState("");
  const [editModCategory, setEditModCategory] = useState<string>("PLANT");
  const [editModDesc, setEditModDesc] = useState("");

  // State Modal Edit Container
  const [editingContainer, setEditingContainer] = useState<LocalContainer | null>(null);
  const [editContainerName, setEditContainerName] = useState("");
  const [editContainerCode, setEditContainerCode] = useState("");

  // State Modal Konfirmasi Hapus Container
  const [deleteConfirmContainer, setDeleteConfirmContainer] = useState<LocalContainer | null>(null);

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
  const [editSingleActionLabel, setEditSingleActionLabel] = useState("");
  const [editBatchActionLabel, setEditBatchActionLabel] = useState("");
  const [editUnitLabel, setEditUnitLabel] = useState("");

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
    setEditSingleActionLabel(legoNode.data.config?.singleActionLabel || "");
    setEditBatchActionLabel(legoNode.data.config?.batchActionLabel || "");
    setEditUnitLabel(legoNode.data.config?.unitLabel || "");
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
                singleActionLabel: editSingleActionLabel.trim() || undefined,
                batchActionLabel: editBatchActionLabel.trim() || undefined,
                unitLabel: editUnitLabel.trim() || undefined,
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

  // Buka Modal Edit Info Modul
  const handleOpenEditModule = () => {
    if (!activeModule) return;
    setEditModName(activeModule.name);
    setEditModCategory(activeModule.category);
    setEditModDesc(activeModule.description || "");
    setShowEditModModal(true);
  };

  // Buat Kategori Modul Baru
  const handleCreateModuleCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModCatName.trim()) return;

    const catId = `cat-mod-${newModCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString().slice(-3)}`;
    const newCatObj: LocalFarmModuleCategory = {
      id: catId,
      name: newModCatName.trim(),
      icon: newModCatIcon.trim() || "🌾",
    };

    await localDb.farmModuleCategories.put(newCatObj);

    await localDb.activityLogs.put({
      id: `log-modcat-crt-${Date.now()}`,
      moduleId: "system",
      containerId: "system",
      activityType: "MODULE_CATEGORY_CREATE",
      quantity: 1,
      note: `Tambah kategori modul baru: ${newCatObj.icon} ${newCatObj.name}`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setNewModCategory(catId);
    setEditModCategory(catId);
    setNewModCatName("");
    setShowCreateModCatModal(false);
    setSaveNotice(`Kategori "${newCatObj.name}" berhasil ditambahkan!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Simpan Perubahan Info Modul
  const handleSaveEditModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeModule || !editModName.trim()) return;

    await localDb.farmModules.update(activeModule.id, {
      name: editModName.trim(),
      category: editModCategory,
      description: editModDesc.trim(),
    });

    await localDb.activityLogs.put({
      id: `log-mod-upd-${Date.now()}`,
      moduleId: activeModule.id,
      containerId: "system",
      activityType: "MODULE_FLOW_UPDATE",
      quantity: 1,
      note: `Perbarui informasi modul: ${editModName.trim()} (${editModCategory})`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setShowEditModModal(false);
    setSaveNotice(`Info modul "${editModName.trim()}" berhasil disimpan!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Gandakan Modul dengan Tracking Mode Lain
  const handleDuplicateModule = (targetTracking: "INDIVIDUAL" | "BATCH") => {
    if (!activeModule) return;
    setNewModName(`${activeModule.name} (${targetTracking === "INDIVIDUAL" ? "Individu" : "Batch"})`);
    setNewModCategory(activeModule.category);
    setNewModTracking(targetTracking);
    setShowEditModModal(false);
    setShowNewModal(true);
  };

  // Buka Modal Edit Container
  const handleOpenEditContainer = (c: LocalContainer) => {
    setEditingContainer(c);
    setEditContainerName(c.name);
    setEditContainerCode(c.code);
  };

  // Simpan Perubahan Container
  const handleSaveContainerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContainer || !editContainerName.trim() || !editContainerCode.trim()) return;

    const cleanCode = editContainerCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");

    await localDb.containers.update(editingContainer.id, {
      name: editContainerName.trim(),
      code: cleanCode,
    });

    await localDb.activityLogs.put({
      id: `log-cont-upd-${Date.now()}`,
      moduleId: editingContainer.moduleId,
      containerId: editingContainer.id,
      activityType: "CONTAINER_UPDATE",
      quantity: 1,
      note: `Ubah data wadah: ${editContainerName.trim()} (${cleanCode})`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setEditingContainer(null);
    setSaveNotice(`Wadah "${editContainerName}" berhasil diperbarui!`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  // Eksekusi Hapus Container
  const handleDeleteContainer = async () => {
    if (!deleteConfirmContainer) return;
    const target = deleteConfirmContainer;

    // Jika target adalah CAGE_SET, hapus juga child slots-nya
    if (target.containerType === "CAGE_SET") {
      const childSlots = containers.filter((c) => c.parentId === target.id);
      for (const slot of childSlots) {
        await localDb.containers.delete(slot.id);
      }
    }

    await localDb.containers.delete(target.id);

    await localDb.activityLogs.put({
      id: `log-cont-del-${Date.now()}`,
      moduleId: target.moduleId,
      containerId: target.id,
      activityType: "CONTAINER_UPDATE",
      quantity: 1,
      note: `Hapus area/wadah fisik: ${target.name} (${target.code})`,
      performedAt: new Date().toISOString(),
      syncedToCloud: false,
    });

    setDeleteConfirmContainer(null);
    setSaveNotice(`Wadah "${target.name}" berhasil dihapus.`);
    setTimeout(() => setSaveNotice(null), 3000);
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Pilih Modul Alur:
            </span>
            {activeModule && (
              <button
                type="button"
                onClick={handleOpenEditModule}
                className="flex items-center gap-1 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-700 hover:bg-slate-100 active:scale-95 shadow-2xs"
              >
                <Edit2 className="h-3.5 w-3.5 text-emerald-700" />
                <span>Edit Info Modul</span>
              </button>
            )}
          </div>
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
                  {m.trackingMode} • {m.category}
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
                {/* Modern Category Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                      Kategori Modul
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCreateModCatModal(true)}
                      className="text-xs font-black text-emerald-700 hover:underline"
                    >
                      + Buat Baru
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {activeModuleCategories.map((c) => {
                      const isSelected = newModCategory === c.id;
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => setNewModCategory(c.id)}
                          className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition active:scale-95 ${
                            isSelected
                              ? "border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-xl shrink-0">{c.icon}</span>
                          <span
                            className={`text-xs font-black truncate leading-tight ${
                              isSelected ? "text-emerald-950" : "text-slate-800"
                            }`}
                          >
                            {c.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Modern Tracking Mode Selector */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Mode Tracking
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewModTracking("BATCH")}
                      className={`flex items-center justify-between rounded-2xl border-2 p-3 text-left transition active:scale-95 ${
                        newModTracking === "BATCH"
                          ? "border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          📦 Batch (Komunal)
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          Kolam lele, bedeng sayur, maggot
                        </div>
                      </div>
                      {newModTracking === "BATCH" && (
                        <Check className="h-5 w-5 text-emerald-700 shrink-0" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setNewModTracking("INDIVIDUAL")}
                      className={`flex items-center justify-between rounded-2xl border-2 p-3 text-left transition active:scale-95 ${
                        newModTracking === "INDIVIDUAL"
                          ? "border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          🐓 Individual (Per-Slot)
                        </div>
                        <div className="text-[11px] font-bold text-slate-500">
                          Ayam baterai, kambing, sapi
                        </div>
                      </div>
                      {newModTracking === "INDIVIDUAL" && (
                        <Check className="h-5 w-5 text-emerald-700 shrink-0" />
                      )}
                    </button>
                  </div>
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

              {/* Setting khusus jika Blok DAILY_ROUTINE */}
              {editingNode.data.blockType === "DAILY_ROUTINE" && (
                <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 p-3.5 space-y-2.5">
                  <div className="text-xs font-black text-emerald-950">
                    Kustomisasi Label Tombol Lapangan:
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">
                      Teks Tombol Per-Slot / Individual:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kasih Makan / Siram Nutrisi"
                      value={editSingleActionLabel}
                      onChange={(e) => setEditSingleActionLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-emerald-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">
                      Teks Tombol 1 Set Sekaligus (Batch):
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Kasih Makan 1 Set Kandang"
                      value={editBatchActionLabel}
                      onChange={(e) => setEditBatchActionLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-emerald-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Setting khusus jika Blok RECURRING_YIELD */}
              {editingNode.data.blockType === "RECURRING_YIELD" && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/70 p-3.5 space-y-2.5">
                  <div className="text-xs font-black text-amber-950">
                    Kustomisasi Panen Hasil Harian:
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        Tombol Per-Slot:
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Ada Telur / Petik"
                        value={editSingleActionLabel}
                        onChange={(e) => setEditSingleActionLabel(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700">
                        Satuan Hasil:
                      </label>
                      <input
                        type="text"
                        placeholder="Butir / Kg / Liter"
                        value={editUnitLabel}
                        onChange={(e) => setEditUnitLabel(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">
                      Teks Tombol Panen 1 Set Sekaligus:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Panen Semua Telur di Set Ini"
                      value={editBatchActionLabel}
                      onChange={(e) => setEditBatchActionLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-amber-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Setting khusus jika Blok TERMINATE_HARVEST */}
              {editingNode.data.blockType === "TERMINATE_HARVEST" && (
                <div className="rounded-2xl border-2 border-rose-300 bg-rose-50/70 p-3.5 space-y-2.5">
                  <div className="text-xs font-black text-rose-950">
                    Kustomisasi Label Panen Akhir:
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">
                      Label Tombol Terminasi / Potong:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Potong / Panen Cabut"
                      value={editSingleActionLabel}
                      onChange={(e) => setEditSingleActionLabel(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-rose-400 bg-white px-3 py-2 text-sm font-bold text-slate-900"
                    />
                  </div>
                </div>
              )}

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

      {/* SECTION: DAFTAR & CRUD CONTAINER / AREA FISIK PER MODUL */}
      <div className="w-full rounded-3xl border-2 border-slate-300 bg-white p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Box className="h-5 w-5 text-emerald-700" />
              <h3 className="text-lg font-black text-slate-900">
                Wadah & Area Fisik ({activeModule?.name || "Modul"})
              </h3>
            </div>
            <p className="mt-0.5 text-xs font-bold text-slate-500">
              Kelola area fisik (Kandang/Kolam/Bedeng) yang terhubung ke modul ini.
            </p>
          </div>

          <button
            onClick={() => {
              setNewContainerModuleId(activeModule?.id || modules[0]?.id || "");
              setShowNewContainerModal(true);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-black text-white hover:bg-emerald-800 active:scale-95 shadow-2xs"
          >
            <Plus className="h-4 w-4" />
            <span>+ Wadah Baru</span>
          </button>
        </div>

        {(() => {
          // Filter container induk/utama milik modul ini
          const moduleContainers = containers.filter(
            (c) =>
              c.moduleId === activeModule?.id &&
              c.containerType !== "CAGE_SLOT"
          );

          if (moduleContainers.length === 0) {
            return (
              <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
                <Box className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-black text-slate-700">
                  Belum ada wadah fisik untuk modul ini
                </p>
                <p className="text-xs font-bold text-slate-400 mt-1">
                  Klik tombol &ldquo;+ Wadah Baru&rdquo; untuk mendaftarkan area pertama.
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {moduleContainers.map((container) => {
                const childCount = containers.filter(
                  (c) => c.parentId === container.id
                ).length;
                const occupantsCount = subjects.filter(
                  (s) =>
                    (s.containerId === container.id ||
                      containers.some(
                        (c) => c.parentId === container.id && c.id === s.containerId
                      )) &&
                    s.isActive
                ).length;

                return (
                  <div
                    key={container.id}
                    className="flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 hover:border-emerald-600 transition shadow-2xs"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="rounded-lg bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-900 border border-emerald-300">
                            {container.containerType}
                          </span>
                          <h4 className="text-base font-black text-slate-900 mt-1">
                            {container.name}
                          </h4>
                          <span className="font-mono text-xs font-bold text-slate-500">
                            Kode: {container.code}
                          </span>
                        </div>

                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase ${
                            container.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {container.status}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-xs font-bold text-slate-600">
                        {container.containerType === "CAGE_SET" ? (
                          <>
                            <div className="flex items-center gap-1">
                              <Layers className="h-3.5 w-3.5 text-slate-400" />
                              <span>{childCount} Slot Kandang</span>
                            </div>
                            <div className="text-emerald-700 font-black">
                              • {occupantsCount} Terisi
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1">
                            <Box className="h-3.5 w-3.5 text-slate-400" />
                            <span>Wadah Komunal (Batch)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-3">
                      <button
                        type="button"
                        onClick={() => handleOpenEditContainer(container)}
                        className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-black text-slate-800 hover:bg-slate-100 active:scale-95"
                      >
                        <Edit2 className="h-3.5 w-3.5 text-amber-600" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmContainer(container)}
                        className="flex items-center justify-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-800 hover:bg-rose-100 active:scale-95"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

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

      {/* Modal: Edit Info Modul */}
      {showEditModModal && activeModule && (
        <div
          onClick={() => setShowEditModModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveEditModule}
            className="w-full max-w-lg rounded-3xl border-2 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  PENGATURAN MODUL
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Edit Info Modul
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Nama Modul *
                </label>
                <input
                  type="text"
                  required
                  value={editModName}
                  onChange={(e) => setEditModName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Kategori Modul
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateModCatModal(true)}
                    className="text-xs font-black text-emerald-700 hover:underline"
                  >
                    + Buat Baru
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {activeModuleCategories.map((c) => {
                    const isSelected = editModCategory === c.id;
                    return (
                      <button
                        type="button"
                        key={c.id}
                        onClick={() => setEditModCategory(c.id)}
                        className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition active:scale-95 ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-50/80 shadow-xs ring-2 ring-emerald-500/20"
                            : "border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-xl shrink-0">{c.icon}</span>
                        <span
                          className={`text-xs font-black truncate leading-tight ${
                            isSelected ? "text-emerald-950" : "text-slate-800"
                          }`}
                        >
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mode Tracking: Read-Only Locked dengan Info Transparan */}
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Mode Tracking:
                  </span>
                  <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-black text-white">
                    🔒 {activeModule.trackingMode}
                  </span>
                </div>
                <p className="mt-2 text-xs font-bold text-slate-500 leading-relaxed">
                  Mode tracking dikunci agar struktur slot kandang dan riwayat panen masa lalu tidak rusak.
                </p>

                <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-600">
                    Ingin mode {activeModule.trackingMode === "INDIVIDUAL" ? "Batch" : "Individu"}?
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      handleDuplicateModule(
                        activeModule.trackingMode === "INDIVIDUAL" ? "BATCH" : "INDIVIDUAL"
                      )
                    }
                    className="flex items-center gap-1 rounded-xl bg-white border border-slate-300 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-50 active:scale-95 shadow-2xs"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Gandakan Modul</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Keterangan Singkat
                </label>
                <input
                  type="text"
                  value={editModDesc}
                  onChange={(e) => setEditModDesc(e.target.value)}
                  placeholder="Misal: Modul produksi telur keluarga"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowEditModModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800 active:scale-95"
              >
                Simpan Perubahan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Edit Container (Nama & Kode) */}
      {editingContainer && (
        <div
          onClick={() => setEditingContainer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSaveContainerEdit}
            className="w-full max-w-md rounded-3xl border-3 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  EDIT WADAH / AREA
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  Ubah Data Area Fisik
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingContainer(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Nama Area / Wadah *
                </label>
                <input
                  type="text"
                  required
                  value={editContainerName}
                  onChange={(e) => setEditContainerName(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Kode QR / Singkat *
                </label>
                <input
                  type="text"
                  required
                  value={editContainerCode}
                  onChange={(e) => setEditContainerCode(e.target.value)}
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 uppercase focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setEditingContainer(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white hover:bg-emerald-800 active:scale-95"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Konfirmasi Hapus Container */}
      {deleteConfirmContainer && (
        <div
          onClick={() => setDeleteConfirmContainer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl border-3 border-rose-500 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center gap-3 text-rose-700">
              <AlertTriangle className="h-8 w-8 shrink-0" />
              <h3 className="text-xl font-black text-slate-900">
                Hapus Area Fisik?
              </h3>
            </div>

            <p className="mt-3 text-sm font-bold text-slate-600">
              Apakah Anda yakin ingin menghapus{" "}
              <strong className="text-slate-900">
                {deleteConfirmContainer.name} ({deleteConfirmContainer.code})
              </strong>
              ?
              {deleteConfirmContainer.containerType === "CAGE_SET" && (
                <span className="block mt-1 text-xs text-rose-700 font-bold">
                  ⚠️ Peringatan: Seluruh slot anak di dalam set ini juga akan dihapus.
                </span>
              )}
            </p>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setDeleteConfirmContainer(null)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteContainer}
                className="flex-1 rounded-2xl bg-rose-700 py-3 text-sm font-black text-white active:scale-95 hover:bg-rose-800"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Buat Kategori Modul Baru */}
      {showCreateModCatModal && (
        <div
          onClick={() => setShowCreateModCatModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreateModuleCategory}
            className="w-full max-w-sm rounded-3xl border-3 border-emerald-700 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  KATEGORI SISTEM
                </span>
                <h3 className="text-xl font-black text-slate-900">
                  + Buat Kategori Modul
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModCatModal(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Nama Kategori *
                </label>
                <input
                  type="text"
                  required
                  value={newModCatName}
                  onChange={(e) => setNewModCatName(e.target.value)}
                  placeholder="Misal: Jamur / Serangga BSF / Umum"
                  className="mt-1 w-full rounded-2xl border-2 border-slate-300 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Pilih Ikon Emoji
                </label>
                <div className="mt-1.5 flex gap-2 flex-wrap">
                  {["🍄", "🐛", "🐝", "🌾", "🐑", "🐄", "🐓", "🐟", "🌱", "🌿", "🦆", "🪵"].map((emoji) => (
                    <button
                      type="button"
                      key={emoji}
                      onClick={() => setNewModCatIcon(emoji)}
                      className={`h-11 w-11 rounded-xl text-xl flex items-center justify-center transition border-2 ${
                        newModCatIcon === emoji
                          ? "border-emerald-700 bg-emerald-100 scale-105 shadow-xs"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowCreateModCatModal(false)}
                className="flex-1 rounded-2xl border-2 border-slate-300 bg-slate-100 py-3 text-sm font-black text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-700 py-3 text-sm font-black text-white active:scale-95 hover:bg-emerald-800 shadow-sm"
              >
                Simpan Kategori
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
