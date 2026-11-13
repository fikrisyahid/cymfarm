import Dexie, { type Table } from "dexie";
import type { ContainerStatus, ModularFarmConfig } from "../db/schema";

export interface LocalFarmModuleCategory {
  id: string;
  name: string;
  icon: string;
}

export interface LocalFarmModule {
  id: string;
  name: string;
  category: string;
  trackingMode: "INDIVIDUAL" | "BATCH";
  description?: string;
  config: ModularFarmConfig;
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export interface LocalContainer {
  id: string;
  moduleId: string;
  name: string;
  code: string;
  capacity: number;
  status: ContainerStatus;
  maintenanceNote?: string;
  sortOrder: number;
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export interface LocalSubject {
  id: string;
  moduleId: string;
  containerId: string;
  label: string;
  populationCount: number;
  isActive: boolean;
  lastRoutineDate?: string; // YYYY-MM-DD
  lastHarvestDate?: string; // YYYY-MM-DD
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface LocalActivityLog {
  id: string;
  moduleId: string;
  containerId: string;
  subjectId?: string;
  activityType: "ROUTINE" | "HARVEST" | "MAINTENANCE" | "TERMINATE" | "CREATE" | "POPULATION_CHANGE";
  quantity: number;
  unit?: string;
  note?: string;
  performedAt: string;
  syncedToCloud: boolean;
}

export interface LocalFeedCategory {
  id: string;
  name: string;
  icon: string;
}

export interface LocalFeedPurchase {
  id: string;
  feedName: string;
  category: string;
  weightKg: number;
  priceIdr?: number;
  purchasedAt: string;
  notes?: string;
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export const DEFAULT_MODULE_CATEGORIES: LocalFarmModuleCategory[] = [
  { id: "LIVESTOCK", name: "Peternakan Unggas / Hewan", icon: "🐓" },
  { id: "AQUACULTURE", name: "Perikanan / Kolam", icon: "🐟" },
  { id: "PLANT", name: "Tanaman / Sayuran", icon: "🌱" },
  { id: "FUNGI", name: "Jamur / Fungi", icon: "🍄" },
  { id: "INSECT", name: "Serangga / Maggot", icon: "🐛" },
  { id: "OTHER", name: "Lainnya / Umum", icon: "🌾" },
];

export const DEFAULT_FEED_CATEGORIES: LocalFeedCategory[] = [
  { id: "AYAM", name: "Pakan Unggas / Ayam", icon: "🐔" },
  { id: "IKAN", name: "Pakan Ikan / Pelet", icon: "🐟" },
  { id: "TANAMAN", name: "Nutrisi / Pupuk Tanaman", icon: "🥬" },
  { id: "LAINNYA", name: "Lainnya", icon: "🌾" },
];

export class CymFarmOfflineDB extends Dexie {
  farmModules!: Table<LocalFarmModule, string>;
  farmModuleCategories!: Table<LocalFarmModuleCategory, string>;
  containers!: Table<LocalContainer, string>;
  subjects!: Table<LocalSubject, string>;
  activityLogs!: Table<LocalActivityLog, string>;
  feedPurchases!: Table<LocalFeedPurchase, string>;
  feedCategories!: Table<LocalFeedCategory, string>;

  constructor() {
    super("cymfarm_modular_db_v2");
    this.version(1).stores({
      farmModules: "id, category, trackingMode, syncedToCloud",
      farmModuleCategories: "id",
      containers: "id, moduleId, code, status, sortOrder, syncedToCloud",
      subjects: "id, moduleId, containerId, isActive, syncedToCloud",
      activityLogs: "id, moduleId, containerId, activityType, performedAt, syncedToCloud",
      feedPurchases: "id, category, purchasedAt, syncedToCloud",
      feedCategories: "id",
    });
  }
}

export const localDb = new CymFarmOfflineDB();

/**
 * Initializes clean categories in local IndexedDB if empty
 */
export async function ensureInitialCleanState() {
  const catCount = await localDb.farmModuleCategories.count();
  if (catCount === 0) {
    await localDb.farmModuleCategories.bulkPut(DEFAULT_MODULE_CATEGORIES);
  }
  const feedCatCount = await localDb.feedCategories.count();
  if (feedCatCount === 0) {
    await localDb.feedCategories.bulkPut(DEFAULT_FEED_CATEGORIES);
  }
}
