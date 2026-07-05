# Roadmap — Agendly

Estado al 2026-07: MVP refactorizado (motor de reservas endurecido, calendario mobile-first, formulario público verificado e2e), Docker local full-stack funcionando, config de deploy lista (`DEPLOY.md`), optimización de imágenes con sharp + R2.

---

## 1. Pendientes de implementación

| # | Ítem | Impacto | Esfuerzo | Prioridad |
|---|---|---|---|---|
| 1 | ~~Unificar upload de logo en R2~~ | ~~logo se perdía en cada redeploy~~ | — | ✅ Hecho |
| 2 | **Token de auth a cookie** (`useCookie` en vez de solo localStorage) | Recargar una página del admin (F5) rebota a /login — molesto para el negocio a diario | Medio | 🔴 Alta |
| 3 | **`forgot-password` backend** (`POST /auth/forgot-password`: token + email con Resend + página de reset). Hoy la UI existe pero pega a un endpoint inexistente y "miente" éxito | Usuarios que olvidan su contraseña quedan afuera para siempre | Medio | 🟡 Media |
| 4 | **`/admin/subscription`**: el banner de prueba linkea a una página que no existe (404). Crear placeholder o quitar el link hasta tener billing | Confunde en el momento más sensible (fin del trial) | Bajo | 🟡 Media |
| 5 | **`/arco`** (página de derechos ARCO): está en la allowlist del middleware pero no existe. Obligatoria junto al aviso de privacidad (LFPDPPP) si se opera en México | Cumplimiento legal | Bajo | 🟡 Media |
| 6 | **Billing / suscripciones** (Stripe/Conekta + plan por tenant + bloquear tras trial). El `trialEndsAt` existe pero nada lo hace cumplir | Sin esto no hay ingresos | Alto | 🟡 Media (antes de cobrar) |
| 7 | Recordatorios de cita (email/WhatsApp N horas antes; el enum `WHATSAPP` existe sin integración — Twilio/Meta API tiene costo) | Reduce inasistencias — la propuesta de valor central | Alto | 🟢 Post-PoC |
| 8 | Split del template de `onboarding.vue` (761 líneas; la lógica ya está limpia en `useOnboarding`) | Solo mantenibilidad | Bajo | 🟢 Baja |
| 9 | Mover `prisma migrate deploy` del entrypoint a un release job | Solo relevante con múltiples instancias | Bajo | 🟢 Cuando escale |
| 10 | Limpiar datos legacy: tenants con `logoUrl` relativo `/uploads/...` → resubir logo; después quitar el static mount deprecado de `main.ts` | Higiene | Bajo | 🟢 Baja |

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
