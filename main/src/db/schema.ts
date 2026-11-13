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
 * 7 Lego Block Primitive Types for the Dynamic Module Flow Builder
 */
export type LegoBlockType =
  | "INIT_POPULATE"
  | "DAILY_ROUTINE"
  | "RECURRING_YIELD"
  | "SORT_TRANSFER"
  | "TIMER_QUARANTINE"
  | "AUTO_RULE"
  | "TERMINATE_HARVEST";

export interface FlowNodeData extends Record<string, unknown> {
  label: string;
  blockType: LegoBlockType;
  description?: string;
  config?: {
    autoSkipVacant?: boolean;
    timerHours?: number; // e.g., 72 hours for 3-day Lele fasting
    zeroYieldThresholdDays?: number; // e.g., 10 days of 0 eggs -> recommend cut
    actionButtons?: Array<{
      id: string;
      label: string;
      actionType: "FEED" | "YIELD_TOGGLE" | "SORT" | "START_TIMER" | "TERMINATE";
    }>;
  };
}

export interface FlowGraphDefinition {
  nodes: Array<{
    id: string;
    type?: string;
    position: { x: number; y: number };
    data: FlowNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
}

/**
 * 1. FARM MODULES (Dynamic Blueprint & Flow Definition)
 */
export const farmModules = pgTable("farm_modules", {
  id: text("id").primaryKey(), // e.g. 'mod-ayam-petelur', 'mod-lele-konsumsi'
  name: text("name").notNull(),
  category: text("category").notNull(), // 'LIVESTOCK' | 'AQUACULTURE' | 'PLANT'
  trackingMode: text("tracking_mode").notNull(), // 'INDIVIDUAL' (Ayam) | 'BATCH' (Lele)
  description: text("description"),
  flowGraph: jsonb("flow_graph").$type<FlowGraphDefinition>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * 2. CONTAINERS (Flexible Physical Layout Hierarchy: Kolam -> Set Kandang -> Slot Kandang)
 */
export type ContainerStatus = "ACTIVE" | "VACANT" | "MAINTENANCE" | "ARCHIVED";
export type ContainerType = "POND" | "CAGE_SET" | "CAGE_SLOT" | "QUARANTINE_BUCKET" | "CUSTOM";

export const containers = pgTable("containers", {
  id: text("id").primaryKey(), // e.g. 'pond-1', 'set-1a', 'slot-1a-1', 'bucket-fasting-1'
  parentId: text("parent_id"), // Self-reference: Set 1A -> Pond 1, Slot 1 -> Set 1A
  moduleId: text("module_id")
    .references(() => farmModules.id)
    .notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(), // QR scan code slug
  containerType: text("container_type").$type<ContainerType>().notNull(),
  status: text("status").$type<ContainerStatus>().default("VACANT").notNull(),
  maintenanceNote: text("maintenance_note"), // Filled when status === 'MAINTENANCE' (e.g. bocor/kawat rusak)
  sortOrder: integer("sort_order").default(0).notNull(),
  metadata: jsonb("metadata").$type<{
    sizeGrade?: "SMALL" | "MEDIUM" | "LARGE"; // For Lele ponds
    capacity?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * 3. SUBJECTS (Occupants inside Containers: Individual Chicken or Batch of Catfish)
 */
export const subjects = pgTable("subjects", {
  id: text("id").primaryKey(),
  moduleId: text("module_id")
    .references(() => farmModules.id)
    .notNull(),
  containerId: text("container_id")
    .references(() => containers.id)
    .notNull(),
  label: text("label").notNull(), // e.g. 'Ayam #01' or 'Batch Lele Kolam 1'
  populationCount: integer("population_count").default(1).notNull(), // 1 for Individual Ayam, N for Lele Batch
  sizeCategory: text("size_category"), // 'SMALL' | 'MEDIUM' | 'LARGE' | 'READY_TO_CUT'
  currentNodeId: text("current_node_id").notNull(), // Current stage in the module's React Flow graph
  consecutiveZeroYieldDays: integer("consecutive_zero_yield_days").default(0).notNull(),
  isRecommendedForCut: boolean("is_recommended_for_cut").default(false).notNull(),
  timerStartedAt: timestamp("timer_started_at"), // For 3-day Lele fasting
  timerEndsAt: timestamp("timer_ends_at"), // 72h after timerStartedAt
  isActive: boolean("is_active").default(true).notNull(),
  enteredAt: timestamp("entered_at").defaultNow().notNull(),
  terminatedAt: timestamp("terminated_at"),
});

/**
 * 4. ACTIVITY LOGS (Immutable Historical Events - Preserved even if containers are upgraded/archived)
 */
export type ActivityCategory =
  | "ALL"
  | "OPERASIONAL"
  | "LOGISTIK"
  | "STRUKTURAL"
  | "SISTEM";

export type ActivityType =
  | "FEED"
  | "EGG_HARVEST"
  | "SORT_TRANSFER"
  | "START_FASTING"
  | "FINISH_FASTING_CUT"
  | "MAINTENANCE_SET"
  | "MAINTENANCE_RESOLVED"
  | "EVACUATE_SUBJECT"
  | "POPULATE_SUBJECT"
  | "AFKIR_CUT"
  | "FEED_PURCHASE_CREATE"
  | "FEED_PURCHASE_UPDATE"
  | "FEED_PURCHASE_DELETE"
  | "FEED_CATEGORY_CREATE"
  | "CONTAINER_CREATE"
  | "CONTAINER_UPDATE"
  | "MODULE_FLOW_UPDATE"
  | "MODULE_CREATE";

export const activityLogs = pgTable("activity_logs", {
  id: text("id").primaryKey(),
  moduleId: text("module_id").notNull(),
  containerId: text("container_id").notNull(),
  subjectId: text("subject_id"),
  activityType: text("activity_type").$type<ActivityType>().notNull(),
  quantity: integer("quantity").default(1), // e.g., 1 egg, or 25 catfish moved to fasting bucket
  note: text("note"),
  performedAt: timestamp("performed_at").defaultNow().notNull(),
  syncedToCloud: boolean("synced_to_cloud").default(true).notNull(),
});

/**
 * 5. FEED PURCHASES & CATEGORIES (Independent Feed & Logistics Management)
 */
export type FeedCategory = string; // Dynamic custom categories or default: "AYAM" | "IKAN" | "TANAMAN" | "LAINNYA"

export const feedCategories = pgTable("feed_categories", {
  id: text("id").primaryKey(), // e.g. 'cat-ayam', 'cat-bebek'
  name: text("name").notNull(), // e.g. 'Pakan Bebek'
  icon: text("icon").default("🌾").notNull(), // e.g. '🦆'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedPurchases = pgTable("feed_purchases", {
  id: text("id").primaryKey(),
  feedName: text("feed_name").notNull(), // e.g. 'Pakan Ayam Petelur Karung 25kg'
  category: text("category").default("AYAM").notNull(),
  weightKg: numeric("weight_kg", { precision: 8, scale: 2 }).notNull(), // e.g. 25.00
  priceIdr: integer("price_idr"), // Optional price
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  notes: text("notes"),
});
