import {
  pgTable,
  text,
  timestamp,
  integer,
  numeric,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Clean & Truly Modular Farm Lifecycle Definition:
 * 1. Init: Nama wadah, kode QR, kapasitas, mode tracking (Individu / Batch)
 * 2. Routine: Aksi rawat harian (siram/pakan) & Aksi panen berkala (telur/jamur/daun)
 * 3. Terminate: Aksi panen akhir / selesai siklus
 */
export interface ModularFarmConfig {
  // Label aksi harian (misal: "Kasih Makan", "Semprot Kabut Air", "Siram AB Mix")
  routineActionLabel: string;
  
  // Tipe panen
  harvestType: "RECURRING" | "ONCE"; // RECURRING = berkala (ayam/jamur/cabai), ONCE = sekaligus (lele/sayur cabut/kambing)
  harvestActionLabel: string; // misal: "Panen Telur", "Petik Jamur", "Panen Total & Kosongkan"
  harvestUnitLabel?: string; // misal: "butir", "kg", "ikat"

  // Threshold alert keterlambatan panen (dalam hari). 0 = dimatikan / tidak ada alert
  harvestAlertDays?: number; // default: 0 untuk ONCE, 2 untuk RECURRING
}

/**
 * 1. FARM MODULES & CATEGORIES
 */
export const farmModuleCategories = pgTable("farm_module_categories", {
  id: text("id").primaryKey(), // e.g. 'cat-ayam', 'cat-jamur'
  name: text("name").notNull(), // e.g. 'Peternakan Unggas', 'Jamur & Fungi'
  icon: text("icon").default("🌾").notNull(), // e.g. '🐓', '🍄'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const farmModules = pgTable("farm_modules", {
  id: text("id").primaryKey(), // e.g. 'mod-ayam-petelur', 'mod-jamur-tiram'
  name: text("name").notNull(), // e.g. 'Jamur Tiram Baglog'
  category: text("category").notNull(), // 'LIVESTOCK' | 'PLANT' | etc
  trackingMode: text("tracking_mode").notNull(), // 'INDIVIDUAL' | 'BATCH'
  description: text("description"),
  config: jsonb("config").$type<ModularFarmConfig>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * 2. CONTAINERS (Wadah Fisik: Kumbung Rak, Kandang Baterai, Kolam)
 */
export type ContainerStatus = "ACTIVE" | "VACANT" | "MAINTENANCE";

export const containers = pgTable("containers", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .references(() => farmModules.id)
    .notNull(),
  name: text("name").notNull(), // e.g. 'Kumbung Rak A'
  code: text("code").notNull(), // QR Code slug, e.g. 'RAK-A'
  capacity: integer("capacity").default(1).notNull(), // Kapasitas baglog/ikan/ayam
  status: text("status").$type<ContainerStatus>().default("ACTIVE").notNull(),
  maintenanceNote: text("maintenance_note"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 3. SUBJECTS (Penghuni / Batch Aktif di Wadah)
 */
export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .references(() => farmModules.id)
    .notNull(),
  containerId: text("container_id")
    .references(() => containers.id)
    .notNull(),
  label: text("label").notNull(), // e.g. 'Baglog Angkatan 1'
  populationCount: integer("population_count").default(1).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastRoutineDate: text("last_routine_date"), // YYYY-MM-DD
  lastHarvestDate: text("last_harvest_date"), // YYYY-MM-DD
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  terminatedAt: timestamp("terminated_at"),
});

/**
 * 4. ACTIVITY LOGS (Riwayat Harian Pekerja Lapangan)
 */
export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull(),
  containerId: text("container_id").notNull(),
  subjectId: text("subject_id"),
  activityType: text("activity_type").notNull(), // 'ROUTINE' | 'HARVEST' | 'MAINTENANCE' | 'TERMINATE'
  quantity: numeric("quantity", { precision: 8, scale: 2 }).default("1"),
  unit: text("unit"),
  note: text("note"),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  syncedToCloud: boolean("synced_to_cloud").default(true).notNull(),
});

/**
 * 5. FEED & LOGISTICS (Pembelian Pakan & Kategori)
 */
export const feedCategories = pgTable("feed_categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  icon: text("icon").default("🌾").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedPurchases = pgTable("feed_purchases", {
  id: text("id").primaryKey(),
  feedName: text("feed_name").notNull(),
  category: text("category").default("AYAM").notNull(),
  weightKg: numeric("weight_kg", { precision: 8, scale: 2 }).notNull(),
  priceIdr: integer("price_idr"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  notes: text("notes"),
});
