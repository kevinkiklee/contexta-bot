-- Add personality JSONB column to server_settings for structured bot personality config.
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS personality jsonb NOT NULL DEFAULT '{}';
