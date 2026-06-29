-- Business owner accounts: registration, claim-by-verification, and editable fields.
-- All additive / idempotent.

-- Owner-editable contact + meta on the canonical business.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS phone text;        -- display contact (search/dedup phones live in phone_numbers)
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS hours jsonb;       -- opening hours, owner-editable
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS is_owner_submitted boolean NOT NULL DEFAULT false;

-- Short-lived one-time codes for email verification (login / register / claim).
CREATE TABLE IF NOT EXISTS verification_codes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email       text NOT NULL,
  code_hash   text NOT NULL,                 -- sha256(code) — never store the raw code
  purpose     text NOT NULL,                 -- 'login' | 'register' | 'claim'
  business_id bigint REFERENCES businesses(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts    int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_codes_lookup_idx
  ON verification_codes(email, purpose, created_at DESC);

-- Owner login sessions (bearer token, hashed at rest).
CREATE TABLE IF NOT EXISTS sessions (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  token_hash  text NOT NULL UNIQUE,          -- sha256(token)
  account_id  bigint NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_account_idx ON sessions(account_id);
