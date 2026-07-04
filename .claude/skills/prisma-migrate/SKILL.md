---
name: prisma-migrate
description: Run Prisma migrations, generate client, and update shared DTOs. Use when modifying the database schema or adding new models.
---

## When modifying the Prisma schema

1. Edit `packages/backend/prisma/schema.prisma`
2. Run migration (Docker Postgres must be up: `docker compose up -d`):
   ```bash
   cd packages/backend && npx prisma migrate dev --name <descriptive-name>
   ```
3. Regenerate the Prisma client:
   ```bash
   cd packages/backend && npx prisma generate
   ```
   ⚠️ The client is generated at the CUSTOM path `packages/backend/src/generated/prisma` (not `node_modules`). The generated files are committed. Backend code imports it as `../generated/prisma/client.js` — with the `.js` ESM extension.
4. Update shared DTOs in `packages/shared/src/dto/` if the model is exposed via API

## Custom SQL migrations (constraints, extensions, raw SQL)

For anything the Prisma schema language can't express (exclusion constraints, `CREATE EXTENSION`, partial indexes):

```bash
cd packages/backend && npx prisma migrate dev --create-only --name <name>
# edit the generated migration.sql by hand
npx prisma migrate dev   # applies it
```

Precedent in this repo: the `Appointment` anti-double-booking exclusion constraint (`btree_gist` + `EXCLUDE USING gist` over `tsrange(startTime, endTime)` `WHERE status = 'CONFIRMED'`). If you touch appointment time columns or statuses, check that constraint's migration first.

## Rules

- **Always** add `tenantId String` to new models (except the `Tenant` model itself)
- **Always** add `@@index([tenantId])` for tenant-scoped queries
- Use `deletedAt DateTime?` for soft-deletable models (Employee, Service)
- `DateTime` columns store UTC instants; wall-clock interpretation (`America/Mexico_City`) happens only via `@agendly/shared` datetime utils
- **Transactions in app code are batch-only** (`$transaction([...])`) — `@prisma/adapter-pg` does not support interactive transactions. Design invariants as DB constraints, not check-then-insert.
- Use descriptive migration names: `add-employee-model`, `add-appointment-no-overlap-constraint`
- After migration, verify with `npx prisma studio` if needed
