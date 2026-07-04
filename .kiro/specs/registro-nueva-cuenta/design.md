# registro-nueva-cuenta Bugfix Design

## Overview

El endpoint `POST /auth/register` falla con HTTP 500 porque `AuthService.register` usa
`prisma.$transaction` con callback interactivo (modo "interactive transaction"), que Prisma
no soporta cuando el cliente está configurado con un driver adapter (`PrismaPg`). El fix
reemplaza ese modo por el modo batch (`prisma.$transaction([op1, op2])`), que sí es
compatible. La misma corrección aplica a `findOrCreateGoogleUser`. La lógica de
`ensureUniqueSlug` debe ejecutarse fuera de la transacción, ya que el modo batch no
admite lógica arbitraria dentro del array.

## Glossary

- **Bug_Condition (C)**: La condición que activa el bug — cuando se invoca
  `prisma.$transaction` con un callback interactivo estando `PrismaPg` configurado como
  driver adapter
- **Property (P)**: El comportamiento correcto esperado — `Tenant` y `User` se crean
  atómicamente y el endpoint responde HTTP 201 con `accessToken`
- **Preservation**: Comportamientos existentes que no deben cambiar: rechazo de email
  duplicado (409), validación de payload (400), generación de slug único, y flujo Google OAuth
- **Interactive Transaction**: Modo de `$transaction` que acepta un callback `async (tx) => {}`.
  Incompatible con driver adapters en Prisma
- **Batch Transaction**: Modo de `$transaction` que acepta un array de operaciones Prisma
  (`$transaction([op1, op2])`). Compatible con driver adapters
- **`ensureUniqueSlug`**: Función privada en `AuthService` que verifica unicidad del slug
  iterando con `findUnique`. Actualmente recibe `tx` (cliente de transacción interactiva);
  debe refactorizarse para recibir el cliente Prisma estándar
- **`PrismaPg`**: Driver adapter de `@prisma/adapter-pg` configurado en `PrismaService`.
  Causa la incompatibilidad con transacciones interactivas

## Bug Details

### Bug Condition

El bug se manifiesta cuando `register` o `findOrCreateGoogleUser` llegan al bloque
`prisma.$transaction(async (tx) => { ... })`. Prisma lanza una excepción en tiempo de
ejecución porque el driver adapter `PrismaPg` no implementa el protocolo de transacciones
interactivas.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input de tipo RegisterDto | GoogleProfile
  OUTPUT: boolean

  RETURN prismaClientUsesDriverAdapter()
         AND transactionModeIsInteractiveCallback()
         AND (input es RegisterDto válido OR input es GoogleProfile nuevo)
