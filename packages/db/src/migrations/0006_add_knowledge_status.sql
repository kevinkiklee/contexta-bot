-- Add status column to knowledge_entries
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS status varchar(20) NOT NULL DEFAULT 'published';

CREATE INDEX IF NOT EXISTS idx_ke_status ON knowledge_entries (server_id, status);

-- Backfill approval config into existing knowledge_config
UPDATE server_settings
SET knowledge_config = knowledge_config || '{"autoPublishThreshold": 0.7, "reviewRequired": false}'::jsonb
WHERE knowledge_config IS NOT NULL
  AND NOT (knowledge_config ? 'autoPublishThreshold');
