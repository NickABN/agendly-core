# Observabilidad — Agendly

Estado tras la Fase O. Antes: logging plano sin request-id, 4xx no logueados, health check pegaba a `/` ("Hello World") sin verificar la DB, sin error tracking, el frontend tragaba errores en silencio.

## Qué hay ahora

### Backend
- **Logging estructurado (JSON) a stdout** vía `nestjs-pino` (`config/logger.config.ts`). Render lo ingesta y permite filtrar/consultar. En dev usa `pino-pretty` (legible). Nivel configurable con `LOG_LEVEL` (default `info`).
- **Request ID** por request: reusa el header `x-request-id` si viene, si no genera un UUID, y lo devuelve en la respuesta → correlación de logs con una request específica.
- **Redacción de PII/secretos**: se remueven `Authorization`, `Cookie`, `x-api-key` de los logs. El email en `email.service` se enmascara (`a***@dominio`).
- **5xx con contexto**: `all-exceptions.filter.ts` loguea método, ruta y requestId de los errores no controlados (sin cuerpo/PII) y los reporta a Sentry. Los 4xx (esperados) no ensucian el log de errores.
- **Health checks** (`health.controller.ts`, `@nestjs/terminus`):
  - `GET /health` — liveness (el proceso responde), barato.
  - `GET /health/ready` — readiness con ping a la DB (`SELECT 1`, timeout 3s → 503 rápido si la DB está caída). **Este es el que usa Render.**
- **Sentry** (`@sentry/nestjs`, `instrument.ts`): captura excepciones no controladas. No-op sin `SENTRY_DSN`.

### Frontend
- **Sentry** (`@sentry/vue`, `plugins/sentry.client.ts`): error tracking client-side. No-op sin `NUXT_PUBLIC_SENTRY_DSN`.
- **Error boundary** (`error.vue`): página amable para 404 y 500; reporta los 5xx a Sentry.
- **Interceptor central** (`useApi.ts` con `$fetch.create` + `onResponseError`): las fallas 5xx de la API se reportan a Sentry con contexto en vez de tragarse en silencio.

## Cómo leer la observabilidad en producción
- **Logs**: Render → pestaña Logs del servicio (JSON; buscá por `reqId`).
- **Errores**: Sentry (backend + frontend), agrupados con stack trace.
- **Uptime/health**: Render usa `/health/ready`; podés apuntar un monitor externo gratis (UptimeRobot) al mismo endpoint.

## Config
| Var | Dónde | Efecto |
|---|---|---|
| `LOG_LEVEL` | Backend (Render/compose) | Nivel de log (`debug`/`info`/`warn`/`error`). Default `info`. |
| `SENTRY_DSN` | Backend (Render) | Activa Sentry backend. Sin ella, no-op. |
| `NUXT_PUBLIC_SENTRY_DSN` | Frontend (Netlify) | Activa Sentry frontend. Sin ella, no-op. |

**Setup de Sentry (free tier, 5k errores/mes):** crear cuenta → 2 proyectos (uno "node" backend, uno "vue/nuxt" frontend) → copiar cada DSN → setear las vars. El PoC funciona sin Sentry (queda no-op), pero con él tenés error tracking real agrupado.

## Pendiente (no en esta iteración)
- Métricas/APM (Prometheus/OpenTelemetry) — no necesario para el PoC.
- Correlación tenantId en cada log (requiere propagar el tenant al logger de request).
- Alertas (Sentry ya alerta por email en el free tier).
