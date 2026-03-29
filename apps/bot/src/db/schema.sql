-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS server_settings (
    server_id VARCHAR(255) PRIMARY KEY,
    active_model VARCHAR(50) DEFAULT 'gemini-2.5-flash',
    server_lore TEXT,
    context_cache_id VARCHAR(255),
    cache_expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS global_users (
    user_id VARCHAR(255) PRIMARY KEY,
    global_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_interaction TIMESTAMP
);

CREATE TABLE IF NOT EXISTS server_members (
    server_id VARCHAR(255) REFERENCES server_settings(server_id),
    user_id VARCHAR(255) REFERENCES global_users(user_id),
    inferred_context TEXT,
    preferences JSONB DEFAULT '{}',
    interaction_count INT DEFAULT 0,
    PRIMARY KEY (server_id, user_id)
);

CREATE TABLE IF NOT EXISTS channel_memory_vectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    summary_text TEXT NOT NULL,
    embedding VECTOR(768) NOT NULL,
    time_start TIMESTAMP NOT NULL,
    time_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS channel_memory_meta_idx ON channel_memory_vectors (server_id, channel_id);

-- HNSW index for vector similarity search
CREATE INDEX IF NOT EXISTS channel_memory_vector_idx ON channel_memory_vectors USING hnsw (embedding vector_cosine_ops);
