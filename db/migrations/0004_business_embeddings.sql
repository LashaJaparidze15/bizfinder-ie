-- bizfinder :: business embeddings for semantic "similar businesses" (pgvector)
-- 384-dim matches BAAI/bge-small-en-v1.5 (the fastembed default model).
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS embedding vector(384);
CREATE INDEX IF NOT EXISTS businesses_embedding_idx
  ON businesses USING hnsw (embedding vector_cosine_ops);
