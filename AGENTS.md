# AGENTS.md — Agendly

## Project Overview

Agendly is a SaaS appointment scheduling platform for small beauty and aesthetics businesses in Mexico. It's a pnpm monorepo with three packages:

- `packages/backend` — NestJS 11 REST API with Prisma ORM and PostgreSQL
- `packages/frontend` — Nuxt 3 app with Nuxt UI 3, Tailwind CSS, and Pinia
- `packages/shared` — TypeScript DTOs and types shared between backend and frontend

## Build & Test Commands

```bash
# Full monorepo
pnpm dev              # Run all packages in parallel (backend:3000, frontend:3001)
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # Type-check all packages
pnpm test             # Run all tests
pnpm format           # Format with Prettier

# Single package
pnpm --filter @agendly/backend dev
pnpm --filter @agendly/backend test
pnpm --filter @agendly/frontend dev
pnpm --filter @agendly/frontend typecheck

# Database
docker compose up -d                                    # Start PostgreSQL
cd packages/backend && npx prisma migrate dev --name X  # Create migration
cd packages/backend && npx prisma generate              # Generate Prisma client
```

## Code Standards

- **Language:** TypeScript strict mode everywhere
- **Formatting:** Prettier (semi, singleQuote, trailingComma: all, printWidth: 100)
- **Linting:** ESLint with framework-specific configs
- **UI text:** Mexican Spanish (`es-MX`). Code, variables, and comments in English.
- **CSS:** Mobile-first with Tailwind CSS. Use Nuxt UI 3 components.

## Architecture

### Multi-tenant Isolation
Every database table (except `Tenant` itself) has a `tenantId` column. All API endpoints for authenticated users must use `TenantGuard` to scope queries to the current user's tenant.

### Soft Deletes
`Employee` and `Service` models use a `deletedAt` field instead of physical deletion. This preserves appointment history.

### Channel-Agnostic Booking
The booking engine accepts appointments without knowing the source channel (web form, WhatsApp, manual walk-in). The `channel` field on `Appointment` is metadata only.

### Availability Engine
Core business logic in `packages/backend/src/availability/`. Computes available time slots based on employee schedules, schedule exceptions, existing appointments, service duration, and buffer time. Must use a Prisma transaction when creating appointments to prevent double-booking.

### Shared DTOs
All DTOs and type definitions shared between frontend and backend live in `packages/shared/src/`. Import as `@agendly/shared`.

## Testing Requirements

- **Required:** Unit tests for the availability engine, booking creation, and tenant isolation
- **Framework:** Jest for backend, Vitest for frontend/shared
- **Run single test:** `pnpm --filter @agendly/backend test -- --testPathPattern=availability`

## File Structure Conventions

```
packages/backend/src/
  <module>/
    <module>.module.ts
    <module>.controller.ts
    <module>.service.ts
    <module>.controller.spec.ts
    <module>.service.spec.ts
    dto/
      create-<entity>.dto.ts
      update-<entity>.dto.ts

packages/frontend/
  pages/             # File-based routing
  components/        # Vue components
  composables/       # Reusable composition functions (useXxx)
  stores/            # Pinia stores
  layouts/           # Page layouts
  middleware/         # Route middleware
```
