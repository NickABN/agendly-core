-- Normalize existing Mexican phone numbers to E.164 (+52XXXXXXXXXX).
--
-- Mirrors the shared normalizeMxPhone() rules (packages/shared/src/phone.ts)
-- against the digits-only form of each stored value, and ONLY rewrites rows
-- whose format is unambiguous:
--   * 10 digits                         -> '+52' || digits
--   * 12 digits starting '52'           -> '+'   || digits            (-> +52XXXXXXXXXX)
--   * 13 digits starting '521'          -> '+52' || substr(digits, 4) (drop the legacy 1)
--   * 13 digits starting '044' / '045'  -> '+52' || substr(digits, 4) (drop legacy prefix,
--                                          only when the raw value had no leading '+')
-- Values containing anything besides digits, spaces, + ( ) . - are skipped,
-- matching normalizeMxPhone() which rejects letters.
-- Any other value (wrong length, other country code, already-formatted) is
-- left untouched. Already-normalized rows ('+52' + 10 digits) are skipped by
-- the guard, so the migration is idempotent and safe to re-run.
--
-- No schema change: this is a pure data backfill (clientPhone is the client's
-- identity, so collapsing variants to one canonical value re-unifies history).

-- ── Appointment.clientPhone ──
UPDATE "Appointment"
SET "clientPhone" = '+52' || regexp_replace("clientPhone", '[^0-9]', '', 'g')
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "Appointment"
SET "clientPhone" = '+' || regexp_replace("clientPhone", '[^0-9]', '', 'g')
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^52[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "Appointment"
SET "clientPhone" = '+52' || substr(regexp_replace("clientPhone", '[^0-9]', '', 'g'), 4)
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^521[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "Appointment"
SET "clientPhone" = '+52' || substr(regexp_replace("clientPhone", '[^0-9]', '', 'g'), 4)
WHERE "clientPhone" !~ '^\+'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^(044|045)[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

-- ── PrivacyConsent.clientPhone ──
UPDATE "PrivacyConsent"
SET "clientPhone" = '+52' || regexp_replace("clientPhone", '[^0-9]', '', 'g')
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "PrivacyConsent"
SET "clientPhone" = '+' || regexp_replace("clientPhone", '[^0-9]', '', 'g')
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^52[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "PrivacyConsent"
SET "clientPhone" = '+52' || substr(regexp_replace("clientPhone", '[^0-9]', '', 'g'), 4)
WHERE "clientPhone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^521[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

UPDATE "PrivacyConsent"
SET "clientPhone" = '+52' || substr(regexp_replace("clientPhone", '[^0-9]', '', 'g'), 4)
WHERE "clientPhone" !~ '^\+'
  AND regexp_replace("clientPhone", '[^0-9]', '', 'g') ~ '^(044|045)[0-9]{10}$'
  AND "clientPhone" ~ '^[+0-9 ().-]+$';

-- ── Tenant.phone (nullable) ──
UPDATE "Tenant"
SET "phone" = '+52' || regexp_replace("phone", '[^0-9]', '', 'g')
WHERE "phone" IS NOT NULL
  AND "phone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("phone", '[^0-9]', '', 'g') ~ '^[0-9]{10}$'
  AND "phone" ~ '^[+0-9 ().-]+$';

UPDATE "Tenant"
SET "phone" = '+' || regexp_replace("phone", '[^0-9]', '', 'g')
WHERE "phone" IS NOT NULL
  AND "phone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("phone", '[^0-9]', '', 'g') ~ '^52[0-9]{10}$'
  AND "phone" ~ '^[+0-9 ().-]+$';

UPDATE "Tenant"
SET "phone" = '+52' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 4)
WHERE "phone" IS NOT NULL
  AND "phone" !~ '^\+52[0-9]{10}$'
  AND regexp_replace("phone", '[^0-9]', '', 'g') ~ '^521[0-9]{10}$'
  AND "phone" ~ '^[+0-9 ().-]+$';

UPDATE "Tenant"
SET "phone" = '+52' || substr(regexp_replace("phone", '[^0-9]', '', 'g'), 4)
WHERE "phone" IS NOT NULL
  AND "phone" !~ '^\+'
  AND regexp_replace("phone", '[^0-9]', '', 'g') ~ '^(044|045)[0-9]{10}$'
  AND "phone" ~ '^[+0-9 ().-]+$';
