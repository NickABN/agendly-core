# Diagnóstico de Seguridad — Agendly

Auditoría 2026-07 contra **OWASP Top 10** y la **LFPDPPP** (Ley Federal de Protección de Datos Personales en Posesión de Particulares, México) — la app maneja PII de clientes (nombre, teléfono, email, consentimiento).

Estado: ✅ arreglado en esta iteración · 🟡 pendiente (con recomendación) · ℹ️ informativo.

---

## Resumen ejecutivo

| ID | OWASP | Severidad | Hallazgo | Estado |
|---|---|---|---|---|
| A05-1 | A05 Misconfig | 🔴 Crítica | `JWT_SECRET` default inseguro podía llegar a prod | ✅ |
| A07-2 | A07 Auth | 🟠 Alta | Login/register sin anti-fuerza-bruta (100/min) | ✅ |
| A01-1 | A01 Access | 🟠 Alta | IDOR: un tenant sobrescribía horarios de otro | ✅ |
| A01-2 | A01 Access | 🟡 Media | employeeId ajeno en bulkSet/createDefault | ✅ |
| A01-4 | A01 Access | 🟡 Media | serviceIds ajenos al vincular empleados | ✅ |
| A02-1 | A02 / LFPDPPP | 🟡 Media | Consentimiento sin IP de origen | ✅ |
| A05-2 | A05 Misconfig | 🟡 Media | Sin cabeceras de seguridad (helmet) | ✅ |
| A03-1 | A03 Injection | 🟡 Media | `setAvailability`/bulks sin DTO validado | ✅ |
| A07-3 | A07 Auth | 🟢 Baja | Política de contraseña débil, bcrypt 10 rondas | ✅ (bcrypt→12) |
| A09-1 | A09 Logging | 🟡 Media | Sin audit log de eventos de auth | ✅ (parcial) |
| A07-1 | A07 Auth | 🟡 Media | JWT 7d no revocable, sin refresh | 🟡 |
| A07-4 | A07 Auth | 🟡 Media | Token en localStorage + en URL del callback OAuth | 🟡 |
| A01-5 | A01 Access | 🟡 Media | RolesGuard casi sin uso (RBAC latente) | 🟡 |
| A07-5 | A07 Auth | 🟢 Baja | Enumeración de usuarios en /register (409) | 🟡 |
| A10-1 | A10 SSRF | 🟢 Baja | Geocoder a host fijo (riesgo mínimo) | ℹ️ |
| A06-1 | A06 Deps | ℹ️ | Dependencias al día; falta `npm audit` en CI | 🟡 |

---

## Arreglado en esta iteración (críticos y altos)

### A05-1 — JWT_SECRET inseguro (Crítico)
**Antes:** `docker-compose.yml` usaba el default `dev-only-insecure-secret-change-me`, que **satisfacía** la validación de env y podía shippear a Render → cualquiera con ese secreto público podía forjar tokens (bypass total de auth).
**Fix:** `config/env.validation.ts` ahora exige `JWT_SECRET` de ≥32 caracteres **y rechaza el valor default conocido** (`@MinLength(32)` + `@NotEquals`) → el backend no arranca con un secreto débil. El default de compose se cambió a un valor local válido de 42 chars. En Render el usuario genera uno con `openssl rand -hex 32` (DEPLOY.md). Regresión: `env.validation.spec.ts`.

### A07-2 — Fuerza bruta en auth (Alto)
**Antes:** `/auth/login` y `/auth/register` heredaban el límite global (100/min/IP), sin lockout.
**Fix:** `@Throttle({ limit: 5, ttl: 60_000 })` en ambas rutas (`auth.controller.ts`). Se agregó `app.set('trust proxy', 1)` en `main.ts` para que el rate limit use la IP real detrás de Render.

