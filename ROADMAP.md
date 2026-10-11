# Roadmap — Agendly

Estado al 2026-10: en producción con free tiers (Render + Netlify + Neon + R2), **gratis y sin cobro** (`BILLING_ENFORCED` apagado, página de apoyo voluntario), con Términos, Aviso de Privacidad integral y página ARCO; la aceptación de términos se guarda por usuario.

Estado al 2026-07: MVP refactorizado (motor de reservas endurecido, calendario mobile-first, formulario público verificado e2e), Docker local full-stack funcionando, config de deploy lista (`DEPLOY.md`), optimización de imágenes con sharp + R2.

---

## 1. Pendientes de implementación

| # | Ítem | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | ~~Unificar upload de logo en R2~~ | ~~logo se perdía en cada redeploy~~ | — | ✅ Hecho |
| 2 | ~~Token de auth a cookie httpOnly~~ (arregla también el rebote en F5) | — | — | ✅ Hecho |
| 2b | ~~Refresh tokens con rotación + lista de revocación~~ (A07-1: access 15m + refresh opaco revocable, deslizante 7d/tope 30d, detección de reuso, logout-all). *Follow-ups:* cron de limpieza de revocados-no-expirados; UI de "dispositivos"/logout-all | — | — | ✅ Hecho |
| 3 | ~~**`forgot-password` backend**~~ (`POST /auth/forgot-password` + `/auth/reset-password`: token single-use hasheado SHA-256, TTL 30 min, email con Resend, página `/reset-password`, revoca todas las sesiones al resetear) | — | — | ✅ Hecho |
| 4 | ~~`/admin/subscription`~~ (la página existe; mientras sea gratis funciona como "Apoya Agendly" con `NUXT_PUBLIC_SUPPORT_URL`) | — | — | ✅ Hecho |
| 5 | ~~`/arco`, `/terminos` y Aviso de Privacidad integral~~ (identidad del responsable vía `NUXT_PUBLIC_LEGAL_*`; clickwrap en registro con `termsAcceptedAt`/`termsVersion`) | — | — | ✅ Hecho |
| 6 | ~~Billing / suscripciones~~ (Stripe: schema, checkout, portal, webhooks, enforcement del trial) | — | — | ✅ Hecho, **apagado** (`BILLING_ENFORCED`). Antes de activarlo: términos de pago, política de reembolsos, facturación CFDI |
| 5b | **Configurar `NUXT_PUBLIC_LEGAL_NAME/ADDRESS/EMAIL` en Netlify** y que un abogado revise `/terminos` y `/privacidad` (los textos son una base, no asesoría legal) | Cumplimiento legal | Bajo | 🔴 Alta |
| 6b | **Reagendar citas** desde el admin con aviso al cliente (alcance MVP del product brief; hoy solo hay cancelar/completar/no-show) | Flujo incompleto | Medio | 🟡 Media |
| 6c | **Autoservicio del cliente**: link en el correo de confirmación para cancelar su propia cita | Menos no-shows, menos WhatsApp | Medio | 🟡 Media |
| 6d | **Eliminar cuenta** desde el panel (hoy se pide por correo, ver `/terminos` §10) | Derecho de cancelación (ARCO) | Bajo | 🟡 Media |
| 6e | ~~`/admin/settings/profile` no renderizaba logo/banner/ubicación~~ (componentes sin prefijo `Profile*`) y la página pública no mostraba logo, banner, dirección ni teléfono | — | — | ✅ Hecho |
| 6f | **Unificar** `/admin/config` y `/admin/settings/profile` (hoy duplican logo + datos + ubicación; config enlaza a la otra para el banner) | Mantenibilidad / UX | Medio | 🟢 Baja |
| 7 | Recordatorios de cita por **WhatsApp** (los de correo ya existen; el enum `WHATSAPP` existe sin integración — Twilio/Meta API tiene costo) | Reduce inasistencias — la propuesta de valor central | Alto | 🟢 Post-PoC |
| 8 | Split del template de `onboarding.vue` (761 líneas; la lógica ya está limpia en `useOnboarding`) | Solo mantenibilidad | Bajo | 🟢 Baja |
| 9 | Mover `prisma migrate deploy` del entrypoint a un release job | Solo relevante con múltiples instancias | Bajo | 🟢 Cuando escale |
| 10 | Limpiar datos legacy: tenants con `logoUrl` relativo `/uploads/...` → resubir logo; después quitar el static mount deprecado de `main.ts` | Higiene | Bajo | 🟢 Baja |

### IA y métricas (proyecto de maestría)

