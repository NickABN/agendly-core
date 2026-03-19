---
name: prisma-migrate
description: Run Prisma migrations, generate client, and update shared DTOs. Use when modifying the database schema or adding new models.
---

## When modifying the Prisma schema

1. Edit `packages/backend/prisma/schema.prisma`
2. Run migration:
   ```bash
   cd packages/backend && npx prisma migrate dev --name <descriptive-name>
   ```
3. Regenerate the Prisma client:
   ```bash
   cd packages/backend && npx prisma generate
   ```
4. Update shared DTOs in `packages/shared/src/` if the model is exposed via API

## Rules

- **Always** add `tenantId String` to new models (except the `Tenant` model itself)
- **Always** add `@@index([tenantId])` for tenant-scoped queries
- Use `deletedAt DateTime?` for soft-deletable models (Employee, Service)
- Use descriptive migration names: `add-employee-model`, `add-schedule-exceptions`
- After migration, verify with `npx prisma studio` if needed