END FUNCTION
```

### Examples

- `POST /auth/register` con `{ businessName, ownerName, email, password }` válidos →
  esperado: HTTP 201 con `accessToken` / actual: HTTP 500 (excepción de Prisma)
- `POST /auth/google/callback` con perfil Google nuevo →
  esperado: HTTP 201 con `accessToken` / actual: HTTP 500 (misma excepción)
- `POST /auth/register` con email ya registrado →
  no llega a la transacción, lanza `ConflictException` antes → no afectado por el bug
- `POST /auth/register` con payload inválido →
  rechazado por el pipe de validación antes de llegar al servicio → no afectado

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Email duplicado debe seguir respondiendo HTTP 409 con "Ya existe una cuenta con este email"
- Payload inválido (campos faltantes, email malformado, contraseña < 8 chars) debe seguir
  respondiendo HTTP 400
- Slug duplicado debe seguir generando sufijo numérico (`slug-1`, `slug-2`, etc.)
- El flujo de Google OAuth para usuarios existentes (link de cuenta) no debe verse afectado
- `login` y `getProfile` no deben verse afectados en absoluto

**Scope:**
Todo input que NO active la condición del bug (es decir, que no llegue al bloque
`$transaction` con callback) debe comportarse exactamente igual que antes del fix. Esto
incluye:
- Registros con email duplicado (rechazados antes de la transacción)
- Payloads inválidos (rechazados por ValidationPipe)
- Login de usuarios existentes
- Consulta de perfil autenticado
- Vinculación de cuenta Google existente

## Hypothesized Root Cause

Basado en el análisis del código en `packages/backend/src/auth/auth.service.ts` y
`packages/backend/src/prisma/prisma.service.ts`:

1. **Incompatibilidad de modo de transacción**: `PrismaService` instancia `PrismaClient`
   con `new PrismaPg(...)` como adapter. Prisma con driver adapter solo soporta el modo
   batch de `$transaction`. El código actual usa el modo interactivo con callback, que
   lanza `Error: Interactive transactions are not supported with driver adapters` en
   tiempo de ejecución.

2. **`ensureUniqueSlug` acoplada al cliente de transacción interactiva**: La firma actual
   es `ensureUniqueSlug(tx: Parameters<...>[0], baseSlug)`. En el modo batch no existe
   un `tx` de ese tipo; la función debe recibir `PrismaService` directamente.

3. **Dos sitios afectados**: Tanto `register` como `findOrCreateGoogleUser` usan el mismo
   patrón de transacción interactiva, por lo que ambos fallan.

## Correctness Properties

Property 1: Bug Condition — Registro atómico compatible con driver adapter

_For any_ payload de registro válido (`RegisterDto` con `businessName`, `ownerName`,
`email` único y `password` ≥ 8 chars), la función `register` corregida SHALL crear el
`Tenant` y el `User` de forma atómica usando `$transaction` en modo batch y retornar
HTTP 201 con `accessToken` y los datos del usuario, sin lanzar excepción de Prisma.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Comportamientos no afectados por el fix

_For any_ input donde la condición del bug NO se cumple (email duplicado, payload
inválido, login, getProfile, vinculación Google existente), la función corregida SHALL
producir exactamente el mismo resultado que la función original, preservando todos los
códigos de respuesta HTTP y mensajes de error existentes.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `packages/backend/src/auth/auth.service.ts`

**Specific Changes**:

1. **Mover `ensureUniqueSlug` fuera de la transacción en `register`**:
   Llamar a `this.ensureUniqueSlug(this.prisma, slug)` antes del bloque `$transaction`,
   almacenando el slug único en una variable local.

2. **Reemplazar transacción interactiva en `register` por modo batch**:
   ```
   // Antes (interactivo — incompatible con driver adapter)
   const result = await this.prisma.$transaction(async (tx) => {
     const tenant = await tx.tenant.create({ ... });
     const user = await tx.user.create({ ... });
     return { tenant, user };
   });

   // Después (batch — compatible con driver adapter)
   const uniqueSlug = await this.ensureUniqueSlug(this.prisma, slug);
   const [tenant, user] = await this.prisma.$transaction([
     this.prisma.tenant.create({ data: { ..., slug: uniqueSlug } }),
     // user.create necesita tenantId — ver nota abajo
   ]);
   ```
   **Nota**: El modo batch no permite usar el resultado de `op1` en `op2` dentro del
   mismo array. La solución es ejecutar `tenant.create` y `user.create` en el mismo
   batch pasando el `tenantId` generado previamente con `cuid()` / `uuid()`, o bien
   ejecutar las dos operaciones en secuencia dentro de una transacción batch de una sola
   operación compuesta. La alternativa más simple y correcta es generar el `id` del
   tenant manualmente antes del batch:
   ```
   import { randomUUID } from 'crypto';
   const tenantId = randomUUID();
   const uniqueSlug = await this.ensureUniqueSlug(this.prisma, slug);
   const [tenant, user] = await this.prisma.$transaction([
     this.prisma.tenant.create({ data: { id: tenantId, slug: uniqueSlug, ... } }),
     this.prisma.user.create({ data: { tenantId, ... } }),
   ]);
   ```

3. **Aplicar el mismo fix en `findOrCreateGoogleUser`**:
   Mismo patrón: generar `tenantId` con `randomUUID()`, llamar a `ensureUniqueSlug`
   fuera del batch, y usar `$transaction([op1, op2])`.

4. **Actualizar la firma de `ensureUniqueSlug`**:
   Cambiar el tipo del primer parámetro de `tx` (cliente interactivo) a `PrismaService`
   para que pueda usarse fuera de la transacción:
   ```typescript
   private async ensureUniqueSlug(prisma: PrismaService, baseSlug: string): Promise<string>
   ```

5. **Sin cambios en otros métodos**: `login`, `getProfile`, y la lógica de vinculación
   de cuenta Google existente no usan `$transaction` y no requieren modificación.

## Testing Strategy

### Validation Approach

La estrategia sigue dos fases: primero ejecutar las pruebas exploratorias sobre el código
SIN corregir para confirmar el root cause, luego verificar que el fix resuelve el bug y
no introduce regresiones.

### Exploratory Bug Condition Checking

**Goal**: Confirmar que `$transaction` con callback interactivo lanza excepción con
`PrismaPg`, y refutar o confirmar el root cause antes de implementar el fix.

**Test Plan**: Escribir tests unitarios que mockeen `PrismaService` simulando el
comportamiento de `PrismaPg` (lanzar error en `$transaction` con callback). Ejecutar
sobre el código actual sin corregir para observar el fallo.

**Test Cases**:
1. **Register con payload válido (unfixed)**: Llamar a `register` con DTO válido y
   verificar que lanza la excepción de Prisma sobre driver adapter (fallará en código sin fix)
2. **findOrCreateGoogleUser con perfil nuevo (unfixed)**: Llamar con perfil Google nuevo
   y verificar que lanza la misma excepción (fallará en código sin fix)

**Expected Counterexamples**:
- `register` lanza `Error: Interactive transactions are not supported with driver adapters`
- `findOrCreateGoogleUser` lanza el mismo error para perfiles nuevos

### Fix Checking

**Goal**: Verificar que para todos los inputs donde la condición del bug se cumple, la
función corregida produce el comportamiento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := register_fixed(input)
  ASSERT result.accessToken IS NOT NULL
  ASSERT result.user.email = input.email
  ASSERT tenantCreated(result.user.tenantId)
  ASSERT NOT throws PrismaDriverAdapterException
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos los inputs donde la condición del bug NO se cumple,
la función corregida produce el mismo resultado que la función original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT register_original(input) = register_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing es recomendado para preservation checking
porque:
- Genera muchos casos de prueba automáticamente sobre el dominio de inputs
- Captura edge cases que los unit tests manuales podrían omitir
- Provee garantías fuertes de que el comportamiento no cambia para inputs no afectados

**Test Cases**:
1. **Email duplicado (Preservation)**: Observar que `register` con email existente
   retorna 409 en código sin fix, luego verificar que sigue retornando 409 tras el fix
2. **Payload inválido (Preservation)**: Verificar que la validación de DTO sigue
   rechazando con 400 tras el fix
3. **Slug único (Preservation)**: Verificar que `ensureUniqueSlug` sigue generando
   `slug-1`, `slug-2`, etc. cuando el slug base ya existe
4. **Google OAuth existente (Preservation)**: Verificar que `findOrCreateGoogleUser`
   para usuarios ya registrados sigue funcionando sin cambios

### Unit Tests

- Test de `register` con payload válido → debe retornar `accessToken` y datos de usuario
- Test de `register` con email duplicado → debe lanzar `ConflictException` (409)
- Test de `register` con payload inválido → debe ser rechazado por `ValidationPipe` (400)
- Test de `ensureUniqueSlug` con slug libre → retorna el slug sin sufijo
- Test de `ensureUniqueSlug` con slug ocupado → retorna `slug-1`, luego `slug-2`, etc.
- Test de `findOrCreateGoogleUser` con perfil nuevo → crea tenant y usuario correctamente
- Test de `findOrCreateGoogleUser` con googleId existente → retorna usuario existente sin crear registros

### Property-Based Tests

- Generar `RegisterDto` aleatorios con email único y verificar que siempre retornan
  `accessToken` (Property 1 — fix checking)
- Generar emails ya registrados y verificar que siempre retornan `ConflictException`
  (Property 2 — preservation)
- Generar nombres de negocio con slugs potencialmente colisionantes y verificar que
  `ensureUniqueSlug` siempre retorna un slug único (Property 2 — preservation)

### Integration Tests

- Flujo completo de registro: `POST /auth/register` → HTTP 201 → `POST /auth/login` → HTTP 200
- Registro con email duplicado: segundo `POST /auth/register` con mismo email → HTTP 409
- Registro con slug colisionante: dos negocios con mismo nombre → slugs distintos (`slug` y `slug-1`)
- Flujo Google OAuth completo: nuevo perfil → tenant y usuario creados → `accessToken` válido
