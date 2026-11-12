-- Who withdrew a published IPFS package from this install, and when (src/lib/server/dataSharing/registry.ts).
-- ADD COLUMN IF NOT EXISTS keeps this safe to re-run and adds nothing destructive: existing rows get NULLs.

ALTER TABLE ipfs_published_packages
    ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS withdrawn_by VARCHAR(255);
