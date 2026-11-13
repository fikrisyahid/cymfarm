CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"container_id" text NOT NULL,
	"subject_id" text,
	"activity_type" text NOT NULL,
	"quantity" integer DEFAULT 1,
	"note" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"synced_to_cloud" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" text PRIMARY KEY NOT NULL,
	"parent_id" text,
	"module_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"container_type" text NOT NULL,
	"status" text DEFAULT 'VACANT' NOT NULL,
	"maintenance_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_module_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '🌾' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "farm_modules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"tracking_mode" text NOT NULL,
	"description" text,
	"flow_graph" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '🌾' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feed_purchases" (
	"id" text PRIMARY KEY NOT NULL,
	"feed_name" text NOT NULL,
	"category" text DEFAULT 'AYAM' NOT NULL,
	"weight_kg" numeric(8, 2) NOT NULL,
	"price_idr" integer,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"container_id" text NOT NULL,
	"label" text NOT NULL,
	"population_count" integer DEFAULT 1 NOT NULL,
	"size_category" text,
	"current_node_id" text NOT NULL,
	"consecutive_zero_yield_days" integer DEFAULT 0 NOT NULL,
	"is_recommended_for_cut" boolean DEFAULT false NOT NULL,
	"timer_started_at" timestamp,
	"timer_ends_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"terminated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_module_id_farm_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."farm_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_module_id_farm_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."farm_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;