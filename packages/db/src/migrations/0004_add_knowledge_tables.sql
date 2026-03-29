-- Knowledge entries: the core unit of extracted knowledge
CREATE TABLE knowledge_entries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  type            varchar(50) NOT NULL,
  title           varchar(500) NOT NULL,
  content         text NOT NULL,
  confidence      real NOT NULL DEFAULT 0.5,
  source_channel_id varchar(255),
  source_message_ids text[] DEFAULT '{}',
  embedding       vector(768),
  metadata        jsonb DEFAULT '{}',
  is_archived     boolean NOT NULL DEFAULT false,
  is_pinned       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ke_server_type ON knowledge_entries (server_id, type);
CREATE INDEX idx_ke_confidence ON knowledge_entries (server_id, confidence DESC);
CREATE INDEX idx_ke_embedding ON knowledge_entries USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_ke_created ON knowledge_entries (server_id, created_at DESC);

-- Lightweight graph edges between knowledge entries
CREATE TABLE knowledge_entry_links (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  target_id       uuid NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  relationship    varchar(50) NOT NULL,
  created_by      varchar(50) NOT NULL DEFAULT 'pipeline',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_id, target_id, relationship)
);

CREATE INDEX idx_kel_source ON knowledge_entry_links (source_id);
CREATE INDEX idx_kel_target ON knowledge_entry_links (target_id);

-- Structured rolling channel summaries
CREATE TABLE channel_summaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  channel_id      varchar(255) NOT NULL,
  period_start    timestamptz NOT NULL,
  period_end      timestamptz NOT NULL,
  summary         text NOT NULL,
  topics          text[] DEFAULT '{}',
  decisions       text[] DEFAULT '{}',
  open_questions  text[] DEFAULT '{}',
  action_items    text[] DEFAULT '{}',
  embedding       vector(768),
  message_count   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cs_channel_time ON channel_summaries (server_id, channel_id, period_end DESC);
CREATE INDEX idx_cs_embedding ON channel_summaries USING hnsw (embedding vector_cosine_ops);

-- Per-user topic expertise scores
CREATE TABLE user_expertise (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         varchar(255) NOT NULL,
  server_id       varchar(255) NOT NULL,
  topic           varchar(255) NOT NULL,
  score           real NOT NULL DEFAULT 0.0,
  message_count   integer NOT NULL DEFAULT 0,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, server_id, topic)
);

CREATE INDEX idx_ue_server_topic ON user_expertise (server_id, topic, score DESC);
CREATE INDEX idx_ue_user ON user_expertise (user_id, server_id);

-- Generated reports
CREATE TABLE reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id       varchar(255) NOT NULL,
  template        varchar(50) NOT NULL,
  title           varchar(500) NOT NULL,
  content         text NOT NULL,
  generated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_server ON reports (server_id, generated_at DESC);
