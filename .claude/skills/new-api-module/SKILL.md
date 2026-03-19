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
   - `<module-name>.controller.ts` — REST endpoints
   - `<module-name>.service.ts` — Business logic
   - `dto/create-<entity>.dto.ts` — Validated with class-validator
   - `dto/update-<entity>.dto.ts` — PartialType of create DTO
   - `<module-name>.controller.spec.ts` — Controller tests
   - `<module-name>.service.spec.ts` — Service tests

3. Register the module in `packages/backend/src/app.module.ts`

4. Add shared DTOs to `packages/shared/src/` for frontend consumption

## Rules

- **All protected endpoints must use `TenantGuard`** to scope data to the current tenant
- Use `@UseGuards(JwtAuthGuard, TenantGuard)` on controllers or routes
- Inject `PrismaService` for database access
- Always filter by `tenantId` in Prisma queries
- Use `class-validator` decorators for input validation
- Return shared DTOs, not raw Prisma models
