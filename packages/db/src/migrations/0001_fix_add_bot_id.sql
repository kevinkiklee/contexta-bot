-- Fix-up: drop the old PK with CASCADE (takes the FK with it), then add composite PK
ALTER TABLE "server_settings" DROP CONSTRAINT "server_settings_pkey" CASCADE;
--> statement-breakpoint
ALTER TABLE "server_settings" ADD CONSTRAINT "server_settings_server_id_bot_id_pk" PRIMARY KEY ("server_id", "bot_id");
