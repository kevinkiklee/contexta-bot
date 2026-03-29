CREATE TABLE "channel_memory_vectors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"server_id" varchar(255) NOT NULL,
	"channel_id" varchar(255) NOT NULL,
	"summary_text" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"time_start" timestamp NOT NULL,
	"time_end" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "global_users" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"global_name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"last_interaction" timestamp
);
--> statement-breakpoint
CREATE TABLE "server_members" (
	"server_id" varchar(255) NOT NULL,
	"user_id" varchar(255),
	"inferred_context" text,
	"preferences" jsonb DEFAULT '{}',
	"interaction_count" integer DEFAULT 0,
	CONSTRAINT "server_members_server_id_user_id_pk" PRIMARY KEY("server_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "server_settings" (
	"server_id" varchar(255) NOT NULL,
	"bot_id" varchar(255) DEFAULT 'unknown' NOT NULL,
	"active_model" varchar(50) DEFAULT 'gemini-2.5-flash',
	"server_lore" text,
	"context_cache_id" varchar(255),
	"cache_expires_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "server_settings_server_id_bot_id_pk" PRIMARY KEY("server_id","bot_id")
);
--> statement-breakpoint
CREATE TABLE "user_servers" (
	"user_id" text NOT NULL,
	"server_id" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_servers_user_id_server_id_pk" PRIMARY KEY("user_id","server_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "server_members" ADD CONSTRAINT "server_members_user_id_global_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."global_users"("user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_servers" ADD CONSTRAINT "user_servers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_memory_meta_idx" ON "channel_memory_vectors" USING btree ("server_id","channel_id");--> statement-breakpoint
CREATE INDEX "idx_user_servers_server" ON "user_servers" USING btree ("server_id");