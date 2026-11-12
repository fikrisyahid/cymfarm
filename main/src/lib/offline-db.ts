import Dexie, { type Table } from "dexie";
import type {
  ActivityType,
  ContainerStatus,
  ContainerType,
  FlowGraphDefinition,
} from "../db/schema";

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

  // 1. Seed Default Modules with 7 Lego Block Primitives
  const ayamModule: LocalFarmModule = {
    id: "mod-ayam-petelur",
    name: "Ayam Petelur (Kandang Atas Kolam)",
    category: "LIVESTOCK",
    trackingMode: "INDIVIDUAL",
    description: "1 Kandang 1 Ayam di atas kolam lele. Tracking pakan, panen telur harian, & rekomendasi potong otomatis.",
    flowGraph: {
      nodes: [
        {
          id: "ayam-node-1",
          position: { x: 40, y: 120 },
          data: {
            label: "1. Masuk Ayam ke Slot",
            blockType: "INIT_POPULATE",
            description: "1 Slot Kandang = 1 Ekor Ayam Produktif",
          },
        },
        {
          id: "ayam-node-2",
          position: { x: 300, y: 60 },
          data: {
            label: "2. Kasih Makan Harian",
            blockType: "DAILY_ROUTINE",
            description: "Auto-skip slot kandang kosong atau maintenance",
            config: { autoSkipVacant: true },
          },
        },
        {
          id: "ayam-node-3",
          position: { x: 300, y: 200 },
          data: {
            label: "3. Ceklis Panen Telur",
            blockType: "RECURRING_YIELD",
            description: "Tap nomor kandang yang ada telurnya hari ini",
          },
        },
        {
          id: "ayam-node-4",
          position: { x: 580, y: 120 },
          data: {
            label: "4. Deteksi Stop Bertelur",
            blockType: "AUTO_RULE",
            description: "Alert jika 0 telur >= 7 hari berturut-turut",
            config: { zeroYieldThresholdDays: 7 },
          },
        },
        {
          id: "ayam-node-5",
          position: { x: 850, y: 120 },
          data: {
            label: "5. Afkir / Potong Ayam",
            blockType: "TERMINATE_HARVEST",
            description: "Potong ayam & ubah slot kandang jadi Kosong (Vacant)",
          },
        },
      ],
      edges: [
        { id: "e-a1-2", source: "ayam-node-1", target: "ayam-node-2", label: "Aktif" },
        { id: "e-a1-3", source: "ayam-node-1", target: "ayam-node-3", label: "Produktif" },
        { id: "e-a3-4", source: "ayam-node-3", target: "ayam-node-4", label: "Evaluasi" },
        { id: "e-a4-5", source: "ayam-node-4", target: "ayam-node-5", label: "Stop Nelor" },
      ],
    },
  };

  const leleModule: LocalFarmModule = {
    id: "mod-lele-konsumsi",
    name: "Lele Konsumsi (Bawah Kandang Ayam)",
    category: "AQUACULTURE",
    trackingMode: "BATCH",
    description: "3 Kolam Lele (1 ukuran per kolam), makan otomatis dari kotoran ayam, sortir ukuran, & puasa 3 hari di ember sebelum potong.",
    flowGraph: {
      nodes: [
        {
          id: "lele-node-1",
          position: { x: 40, y: 120 },
          data: {
            label: "1. Tebar Kolam Lele",
            blockType: "INIT_POPULATE",
            description: "Pakan alami dari kotoran ayam di atas kolam",
          },
        },
        {
          id: "lele-node-2",
          position: { x: 310, y: 120 },
          data: {
            label: "2. Sortir Ukuran Kolam",
            blockType: "SORT_TRANSFER",
            description: "Pisah ukuran Kecil (Kolam 1), Sedang (Kolam 2), Besar (Kolam 3)",
          },
        },
        {
          id: "lele-node-3",
          position: { x: 590, y: 120 },
          data: {
            label: "3. Ember Puasa (3 Hari)",
            blockType: "TIMER_QUARANTINE",
            description: "Karantina air bersih 72 jam sebelum dipotong",
            config: { timerHours: 72 },
          },
        },
        {
          id: "lele-node-4",
          position: { x: 860, y: 120 },
          data: {
            label: "4. Siap Potong / Pecel Lele",
            blockType: "TERMINATE_HARVEST",
            description: "Puasa 3 hari selesai, lele bersih & siap dipotong",
          },
        },
      ],
      edges: [
        { id: "e-l1-2", source: "lele-node-1", target: "lele-node-2", label: "Sortir Mandiri" },
        { id: "e-l2-3", source: "lele-node-2", target: "lele-node-3", label: "Pindah Ember" },
        { id: "e-l3-4", source: "lele-node-3", target: "lele-node-4", label: "Timer 72 Jam" },
      ],
    },
  };

  await localDb.farmModules.bulkPut([ayamModule, leleModule]);

  // 2. Seed Containers: 3 Ponds -> 6 Cage Sets -> 36 Chicken Slots + 1 Fasting Bucket
  const containersToSeed: LocalContainer[] = [];
  const subjectsToSeed: LocalSubject[] = [];

  const pondSizes: Array<"SMALL" | "MEDIUM" | "LARGE"> = ["SMALL", "MEDIUM", "LARGE"];
  const pondPopulations = [450, 320, 180];

  let globalChickenNumber = 1;

  for (let p = 1; p <= 3; p++) {
    const pondId = `pond-${p}`;
    const sizeGrade = pondSizes[p - 1];
    containersToSeed.push({
      id: pondId,
      parentId: null,
      moduleId: "mod-lele-konsumsi",
      name: `Kolam Lele ${p} (${sizeGrade === "SMALL" ? "Ukuran Kecil" : sizeGrade === "MEDIUM" ? "Ukuran Sedang" : "Ukuran Besar"})`,
      code: `KOLAM-${p}`,
      containerType: "POND",
      status: "ACTIVE",
      sortOrder: p,
      sizeGrade,
    });

    subjectsToSeed.push({
      id: `subj-lele-pond-${p}`,
      moduleId: "mod-lele-konsumsi",
      containerId: pondId,
      label: `Batch Lele Kolam ${p}`,
      populationCount: pondPopulations[p - 1],
      sizeCategory: sizeGrade,
      currentNodeId: "lele-node-2",
      consecutiveZeroYieldDays: 0,
      isRecommendedForCut: false,
      isActive: true,
    });

    // 2 Cage Sets per Pond (Set A & Set B)
    for (const setLetter of ["A", "B"]) {
      const setId = `set-${p}${setLetter.toLowerCase()}`;
      containersToSeed.push({
        id: setId,
        parentId: pondId,
        moduleId: "mod-ayam-petelur",
        name: `Set Kandang ${p}${setLetter}`,
        code: `SET-${p}${setLetter}`,
        containerType: "CAGE_SET",
        status: "ACTIVE",
        sortOrder: setLetter === "A" ? 1 : 2,
      });

      // 6 Chicken Slots per Cage Set (Total 36 Slots)
      for (let s = 1; s <= 6; s++) {
        const slotId = `slot-${p}${setLetter.toLowerCase()}-${s}`;
        const chickenNum = globalChickenNumber++;

        // Simulate realistic field states:
        // - Slot #5 is VACANT (empty, auto-skipped when feeding)
        // - Slot #14 is in MAINTENANCE (broken wire, auto-skipped)
        // - Chicken #9 & #22 have stopped laying eggs for >= 8 days (Recommended for Cut / Afkir!)
        const isVacant = chickenNum === 5 || chickenNum === 29;
        const isMaintenance = chickenNum === 14;

        containersToSeed.push({
          id: slotId,
          parentId: setId,
          moduleId: "mod-ayam-petelur",
          name: `Kandang #${chickenNum}`,
          code: `KANDANG-${chickenNum}`,
          containerType: "CAGE_SLOT",
          status: isMaintenance ? "MAINTENANCE" : isVacant ? "VACANT" : "ACTIVE",
          maintenanceNote: isMaintenance ? "Kawat pintu bawah longgar, perlu diikat ulang" : undefined,
          sortOrder: s,
        });

        if (!isVacant && !isMaintenance) {
          const zeroDays = chickenNum === 9 ? 9 : chickenNum === 22 ? 8 : chickenNum % 4 === 0 ? 2 : 0;
          subjectsToSeed.push({
            id: `subj-ayam-${chickenNum}`,
            moduleId: "mod-ayam-petelur",
            containerId: slotId,
            label: `Ayam #${String(chickenNum).padStart(2, "0")}`,
            populationCount: 1,
            currentNodeId: zeroDays >= 7 ? "ayam-node-4" : "ayam-node-3",
            consecutiveZeroYieldDays: zeroDays,
            isRecommendedForCut: zeroDays >= 7,
            isActive: true,
            fedToday: false,
            eggHarvestedToday: false,
          });
        }
      }
    }
  }

  // Ember Karantina / Puasa Lele (3 Days = 72 Hours)
  const bucketId = "bucket-puasa-1";
  containersToSeed.push({
    id: bucketId,
    parentId: null,
    moduleId: "mod-lele-konsumsi",
    name: "Ember Kecil (Puasa Lele 3 Hari)",
    code: "EMBER-PUASA",
    containerType: "QUARANTINE_BUCKET",
    status: "ACTIVE",
    sortOrder: 99,
  });

  // Seed 1 active fasting batch started 48 hours ago (1 day remaining!)
  const now = new Date();
  const started48hAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const endsIn24h = new Date(started48hAgo.getTime() + 72 * 60 * 60 * 1000);

  subjectsToSeed.push({
    id: "subj-lele-puasa-1",
    moduleId: "mod-lele-konsumsi",
    containerId: bucketId,
    label: "Sortiran Tukang Pecel Lele (Batch #1)",
    populationCount: 25,
    sizeCategory: "READY_TO_CUT",
    currentNodeId: "lele-node-3",
    consecutiveZeroYieldDays: 0,
    isRecommendedForCut: false,
    timerStartedAt: started48hAgo.toISOString(),
    timerEndsAt: endsIn24h.toISOString(),
    isActive: true,
  });

  await localDb.containers.bulkPut(containersToSeed);
  await localDb.subjects.bulkPut(subjectsToSeed);

  // 3. Seed Historical Feed Purchases (25kg sacks)
  const twentyDaysAgo = new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000);
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

  await localDb.feedPurchases.bulkPut([
    {
      id: "feed-1",
      feedName: "Pakan Ayam Petelur Komplit (Karung 25kg)",
      weightKg: 25,
      priceIdr: 215000,
      purchasedAt: twentyDaysAgo.toISOString(),
      notes: "Habis dalam ~14 hari untuk 33 ayam aktif",
    },
    {
      id: "feed-2",
      feedName: "Pakan Ayam Petelur Komplit (Karung 25kg)",
      weightKg: 25,
      priceIdr: 215000,
      purchasedAt: sixDaysAgo.toISOString(),
      notes: "Karung aktif saat ini (+ ada serep di gudang)",
    },
  ]);
}
