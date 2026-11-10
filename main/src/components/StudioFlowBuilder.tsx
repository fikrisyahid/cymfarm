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
} from "lucide-react";
import { localDb, type LocalFarmModule } from "@/lib/offline-db";
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
    color: "bg-sky-950/90 text-sky-200",
    borderColor: "border-sky-500",
    icon: PlusCircle,
  },
  {
    type: "DAILY_ROUTINE",
    title: "2. Daily Routine",
    subtitle: "Kasih Makan / Siram (Auto-skip kosong)",
    color: "bg-emerald-950/90 text-emerald-200",
    borderColor: "border-emerald-500",
    icon: CalendarCheck,
  },
  {
    type: "RECURRING_YIELD",
    title: "3. Recurring Yield",
    subtitle: "Panen Telur / Petik Hasil Berulang",
    color: "bg-amber-950/90 text-amber-200",
    borderColor: "border-amber-500",
    icon: Egg,
  },
  {
    type: "SORT_TRANSFER",
    title: "4. Sort / Transfer",
    subtitle: "Sortir Ukuran / Pindah Wadah",
    color: "bg-lime-950/90 text-lime-200",
    borderColor: "border-lime-500",
    icon: ArrowLeftRight,
  },
  {
    type: "TIMER_QUARANTINE",
    title: "5. Timer / Quarantine",
    subtitle: "Puasa 3 Hari (Countdown 72h)",
    color: "bg-orange-950/90 text-orange-200",
    borderColor: "border-orange-500",
    icon: Timer,
  },
  {
    type: "AUTO_RULE",
    title: "6. Auto-Rule Trigger",
    subtitle: "0 Telur > X Hari -> Alert Afkir",
    color: "bg-purple-950/90 text-purple-200",
    borderColor: "border-purple-500",
    icon: AlertTriangle,
  },
  {
    type: "TERMINATE_HARVEST",
    title: "7. Terminate / Harvest",
    subtitle: "Potong / Panen Akhir -> Kosongkan Slot",
    color: "bg-rose-950/90 text-rose-200",
    borderColor: "border-rose-500",
    icon: Scissors,
  },
];

