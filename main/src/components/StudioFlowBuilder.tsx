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
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

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

  const nodeTypes = useMemo(() => ({ legoNode: LegoBlockNode }), []);

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
    setSaveNotice(`+1 Slot Kandang ditambahkan ke ${cageSet.name} (Histori aman!)`);
    setTimeout(() => setSaveNotice(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Top Module Switcher & Create New Farm Module */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm font-black uppercase tracking-wider text-slate-700">
            Pilih Modul Flow:
          </span>
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModuleId(m.id)}
              className={`rounded-2xl border-2 px-4 py-2.5 text-sm font-black transition ${
                m.id === selectedModuleId
                  ? "border-emerald-900 bg-emerald-700 text-white shadow"
                  : "border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200"
              }`}
            >
              {m.name}{" "}
              <span className="ml-1 rounded bg-black/15 px-1.5 py-0.5 text-[11px]">
                {m.trackingMode}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-dashed border-emerald-700 bg-emerald-50 px-4 py-2.5 text-sm font-black text-emerald-900 hover:bg-emerald-100"
          >
            <Sparkles className="h-4 w-4" /> + Buat Modul Farm Baru
          </button>
        </div>

        <div className="flex items-center gap-3">
          {saveNotice && (
            <span className="rounded-xl border border-emerald-600 bg-emerald-50 px-3.5 py-1.5 text-sm font-black text-emerald-900">
              {saveNotice}
            </span>
          )}
          <button
            onClick={handleSaveFlow}
            className="flex items-center gap-2 rounded-2xl bg-sky-700 px-5 py-3 text-sm font-black text-white shadow hover:bg-sky-800"
          >
            <Save className="h-5 w-5" /> Simpan Rakitan Flow
          </button>
        </div>
      </div>

      {/* Modal: Create New Farm Module */}
      {showNewModal && (
        <form
          onSubmit={handleCreateNewModule}
          className="rounded-3xl border-2 border-emerald-700 bg-white p-6 shadow-xl"
        >
          <h3 className="text-xl font-black text-slate-900">
            Buat Modul Peternakan / Tanaman Baru (In-App Builder)
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            Pilih jenis modul, lalu rakit alur kerjanya dengan 7 Blok Lego di bawah.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-black text-slate-900">
                Nama Modul (Contoh: Cabai / Bebek / Maggot)
              </label>
              <input
                type="text"
                required
                value={newModName}
                onChange={(e) => setNewModName(e.target.value)}
                placeholder="Misal: Hidroponik Pakcoy"
                className="mt-1 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-sm font-black text-slate-900">
                Kategori
              </label>
              <select
                value={newModCategory}
                onChange={(e) =>
                  setNewModCategory(
                    e.target.value as "LIVESTOCK" | "AQUACULTURE" | "PLANT"
                  )
                }
                className="mt-1 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
              >
                <option value="PLANT">🌱 Tanaman / Perkebunan</option>
                <option value="LIVESTOCK">🐓 Peternakan Darat</option>
                <option value="AQUACULTURE">🐟 Perikanan / Kolam</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-black text-slate-900">
                Mode Tracking Subjek
              </label>
              <select
                value={newModTracking}
                onChange={(e) =>
                  setNewModTracking(e.target.value as "INDIVIDUAL" | "BATCH")
                }
                className="mt-1 w-full rounded-xl border-2 border-slate-400 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900"
              >
                <option value="BATCH">Batch / Komunal (Kolam / Bedeng)</option>
                <option value="INDIVIDUAL">Individual (1 Kandang 1 Hewan)</option>
              </select>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="rounded-xl border-2 border-slate-400 bg-slate-100 px-5 py-2.5 text-sm font-black text-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-black text-white"
            >
              Buat & Rakit Flow
            </button>
          </div>
        </form>
      )}

      {/* Main Split View: Left 7 Lego Block Palette + Center React Flow Canvas */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="space-y-3 rounded-3xl border-2 border-slate-300 bg-white p-5 shadow-sm lg:col-span-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              7 Lego Block Primitives
            </h3>
            <span className="text-xs font-bold text-slate-600">
              Klik untuk tambah
            </span>
          </div>
          <div className="space-y-2.5">
            {LEGO_PRIMITIVES.map((prim) => {
              const Icon = prim.icon;
              return (
                <button
                  key={prim.type}
                  onClick={() => handleAddLegoBlock(prim)}
                  className={`flex w-full items-center gap-3 rounded-2xl border-2 ${prim.borderColor} ${prim.color} p-3 text-left transition hover:scale-[1.01]`}
                >
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-black text-slate-900">
                      {prim.title}
                    </div>
                    <div className="truncate text-xs font-bold opacity-80">
                      {prim.subtitle}
                    </div>
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-black shadow-sm">
                    + Pasang
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-[540px] overflow-hidden rounded-3xl border-2 border-slate-300 bg-slate-50 shadow-inner lg:col-span-8">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#94a3b8" gap={20} />
            <Controls />
          </ReactFlow>
        </div>
      </div>

      {/* Admin Container Upgrade Section */}
      {cageSets.length > 0 && (
        <div className="rounded-3xl border-2 border-slate-300 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-slate-900">
            Upgrade Layout Kandang (Tanpa Merusak Histori Lama)
          </h3>
          <p className="mt-1 text-sm font-bold text-slate-600">
            Khusus Admin: Tambahkan slot kandang baru ke Set Kandang yang sudah ada.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {cageSets.map((cs) => (
              <button
                key={cs.id}
                onClick={() => handleAddSlotToSet(cs)}
                className="flex items-center gap-2 rounded-2xl border-2 border-slate-300 bg-slate-100 px-4 py-3 text-sm font-black text-slate-900 hover:bg-emerald-50 hover:border-emerald-600"
              >
                <Plus className="h-4 w-4 text-emerald-700" /> +1 Slot ke {cs.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
