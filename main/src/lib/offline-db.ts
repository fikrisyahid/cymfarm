import Dexie, { type Table } from "dexie";
import type {
  ActivityCategory,
  ActivityType,
  ContainerStatus,
  ContainerType,
  FeedCategory,
  FlowGraphDefinition,
} from "../db/schema";
import {
  farmModulesData,
  containersData,
  subjectsData,
  feedPurchasesData,
  activityLogsData,
} from "@/data/seed";

export interface LocalFarmModuleCategory {
  id: string;
  name: string;
  icon: string;
}

export interface LocalFarmModule {
  id: string;
  name: string;
  category: string; // 'LIVESTOCK' | 'AQUACULTURE' | 'PLANT' | 'OTHER' or custom
  trackingMode: "INDIVIDUAL" | "BATCH";
  description: string;
  flowGraph: FlowGraphDefinition;
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export interface LocalContainer {
  id: string;
  parentId: string | null;
  moduleId: string;
  name: string;
  code: string;
  containerType: ContainerType;
  status: ContainerStatus;
  maintenanceNote?: string;
  sortOrder: number;
  sizeGrade?: "SMALL" | "MEDIUM" | "LARGE";
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export interface LocalSubject {
  id: string;
  moduleId: string;
  containerId: string;
  label: string;
  populationCount: number;
  sizeCategory?: string;
  currentNodeId: string;
  consecutiveZeroYieldDays: number;
  isRecommendedForCut: boolean;
  timerStartedAt?: string;
  timerEndsAt?: string;
  isActive: boolean;
  fedToday?: boolean;
  eggHarvestedToday?: boolean;
  lastFedDate?: string; // YYYY-MM-DD (Auto-resets when calendar day changes!)
  lastEggDate?: string; // YYYY-MM-DD (Auto-resets when calendar day changes!)
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export function getTodayDateStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface LocalActivityLog {
  id: string;
  moduleId: string;
  containerId: string;
  subjectId?: string;
  activityType: ActivityType;
  quantity: number;
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
  category?: FeedCategory;
  weightKg: number;
  priceIdr?: number;
  purchasedAt: string;
  notes?: string;
  updatedAt?: string;
  syncedToCloud?: boolean;
}

export const DEFAULT_FEED_CATEGORIES: LocalFeedCategory[] = [
  { id: "AYAM", name: "Pakan Ayam", icon: "🐔" },
  { id: "IKAN", name: "Pakan Lele / Ikan", icon: "🐟" },
  { id: "TANAMAN", name: "Nutrisi Tanaman", icon: "🥬" },
  { id: "LAINNYA", name: "Lainnya", icon: "🌾" },
];

export const DEFAULT_MODULE_CATEGORIES: LocalFarmModuleCategory[] = [
  { id: "LIVESTOCK", name: "Peternakan", icon: "🐓" },
  { id: "AQUACULTURE", name: "Perikanan", icon: "🐟" },
  { id: "PLANT", name: "Tanaman", icon: "🌱" },
  { id: "OTHER", name: "Lainnya / Umum", icon: "🌾" },
];

export function getActivityCategory(activityType: ActivityType): ActivityCategory {
  switch (activityType) {
    case "FEED":
    case "EGG_HARVEST":
    case "SORT_TRANSFER":
    case "START_FASTING":
    case "FINISH_FASTING_CUT":
    case "AFKIR_CUT":
    case "POPULATE_SUBJECT":
      return "OPERASIONAL";
    case "FEED_PURCHASE_CREATE":
    case "FEED_PURCHASE_UPDATE":
    case "FEED_PURCHASE_DELETE":
    case "FEED_CATEGORY_CREATE":
      return "LOGISTIK";
    case "MAINTENANCE_SET":
    case "MAINTENANCE_RESOLVED":
    case "CONTAINER_CREATE":
    case "CONTAINER_UPDATE":
    case "CONTAINER_DELETE":
    case "EVACUATE_SUBJECT":
      return "STRUKTURAL";
    case "MODULE_CREATE":
    case "MODULE_FLOW_UPDATE":
    case "MODULE_CATEGORY_CREATE":
      return "SISTEM";
    default:
      return "OPERASIONAL";
  }
}

export class CymFarmOfflineDB extends Dexie {
  farmModules!: Table<LocalFarmModule, string>;
  farmModuleCategories!: Table<LocalFarmModuleCategory, string>;
  containers!: Table<LocalContainer, string>;
  subjects!: Table<LocalSubject, string>;
  activityLogs!: Table<LocalActivityLog, string>;
  feedPurchases!: Table<LocalFeedPurchase, string>;
  feedCategories!: Table<LocalFeedCategory, string>;

  constructor() {
    super("cymfarm_offline_db");
    this.version(2).stores({
      farmModules: "id, category, trackingMode, syncedToCloud",
      farmModuleCategories: "id",
      containers: "id, parentId, moduleId, code, containerType, status, sortOrder, syncedToCloud",
      subjects: "id, moduleId, containerId, isActive, isRecommendedForCut, syncedToCloud",
      activityLogs: "id, moduleId, containerId, subjectId, activityType, performedAt, syncedToCloud",
      feedPurchases: "id, category, purchasedAt, syncedToCloud",
      feedCategories: "id",
    });
  }
}

export const localDb = new CymFarmOfflineDB();

/**
 * Seeds the initial family farm layout:
 * - 2 Default Modules (Ayam Petelur Individual & Lele Konsumsi Batch) with 7 Lego Block Flow Graphs
 * - 3 Kolam Lele -> 6 Set Kandang (2 Sets per Pond) -> 36 Slot Kandang Ayam (6 Slots per Set)
 * - 1 Ember Karantina / Puasa Lele (72h Countdown)
 * - Historical Feed Purchase (Karung 25kg)
 */
export async function ensureInitialFarmSeed() {
  const existingCount = await localDb.farmModules.count();
  if (existingCount > 0) {
    // Auto-reset daily flags if calendar date has moved to a new day!
    const today = getTodayDateStr();
    const allSubjects = await localDb.subjects.toArray();
    for (const sub of allSubjects) {
      const shouldResetFed = sub.fedToday && sub.lastFedDate !== today;
      const shouldResetEgg = sub.eggHarvestedToday && sub.lastEggDate !== today;
      if (shouldResetFed || shouldResetEgg) {
        await localDb.subjects.update(sub.id, {
          fedToday: shouldResetFed ? false : sub.fedToday,
          eggHarvestedToday: shouldResetEgg ? false : sub.eggHarvestedToday,
        });
      }
    }
    // Ensure default feed categories exist even if farmModules already seeded
    const existingCatCount = await localDb.feedCategories.count();
    if (existingCatCount === 0) {
      await localDb.feedCategories.bulkPut(DEFAULT_FEED_CATEGORIES);
    }
    const existingModCatCount = await localDb.farmModuleCategories.count();
    if (existingModCatCount === 0) {
      await localDb.farmModuleCategories.bulkPut(DEFAULT_MODULE_CATEGORIES);
    }
    return;
  }

  // Seed data directly from structured JSON files in src/data/seed/
  await localDb.farmModules.bulkPut(farmModulesData as LocalFarmModule[]);
  await localDb.containers.bulkPut(containersData as LocalContainer[]);
  await localDb.subjects.bulkPut(subjectsData as LocalSubject[]);
  await localDb.feedPurchases.bulkPut(feedPurchasesData as LocalFeedPurchase[]);
  await localDb.activityLogs.bulkPut(activityLogsData as LocalActivityLog[]);
  await localDb.feedCategories.bulkPut(DEFAULT_FEED_CATEGORIES);
  await localDb.farmModuleCategories.bulkPut(DEFAULT_MODULE_CATEGORIES);
}
