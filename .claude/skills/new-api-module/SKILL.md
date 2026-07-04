---
name: new-api-module
description: Scaffold a new NestJS API module with controller, service, DTOs, and tests. Use when creating a new backend feature.
---

## Steps to create a new NestJS module

1. Create the module directory:
   ```
   packages/backend/src/<module-name>/
   ```

2. Create these files:
   - `<module-name>.module.ts` — NestJS module with imports, controllers, providers
   - `<module-name>.controller.ts` — REST endpoints ONLY (guards + DTOs + delegation; never injects `PrismaService`)
   - `<module-name>.service.ts` — Business logic; owns `PrismaService` (no repository layer in this project — deliberate decision)
   - `dto/create-<entity>.dto.ts` — class-validator; enums imported from `@agendly/shared`, never redeclared
   - `dto/update-<entity>.dto.ts` — PartialType of create DTO
   - `<module-name>.service.spec.ts` — mandatory if the service has business logic (mock `PrismaService`, see `src/auth/auth.service.spec.ts`)

3. Register the module in `packages/backend/src/app.module.ts`

4. Add shared response DTOs/types to `packages/shared/src/dto/` for frontend consumption

## Rules

- **Protected endpoints:** `@UseGuards(JwtAuthGuard, TenantGuard)` + `@CurrentTenant() tenantId: string` (decorator in `src/common/decorators/current-tenant.decorator.ts`). Do not read `request.tenantId` by hand.
- **Every query filters `tenantId`**; soft-deletable models also filter `deletedAt: null` (and `isActive: true` for public/bookable flows).
- **ESM imports:** relative imports need the `.js` extension; Prisma types come from `../generated/prisma/client.js`.
- **Transactions:** batch mode only — `$transaction([op1, op2])`. Interactive `$transaction(async (tx) => …)` fails with `@prisma/adapter-pg`.
- **Errors:** Nest HTTP exceptions with Spanish messages; use `ensureExists` from `src/common/prisma/ensure-exists.ts` for load-or-404.
- **Query params** are validated with a DTO class too, not raw `@Query('x') x: string`.
- Return shared DTOs (map via a dedicated mapper function), never raw Prisma models.
- Datetime fields cross the wire as UTC ISO with `Z`; use `@agendly/shared` datetime utils for all timezone math.
- Follow the full ruleset in the `nestjs-best-practices` skill.
