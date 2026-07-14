-- Festival Navigator crew store — complete Neon/Postgres schema.
-- Idempotent: safe to run on a fresh database or re-run on an existing one.
--   psql "$DATABASE_URL" -f db/schema.sql
--
-- The app performs every crew merge as ONE atomic UPDATE through
-- jsonb_deep_merge(), so there is no read-modify-write race anywhere.
-- api/_lib/crew-shared.mjs holds the readable JS twin of the merge semantics
-- (leaf overwrite wins, objects merge recursively, deletions inexpressible).

CREATE OR REPLACE FUNCTION jsonb_deep_merge(base jsonb, ovl jsonb) RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE result jsonb;
BEGIN
  IF jsonb_typeof(base) = 'object' AND jsonb_typeof(ovl) = 'object' THEN
    SELECT COALESCE(jsonb_object_agg(COALESCE(b.key, o.key),
      CASE WHEN b.value IS NOT NULL AND o.value IS NOT NULL THEN jsonb_deep_merge(b.value, o.value)
           WHEN o.value IS NOT NULL THEN o.value
           ELSE b.value END), '{}'::jsonb)
    INTO result
    FROM jsonb_each(base) b FULL OUTER JOIN jsonb_each(ovl) o ON b.key = o.key;
    RETURN result;
  END IF;
  RETURN COALESCE(ovl, base);
END $fn$;

CREATE TABLE IF NOT EXISTS crews (
  token TEXT PRIMARY KEY CHECK (token ~ '^[A-Za-z0-9_-]{20,40}$'),
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One person across crews (the "me link"). Two identifiers by design:
--   token — the secret credential; holds access to the whole record, which
--           itself lists every crew token the person is in. Master key.
--   id    — public, safe to stamp into crew docs as people.<Name>.pid so a
--           crew can reference a person WITHOUT exposing their credential
--           (crew docs are readable by anyone holding that crew's link).
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9_-]{8,24}$'),
  token TEXT NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{20,40}$'),
  doc JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Crew-private festivals added via LLM research (api/festival-add.js).
-- Provenance travels with the value: source_urls from search grounding,
-- model, who added it, when. The repo's data/festivals/*.json stays canonical
-- for shared festivals; these are scoped to one crew's token.
CREATE TABLE IF NOT EXISTS custom_festivals (
  token TEXT NOT NULL REFERENCES crews(token) ON DELETE CASCADE,
  fest_id TEXT NOT NULL CHECK (fest_id ~ '^[a-z0-9-]{1,64}$'),
  doc JSONB NOT NULL,
  source_urls JSONB,
  model TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (token, fest_id)
);

-- Spotify allowlist requests (the recordOS-style Slack flow, api/access.js).
-- Two separate gates by design: this table only drives in-app UI state; the
-- REAL gate is the owner pasting the email into the Spotify dev dashboard.
CREATE TABLE IF NOT EXISTS access_requests (
  email TEXT PRIMARY KEY CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 254),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ
);
