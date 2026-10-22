-- Production works get their own content type (Music Video, Brand & Commercial, Highlight Film, Web Content).
-- Additive only: existing rows keep every value, and code deployed before this column exists keeps working.
-- Apply to the remote DB BEFORE deploying code that writes content_type.
-- Allowed values are validated in functions/api/_lib.js (CONTENT_TYPES); no CHECK so new types need no table rebuild.
ALTER TABLE works ADD COLUMN content_type TEXT NOT NULL DEFAULT '';
