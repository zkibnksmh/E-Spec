BEGIN;

-- Additive ownership identity columns. Existing rows remain NULL and are
-- treated as legacy/unowned; no backfill or ownership claim is performed.
ALTER TABLE specifications
  ADD COLUMN IF NOT EXISTS createdbyuserid varchar(255),
  ADD COLUMN IF NOT EXISTS updatedbyuserid varchar(255);

-- Supports future owner-scoped draft listing and ownership lookups.
CREATE INDEX IF NOT EXISTS idx_specifications_createdbyuserid
  ON specifications (createdbyuserid);

COMMIT;
