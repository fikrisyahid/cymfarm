import Dexie, { type Table } from "dexie";
import type {
  ActivityType,
  ContainerStatus,
  ContainerType,
  FlowGraphDefinition,
} from "../db/schema";
import {
  farmModulesData,
  containersData,
  subjectsData,
  feedPurchasesData,
  activityLogsData,
} from "@/data/dummy";

export interface LocalFarmModule {
  id: string;
  name: string;
  category: "LIVESTOCK" | "AQUACULTURE" | "PLANT";
  trackingMode: "INDIVIDUAL" | "BATCH";
  description: string;
  flowGraph: FlowGraphDefinition;
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

export interface LocalFeedPurchase {
  id: string;
  feedName: string;
  weightKg: number;
  priceIdr?: number;
  purchasedAt: string;
  notes?: string;
}

export class CymFarmOfflineDB extends Dexie {
  farmModules!: Table<LocalFarmModule, string>;
  containers!: Table<LocalContainer, string>;
  subjects!: Table<LocalSubject, string>;
  activityLogs!: Table<LocalActivityLog, string>;
  feedPurchases!: Table<LocalFeedPurchase, string>;

  constructor() {
    super("cymfarm_offline_db");
    this.version(1).stores({
      farmModules: "id, category, trackingMode",
      containers: "id, parentId, moduleId, code, containerType, status, sortOrder",
      subjects: "id, moduleId, containerId, isActive, isRecommendedForCut",
      activityLogs: "id, moduleId, containerId, subjectId, activityType, performedAt, syncedToCloud",
      feedPurchases: "id, purchasedAt",
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
    return;
  }

  // Seed data directly from structured JSON files in src/data/dummy/
  await localDb.farmModules.bulkPut(farmModulesData as LocalFarmModule[]);
  await localDb.containers.bulkPut(containersData as LocalContainer[]);
  await localDb.subjects.bulkPut(subjectsData as LocalSubject[]);
  await localDb.feedPurchases.bulkPut(feedPurchasesData as LocalFeedPurchase[]);
  await localDb.activityLogs.bulkPut(activityLogsData as LocalActivityLog[]);
}
