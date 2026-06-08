-- bizfinder :: first-party reviews (owned review data)
CREATE TABLE IF NOT EXISTS reviews (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id bigint NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rating      smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  author_name text,
  body        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_business_idx ON reviews(business_id, created_at DESC);