| Fase | Ítem | Estado |
|---|---|---|
| 1 | **Métricas de impacto** (`GET /insights/summary`, página `/admin/metrics`): % de citas reservadas solas, tasa de inasistencia, tiempo para reservar (`Appointment.bookingDurationSec`), anticipación, clientes que regresan, serie semanal | ✅ Hecho |
| 4 | **Riesgo de inasistencia** interpretable (`src/insights/no-show-risk.ts`, regresión logística con pesos previos `prior-v1`): badge + razones en la agenda; evaluación sin fuga de datos (AUC, Brier, precisión/recall) en `/admin/metrics` | ✅ Hecho |
| 4b | Re-ajustar los pesos con datos reales (`fitRiskModel` por regresión logística local) cuando haya ≥ 200 citas atendidas y ≥ 20 faltas | ⏳ Pendiente de datos |
| 5 | **Recordatorios por correo** 24 h antes (job horario vía GitHub Actions → `POST /reminders/run`); a las citas de riesgo alto les pide confirmar. Métricas comparan faltas con vs sin recordatorio | ✅ Hecho |
| 4c | Normalizar teléfonos (`+52…`) para no partir el historial de un mismo cliente | 🟢 Baja |
| 2 | Asistente de reservas conversacional (LLM + tool use sobre el motor de reservas) | ⏸️ En pausa — costo de API |
| 3 | Onboarding asistido (generar servicios desde una descripción o foto de la lista de precios) | ⏸️ En pausa — costo de API |

---

## 2. Cuentas a crear (PoC = $0/mes)

Orden recomendado de creación:

| Orden | Servicio | Para qué | Plan | Costo | Límites del free tier | Qué anotar |
|---|---|---|---|---|---|---|
| 1 | **GitHub** | Repo + CI (Actions) | Free | $0 | Actions: ilimitado en repo público; 2,000 min/mes en privado (el CI usa ~5 min/run → sobra) | — |
| 2 | **Neon** (neon.tech) | Postgres gestionado | Free | $0 | 0.5 GB storage, ~190 h compute/mes (autosuspend). Soporta `btree_gist` | Connection string (`...?sslmode=require`) |
| 3 | **Cloudflare** (dash.cloudflare.com) | R2: storage de logos/banners | R2 Free | $0 (pide tarjeta de verificación, no cobra en free) | 10 GB storage, 10M lecturas/mes, 1M escrituras/mes, **egreso $0 (servir imágenes nunca cuesta)** | Las 5 vars `R2_*` (ver DEPLOY.md §R2) |
| 4 | **Render** (render.com) | Backend NestJS (Docker) | Free web service | $0 | 750 h/mes; **duerme tras ~15 min de inactividad** (primer request tarda ~30-60 s en despertar) | URL pública del servicio |
| 5 | **Netlify** (netlify.com) | Frontend Nuxt SSR | Free | $0 | 100 GB bandwidth/mes, 300 min build/mes, deploy previews incluidos | URL del sitio |
| 6 | **Resend** (resend.com) — opcional | Emails de confirmación/cancelación | Free | $0 | 100 emails/día, 3,000/mes. Sin la key, los emails solo se loguean | `RESEND_API_KEY`; para dominio propio: DNS SPF/DKIM |
| 7 | **Google Cloud Console** — opcional | OAuth "Continuar con Google" | Free | $0 | Sin límite práctico para OAuth | `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` |

Los pasos detallados de configuración de cada uno están en **`DEPLOY.md`**.

### Alternativa: Hostinger VPS (si el sleep de Render molesta)

Un VPS (KVM 1/2, ~USD 5-9/mes) corre el `docker-compose.yml` **completo** (db + backend + frontend) tal cual lo tenés local — sin sleep y con Postgres incluido (podés prescindir de Neon).

| | Free tiers (Render+Netlify+Neon) | Hostinger VPS |
|---|---|---|
| Costo | $0 | ~$5-9/mes fijo |
| Sleep / cold start | Sí (Render free) | No |
| Auto-deploy desde GitHub | Nativo (push → deploy) | Manual o script propio (webhook/cron con `git pull && docker compose up -d --build`) |
| Mantenimiento (updates, backups, SSL) | Cero (gestionado) | Tuyo (caddy/traefik para SSL, backups de pgdata) |
| Migración futura | Fácil (los Dockerfiles son portables) | Ya estás en Docker puro |

**Recomendación:** arrancar con los free tiers para las pruebas; pasar a Hostinger (o Railway) solo si el cold start de Render te arruina las demos.

---

## 3. Referencias

- Pasos de deploy y matriz completa de env vars: `DEPLOY.md`
- CI: `.github/workflows/ci.yml` (typecheck + lint + tests + build en cada push/PR a main)
- Auto-deploy: ver `DEPLOY.md` §Auto-deploy (integraciones nativas de Render/Netlify, sin costo)
