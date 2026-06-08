-- bizfinder :: business photos (enrichment)
-- photo_source: og | logo | mapillary | places | category | manual
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS photo_source text;
