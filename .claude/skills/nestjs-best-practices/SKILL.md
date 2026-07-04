---
name: nestjs-best-practices
description: NestJS architecture rules for the Agendly backend. Use when writing, reviewing, or refactoring code in packages/backend to enforce SOLID, multi-tenancy, and error-handling conventions.
metadata:
  version: "2.0.0"
  scope: packages/backend
---

# Agendly NestJS Rules

Project-specific rules distilled for this codebase (NestJS 11 + Prisma 7 + PostgreSQL, ESM, multi-tenant). Every rule below is enforced — cite the rule name in reviews.

## Architecture

### arch-controllers-never-touch-prisma
Controllers do routing, guards, and DTO validation ONLY. They never inject `PrismaService` and never contain business logic. All data access lives in a service.

```ts
// ❌ WRONG — controller querying the database
@Controller('public')
export class PublicController {
  constructor(private readonly prisma: PrismaService) {}
}

// ✅ RIGHT — controller delegates to a service
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}
}
```

### arch-services-own-prisma (no repository layer)
Services inject `PrismaService` directly. This project deliberately does NOT use a repository/interface layer: one ORM, one DB, and Nest's DI already lets specs mock `PrismaService` (see `src/auth/auth.service.spec.ts`). Revisit only if a second data source appears.

### arch-single-responsibility
A service handles ONE domain concern. Split when a service exceeds ~200 lines or mixes concerns (e.g., calendar reads + CRM aggregation + notifications). Pure domain logic (slot generation, timezone math, DTO mappers) goes in plain exported functions or small classes so it can be unit-tested without the Nest testing module.

### arch-shared-helpers
Never re-implement a helper that exists. Known shared locations:
- `@agendly/shared` → datetime utils (`zonedToUtc`, `formatTime`, `utcToDateKey`, …), DTOs, enums.
- `src/common/prisma/ensure-exists.ts` → load-or-404 helper.
- `src/tenant/tenant.mapper.ts` → the single Tenant→DTO mapper.

## Multi-tenancy (non-negotiable)

### tenant-guard-everywhere
Every authenticated route: `@UseGuards(JwtAuthGuard, TenantGuard)` + `@CurrentTenant() tenantId: string` (decorator at `src/common/decorators/current-tenant.decorator.ts`). Public routes resolve the tenant by slug in the service and must verify `tenant.isActive`.

### tenant-scope-every-query
Every Prisma query on tenant-scoped tables filters `tenantId`. Soft-deletable models (Employee, Service) also filter `deletedAt: null`, and bookable/visible flows additionally check `isActive: true`. Ownership of related IDs (employeeId, serviceId) must be validated against the same tenant before use.

## Datetime & wire format

### dates-utc-on-the-wire
All appointment/slot instants cross the API as ISO-8601 UTC with `Z` (`2026-07-03T15:00:00.000Z`). Date-only params are `YYYY-MM-DD` and always mean a day in `America/Mexico_City`. Never emit zoneless datetime strings; never call `new Date()` on a zoneless string. All timezone math uses `@agendly/shared` datetime — do not write local `Intl` conversions in services.

## Errors & side effects

### error-nest-exceptions-only
Throw Nest HTTP exceptions (`NotFoundException`, `ConflictException`, `BadRequestException`) with Spanish user-facing messages. Never `throw new Error(...)` in a request path — it surfaces as a 500.

### side-effects-outside-tx-with-catch
Emails/notifications run AFTER the transaction, fire-and-forget, but always with `.catch()` into a `Logger`:

```ts
this.emailService.sendBookingConfirmation(payload).catch((err) =>
  this.logger.error(`Fallo al enviar confirmación: ${err.message}`),
);
```

## Prisma

### prisma-transactions
Both batch (`$transaction([op1, op2])`) and interactive (`$transaction(async (tx) => …)`) transactions work with `@prisma/adapter-pg` (verified empirically 2026-07-03 on v7.5). Prefer batch when operations are independent. Cross-row invariants under concurrency (e.g., no double-booking) are enforced by DB constraints — a check-then-insert inside a transaction is a UX nicety, not a correctness guarantee.
⚠️ Testing gotcha: the backend jest config maps `../generated/prisma/client.js` to `test/__mocks__/prisma.ts` — a spec instantiating `PrismaClient` gets the mock. For real-DB probes use `npx tsx script.ts`, never jest.

### prisma-esm-imports
Generated client lives at `src/generated/prisma` (custom output). Import types from `../generated/prisma/client.js` — note the `.js` extension; all relative imports in this ESM package need it.

### prisma-no-sequential-writes
Never `await` inside a `for` loop for inserts. Use `createMany` or a batch `$transaction([...])`.

## Validation & security

### validate-at-the-boundary
Every input goes through a class-validator DTO — including `@Query()` params (use a DTO class, not raw strings). Strings get `@IsNotEmpty`/`@MinLength`/`@MaxLength`; enums use `@IsEnum` importing from `@agendly/shared` (never redeclare enums locally). Global pipe runs `whitelist + forbidNonWhitelisted + transform`.

### throttle-public-endpoints
Public endpoints (booking, slots, tenant lookup) carry explicit `@Throttle` limits on top of the global `ThrottlerModule` default.

## Testing

### test-business-logic-mandatory
Availability, booking, and any money-path logic ships with a `.spec.ts` (CLAUDE.md mandate). Pure functions are tested directly; services via `Test.createTestingModule` with `PrismaService` mocked. Cover timezone edges (day boundaries, cross-midnight appointments) explicitly.
