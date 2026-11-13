CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"container_id" text NOT NULL,
	"subject_id" text,
	"activity_type" text NOT NULL,
	"quantity" numeric(8, 2) DEFAULT '1',
	"unit" text,
	"note" text,
	"performed_at" timestamp DEFAULT now() NOT NULL,
	"synced_to_cloud" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "containers" (
	"id" text PRIMARY KEY NOT NULL,
	"module_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"maintenance_note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
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
	"config" jsonb NOT NULL,
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
	"is_active" boolean DEFAULT true NOT NULL,
	"last_routine_date" text,
	"last_harvest_date" text,
	"entered_at" timestamp DEFAULT now() NOT NULL,
	"terminated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "containers" ADD CONSTRAINT "containers_module_id_farm_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."farm_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_module_id_farm_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "public"."farm_modules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_container_id_containers_id_fk" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE no action ON UPDATE no action;