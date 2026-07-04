# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Transacción interactiva falla con driver adapter
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases: `register` con payload válido y `findOrCreateGoogleUser` con perfil Google nuevo, ambos con `PrismaService` mockeado para lanzar `Error: Interactive transactions are not supported with driver adapters` en `$transaction` con callback
  - In `packages/backend/src/auth/auth.service.spec.ts`, use `fast-check` to generate valid `RegisterDto` inputs (businessName, ownerName, unique email, password ≥ 8 chars) and assert that `register` does NOT throw a Prisma driver adapter exception (from Bug Condition in design: `prismaClientUsesDriverAdapter() AND transactionModeIsInteractiveCallback()`)
  - Mock `prisma.$transaction` to throw `new Error('Interactive transactions are not supported with driver adapters')` when called with a callback function (simulating `PrismaPg` behavior)
  - The test assertions should match the Expected Behavior Properties from design: `result.accessToken IS NOT NULL`, `result.user.email = input.email`, no Prisma exception thrown
  - Run test on UNFIXED code: `pnpm --filter @agendly/backend test -- --testPathPattern=auth.service --run`
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found, e.g. `register({ businessName: 'Salon', ownerName: 'Ana', email: 'ana@test.com', password: 'pass1234' })` throws `Error: Interactive transactions are not supported with driver adapters`
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1, 2.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Comportamientos no afectados por el fix
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (inputs where `isBugCondition` returns false):
    - Observe: `register` con email duplicado lanza `ConflictException` (HTTP 409) — no llega a `$transaction`
    - Observe: `register` con payload inválido es rechazado por `ValidationPipe` (HTTP 400) — no llega al servicio
    - Observe: `ensureUniqueSlug` con slug ocupado retorna `slug-1`, `slug-2`, etc.
    - Observe: `findOrCreateGoogleUser` con `googleId` existente retorna usuario sin crear registros
  - Write property-based tests with `fast-check` capturing observed behavior patterns from Preservation Requirements in design:
    - Generate duplicate emails and assert `register` always throws `ConflictException` (Requirement 3.1)
    - Generate business names with potentially colliding slugs and assert `ensureUniqueSlug` always returns a unique slug with numeric suffix (Requirement 3.3)
    - Generate existing Google profiles and assert `findOrCreateGoogleUser` returns existing user without calling `$transaction` (Requirement 3.4)
  - Verify tests PASS on UNFIXED code: `pnpm --filter @agendly/backend test -- --testPathPattern=auth.service --run`
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix: reemplazar transacciones interactivas por modo batch en AuthService

  - [x] 3.1 Refactorizar `ensureUniqueSlug` para recibir `PrismaService` en lugar del cliente interactivo
    - Cambiar la firma de `private async ensureUniqueSlug(tx: ..., baseSlug: string)` a `private async ensureUniqueSlug(prisma: PrismaService, baseSlug: string): Promise<string>`
    - Actualizar todas las llamadas internas para pasar `this.prisma` en lugar de `tx`
    - _Bug_Condition: `transactionModeIsInteractiveCallback()` — `ensureUniqueSlug` actualmente depende del cliente `tx` de la transacción interactiva_
    - _Expected_Behavior: `ensureUniqueSlug` opera sobre `PrismaService` estándar, ejecutable fuera del bloque `$transaction`_
    - _Preservation: Slug duplicado debe seguir generando sufijo numérico (`slug-1`, `slug-2`, etc.) — Requirement 3.3_
    - _Requirements: 2.2, 3.3_

  - [x] 3.2 Reemplazar transacción interactiva en `register` por modo batch
    - Importar `randomUUID` de `'crypto'`
    - Generar `tenantId` con `randomUUID()` antes del bloque de transacción
    - Llamar a `this.ensureUniqueSlug(this.prisma, slug)` antes del `$transaction` y almacenar en `uniqueSlug`
    - Reemplazar `this.prisma.$transaction(async (tx) => { ... })` por `this.prisma.$transaction([this.prisma.tenant.create({ data: { id: tenantId, slug: uniqueSlug, ... } }), this.prisma.user.create({ data: { tenantId, ... } })])`
    - Desestructurar el resultado como `const [tenant, user] = await this.prisma.$transaction([...])`
    - _Bug_Condition: `isBugCondition(input)` donde `input` es `RegisterDto` válido y `prismaClientUsesDriverAdapter() AND transactionModeIsInteractiveCallback()`_
    - _Expected_Behavior: `result.accessToken IS NOT NULL AND result.user.email = input.email AND tenantCreated(result.user.tenantId) AND NOT throws PrismaDriverAdapterException`_
    - _Preservation: Email duplicado sigue lanzando `ConflictException` antes de llegar a `$transaction` — Requirement 3.1_
    - _Requirements: 2.1, 2.2, 3.1, 3.3_

  - [x] 3.3 Aplicar el mismo fix en `findOrCreateGoogleUser`
    - Generar `tenantId` con `randomUUID()` antes del bloque de transacción
    - Llamar a `this.ensureUniqueSlug(this.prisma, slug)` fuera del batch
    - Reemplazar `this.prisma.$transaction(async (tx) => { ... })` por modo batch `$transaction([op1, op2])`
    - Verificar que la rama de usuario existente (link de cuenta Google) no se ve afectada
    - _Bug_Condition: `isBugCondition(input)` donde `input` es `GoogleProfile` nuevo_
    - _Expected_Behavior: Tenant y usuario creados atómicamente, `accessToken` retornado sin excepción_
    - _Preservation: `findOrCreateGoogleUser` con `googleId` existente sigue retornando usuario sin crear registros — Requirement 3.4_
    - _Requirements: 2.1, 2.2, 3.4_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Registro atómico compatible con driver adapter
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior: `register` con payload válido retorna `accessToken` sin lanzar excepción de Prisma
    - Run: `pnpm --filter @agendly/backend test -- --testPathPattern=auth.service --run`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Comportamientos no afectados por el fix
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions for requirements 3.1–3.4)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full backend test suite: `pnpm --filter @agendly/backend test -- --run`
  - Ensure all tests pass, ask the user if questions arise.
