-- Btree index on businesses.normalized_name for exact-equality lookups during
-- entity resolution (the geo match: normalized_name = $1 AND ST_DWithin(...)).
-- The existing trgm GIN index only serves LIKE/similarity, not '=', so without
-- this the resolver seq-scanned the growing businesses table on every record.
CREATE INDEX IF NOT EXISTS businesses_normname_idx ON businesses (normalized_name);
