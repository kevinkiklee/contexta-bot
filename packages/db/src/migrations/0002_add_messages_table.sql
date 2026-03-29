-- Durable message store for dashboard history, search, and analytics.
CREATE TABLE IF NOT EXISTS messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id     varchar(255) NOT NULL,
  channel_id    varchar(255) NOT NULL,
  user_id       varchar(255) NOT NULL,
  display_name  varchar(255) NOT NULL,
  content       text NOT NULL,
  is_bot        boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  embedding     vector(768),
  search_vec    tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_time ON messages (server_id, channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_search ON messages USING GIN (search_vec);
CREATE INDEX IF NOT EXISTS idx_messages_embedding ON messages USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages (server_id, user_id);
