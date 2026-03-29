-- Add tags column to messages for lightweight per-message classification
ALTER TABLE messages ADD COLUMN tags jsonb DEFAULT NULL;

-- Add knowledge config to server_settings
ALTER TABLE server_settings ADD COLUMN knowledge_config jsonb DEFAULT '{"extraction_enabled": true, "summary_interval": "daily", "cross_channel_enabled": true, "injection_aggressiveness": "assertive"}';
