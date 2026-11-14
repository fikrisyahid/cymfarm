ALTER TABLE "containers" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "containers" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "farm_modules" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "deleted_at" timestamp;