### A01-1 / A01-2 — IDOR en horarios (Alto/Medio)
**Antes:** `schedules.service.create` hacía `upsert` sobre la clave `employeeId_dayOfWeek_blockIndex` (sin tenantId) y nunca verificaba que el `employeeId` fuera del tenant → el tenant A podía **sobrescribir el horario de un empleado del tenant B**.
**Fix:** `ensureEmployeeInTenant(tenantId, employeeId)` al inicio de `create`, `bulkSet` y `createDefault`. Regresión: `schedules.service.spec.ts` (4 tests: rechaza employeeId ajeno, no toca la DB antes de fallar, permite el propio).

### A01-4 — serviceIds ajenos en empleados (Medio)
**Fix:** `employees.service.assertServicesInTenant` valida que todos los `serviceIds` pertenezcan al tenant antes de crear las asociaciones (`create`, `createMany`, `update`).

### A02-1 — Consentimiento sin IP (Medio, LFPDPPP)
**Antes:** el campo `PrivacyConsent.ipAddress` existía en el schema pero nunca se poblaba → sin evidencia de origen del consentimiento.
**Fix:** el booking público captura la IP del cliente (`@Ip()` → `booking.service` → `privacyConsent.ipAddress`). Con `trust proxy` la IP es la real detrás de Render. El `acceptedAt` ya se guardaba por default.

### A05-2 — Cabeceras de seguridad (Medio)
**Fix:** `helmet()` en el backend (`main.ts`) — HSTS, X-Content-Type-Options, X-Frame-Options, etc. En el frontend, `netlify.toml` agrega `[[headers]]` (HSTS, nosniff, DENY frame, Referrer-Policy, Permissions-Policy).

### A03-1 — DTOs faltantes (Medio)
**Fix:** `SetServiceAvailabilityDto` (class-validator: `dayOfWeek` enum, `startTime/endTime` regex HH:mm) validado con `ParseArrayPipe` en `services.controller.ts`. El body de schedules bulk ya usa `BulkScheduleDto` con `@ValidateNested`.

### A07-3 / A09-1 — Password + audit log (Bajo/Medio)
**Fix:** bcrypt subido a **12 rondas**. Audit log de eventos de auth en `auth.service` (login OK/fallido, register) a nivel `log`/`warn` — el logger de request (Fase O, pino) adjunta IP + requestId automáticamente.

---

## Pendiente (recomendaciones — ver ROADMAP.md)

- **A07-1 / A07-4 (Medio) — Sesiones:** JWT de 7 días no revocable, guardado en `localStorage` (exfiltrable por XSS) y pasado en la URL del callback de Google (queda en historial/logs). **Recomendación:** migrar a cookie `httpOnly`+`Secure`+`SameSite`, agregar refresh token con rotación, y pasar el token de Google por POST/fragment en vez de query. (Excluido de esta iteración por decisión; también arreglaría el bug de recarga dura → login.)
- **A01-5 (Medio) — RBAC:** `RolesGuard` solo se usa en profile; el resto de rutas no distingue OWNER/ADMIN. Latente porque hoy solo existe el rol OWNER. **Recomendación:** cablear RolesGuard cuando se agregue el flujo multi-usuario/invitaciones.
- **A07-5 (Bajo) — Enumeración:** `/register` responde 409 para emails existentes. **Recomendación:** mensaje genérico o verificación por email.
- **A06-1 — Dependencias:** agregar `pnpm audit --audit-level=high` al CI.
- **A10-1 (Bajo) — SSRF:** el geocoder pega a un host fijo con input URL-encodeado; riesgo mínimo, sin acción requerida.

---

## LFPDPPP — cumplimiento de datos personales

- ✅ **Consentimiento** registrado por reserva (`PrivacyConsent`: teléfono, email, tipo, `acceptedAt`, ahora **IP**). El checkbox de aviso de privacidad es obligatorio en el formulario público.
- ✅ **Minimización de logs:** no se loguea PII sensible (la redacción de email en logs se refuerza en Fase O con pino).
- 🟡 **Derechos ARCO:** falta la página `/arco` (referenciada en el middleware pero inexistente) y un mecanismo de acceso/rectificación/cancelación/oposición. Ver ROADMAP.md.
- 🟡 **Aviso de privacidad:** `/privacidad` existe; revisar que el contenido cumpla el aviso integral requerido.
