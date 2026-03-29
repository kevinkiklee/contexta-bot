-- Add bot_id column to server_settings and change PK to composite (server_id, bot_id).
-- Supports multi-bot dashboard: each bot instance tracks its own guild membership.
ALTER TABLE "server_settings" ADD COLUMN IF NOT EXISTS "bot_id" varchar(255) NOT NULL DEFAULT 'unknown';
--> statement-breakpoint
ALTER TABLE "server_settings" DROP CONSTRAINT "server_settings_pkey" CASCADE;
--> statement-breakpoint
ALTER TABLE "server_settings" ADD CONSTRAINT "server_settings_server_id_bot_id_pk" PRIMARY KEY ("server_id", "bot_id");
