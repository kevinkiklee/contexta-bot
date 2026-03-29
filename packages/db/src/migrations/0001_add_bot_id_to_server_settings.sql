-- Add bot_id column to server_settings and change PK to (server_id, bot_id)
ALTER TABLE "server_settings" ADD COLUMN "bot_id" varchar(255) NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "server_settings" DROP CONSTRAINT "server_settings_pkey";
--> statement-breakpoint
ALTER TABLE "server_settings" ADD CONSTRAINT "server_settings_server_id_bot_id_pk" PRIMARY KEY ("server_id", "bot_id");
--> statement-breakpoint
-- Drop the FK from server_members since server_id is no longer the sole PK
ALTER TABLE "server_members" DROP CONSTRAINT IF EXISTS "server_members_server_id_server_settings_server_id_fk";