function LegoBlockNode({ data }: { data: FlowNodeData }) {
  const meta =
    LEGO_PRIMITIVES.find((p) => p.type === data.blockType) || LEGO_PRIMITIVES[0];
  const Icon = meta.icon;

  return (
    <div
      className={`min-w-[220px] max-w-[250px] rounded-xl border-2 ${meta.borderColor} ${meta.color} p-3.5 shadow-xl backdrop-blur-md`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-white"
      />
      <div className="flex items-center gap-2.5">
        <div className="rounded-lg bg-black/30 p-2">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">
            {data.blockType.replace("_", " ")}
          </div>
          <div className="text-sm font-bold text-white">{data.label}</div>
        </div>
      </div>
      {data.description && (
        <p className="mt-2 text-xs leading-relaxed opacity-85">
          {data.description}
        </p>
      )}
      {data.config?.timerHours && (
        <div className="mt-2 inline-block rounded bg-black/40 px-2 py-0.5 text-[11px] font-medium text-orange-300">
          ⏱️ Timer: {data.config.timerHours} Jam
        </div>
      )}
      {data.config?.zeroYieldThresholdDays && (
        <div className="mt-2 inline-block rounded bg-black/40 px-2 py-0.5 text-[11px] font-medium text-purple-300">
          ⚠️ Rule: 0 Hasil &ge; {data.config.zeroYieldThresholdDays} Hari
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-white"
      />
    </div>
  );
}

interface StudioFlowBuilderProps {
  modules: LocalFarmModule[];
}

export function StudioFlowBuilder({ modules }: StudioFlowBuilderProps) {
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
        style: { stroke: "#34d399", strokeWidth: 2 },
      })),
    [activeModule]
  );

  const [nodes, setNodes, onNodesChange] =
    useNodesState<Node<FlowNodeData>>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync nodes & edges when switching modules
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
        style: { stroke: "#34d399", strokeWidth: 2 },
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
            style: { stroke: "#34d399", strokeWidth: 2 },
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

  return (
    <div className="space-y-4">
      {/* Top Module Switcher & Create New Farm Module */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Pilih Modul Flow:
          </span>
          {modules.map((m) => (
            <button
              key={m.id}
              onClick={() => setSelectedModuleId(m.id)}
              className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                m.id === selectedModuleId
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {m.name}{" "}
              <span className="ml-1 rounded bg-black/25 px-1.5 py-0.5 text-[10px]">
                {m.trackingMode}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-500/60 bg-emerald-950/40 px-3.5 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/50"
          >
            <Sparkles className="h-3.5 w-3.5" /> + Buat Modul Farm Baru (Tanaman/Ternak)
          </button>
        </div>

        <div className="flex items-center gap-2">
          {saveNotice && (
            <span className="rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
              {saveNotice}
            </span>
          )}
          <button
            onClick={handleSaveFlow}
            className="flex items-center gap-1.5 rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-sky-400"
          >
            <Save className="h-4 w-4" /> Simpan Rakitan Flow
          </button>
        </div>
      </div>

      {/* Modal: Create New Farm Module (Plant/Livestock/Aquaculture) */}
      {showNewModal && (
        <form
          onSubmit={handleCreateNewModule}
          className="rounded-2xl border border-emerald-500/40 bg-slate-900 p-5 shadow-2xl"
        >
          <h3 className="text-sm font-bold text-white">
            Buat Modul Peternakan / Tanaman Baru (In-App Builder)
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Tanpa koding ulang! Pilih jenis modul, lalu rakit flow-nya dengan 7 Blok Lego di bawah.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Nama Modul (Contoh: Cabai Rawit / Bebek / Maggot)
              </label>
              <input
                type="text"
                required
                value={newModName}
                onChange={(e) => setNewModName(e.target.value)}
                placeholder="Misal: Hidroponik Pakcoy"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Kategori
              </label>
              <select
                value={newModCategory}
                onChange={(e) =>
                  setNewModCategory(
                    e.target.value as "LIVESTOCK" | "AQUACULTURE" | "PLANT"
                  )
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="PLANT">🌱 Tanaman / Perkebunan</option>
                <option value="LIVESTOCK">🐓 Peternakan Darat</option>
                <option value="AQUACULTURE">🐟 Perikanan / Kolam</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">
                Mode Tracking Subjek
              </label>
              <select
                value={newModTracking}
                onChange={(e) =>
                  setNewModTracking(e.target.value as "INDIVIDUAL" | "BATCH")
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="BATCH">
                  Batch / Komunal (Kolam Lele / Bedeng Tanaman)
                </option>
                <option value="INDIVIDUAL">
                  Individual (1 Kandang 1 Ayam / Pohon Indukan)
                </option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewModal(false)}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950"
            >
              Buat & Rakit Flow
            </button>
          </div>
        </form>
      )}

      {/* Main Split View: Left 7 Lego Block Palette + Center React Flow Canvas */}
      <div className="grid gap-4 lg:grid-cols-12">
        {/* Left Palette: 7 Lego Block Primitives */}
        <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-900/90 p-4 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              7 Lego Block Primitives
            </h3>
            <span className="text-[11px] text-slate-400">
              Klik untuk tambah ke kanvas
            </span>
          </div>
          <div className="space-y-2">
            {LEGO_PRIMITIVES.map((prim) => {
              const Icon = prim.icon;
              return (
                <button
                  key={prim.type}
                  onClick={() => handleAddLegoBlock(prim)}
                  className={`flex w-full items-center gap-3 rounded-xl border ${prim.borderColor} ${prim.color} p-2.5 text-left transition hover:scale-[1.01] hover:brightness-110`}
                >
                  <div className="rounded-lg bg-black/30 p-2">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white">
                      {prim.title}
                    </div>
                    <div className="truncate text-[11px] opacity-80">
                      {prim.subtitle}
                    </div>
                  </div>
                  <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                    + Pasang
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center/Right: Interactive React Flow Canvas */}
        <div className="h-[520px] overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 lg:col-span-8">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background color="#334155" gap={20} />
            <Controls className="!bg-slate-900 !border-slate-700 !text-white" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
