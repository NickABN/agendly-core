# Deploy — Agendly (PoC)

Topología del PoC: **Netlify** (frontend Nuxt SSR) + **Render** (backend NestJS en contenedor) + **Neon** (Postgres gestionado). Uploads en **Cloudflare R2** (opcional). Docker se usa idéntico en local y sirve el mismo Dockerfile para Render.

> ⚠️ **Por qué no todo en Netlify:** Netlify no corre contenedores Docker, ni Postgres, ni un servidor NestJS de larga vida. Solo hostea el frontend (estáticos + funciones serverless). El backend va a un host de contenedores (Render) y la BD a un servicio gestionado (Neon).

---

## 1. Local (Docker full-stack)

Todo el stack en tres contenedores:

```bash
docker compose up --build          # db + backend + frontend
# Frontend:  http://localhost:3001
# Backend:   http://localhost:3000
# Postgres:  localhost:5433 (para tooling host: prisma studio, psql)
```

- El backend aplica migraciones al arrancar (`prisma migrate deploy` en el entrypoint) — incluye el `CREATE EXTENSION btree_gist` del constraint anti-doble-reserva.
- Dentro de compose los servicios se hablan por nombre: backend → `db:5432`, SSR del frontend → `backend:3000` (var `NUXT_API_URL_INTERNAL`). El navegador usa `NUXT_PUBLIC_API_URL=http://localhost:3000`.
- **Uploads opcionales:** para probar logo/banner definí las 5 `R2_*` en un `.env` en la raíz (compose las lee). Sin ellas todo lo demás funciona; el upload falla lazily.

Comandos útiles:
```bash
docker compose logs -f backend         # ver logs
docker compose exec db psql -U agendly -d agendly    # entrar a la BD
docker compose down                    # frenar (mantiene el volumen pgdata)
docker compose down -v                 # frenar y borrar datos
```

---

## 2. Neon (Postgres)

1. Crear proyecto en https://neon.tech (región cercana, ej. `aws-us-east`).
2. Copiar el **connection string** (formato `postgresql://user:pass@host/db?sslmode=require`). El `sslmode=require` es necesario y `pg`/adapter-pg lo respetan.
3. `btree_gist`: la migración `20260704022123_add_appointment_no_overlap_constraint` corre `CREATE EXTENSION IF NOT EXISTS btree_gist` — **Neon lo soporta** sin superuser. No hay que hacer nada manual; `prisma migrate deploy` lo crea.
4. Las migraciones se aplican solas cuando arranca el backend en Render (entrypoint). Si querés aplicarlas a mano antes:
   ```bash
   cd packages/backend
   DATABASE_URL="<neon-connection-string>" pnpm db:migrate:deploy
   ```

> Nota futura: si algún día el backend pasa a serverless, usar el **endpoint pooled** de Neon (`-pooler` en el host). Para el backend en contenedor (Render) la conexión directa está bien.

---

## 3. Render (backend)

1. New → **Web Service** → conectar el repo de GitHub, rama `chore/docker-deploy-poc` (o la que mergees).
2. Configuración:
   - **Runtime:** Docker
   - **Dockerfile Path:** `packages/backend/Dockerfile`
   - **Docker Build Context Directory:** `.` (raíz — el build es monorepo)
   - **Health Check Path:** `/health/ready` (verifica que la app y la DB estén arriba)
3. **Environment variables** (ver matriz abajo): `DATABASE_URL` (Neon), `JWT_SECRET` (32+ chars, `openssl rand -hex 32` — el default inseguro es rechazado), `FRONTEND_URL` (la URL de Netlify), `R2_*` (opcional), `SENTRY_DSN`/`LOG_LEVEL` (opcional). Render inyecta `PORT` solo; el entrypoint lo respeta.
4. Deploy. El entrypoint corre `prisma migrate deploy` y arranca. Anotá la URL pública (ej. `https://agendly-api.onrender.com`) → va en Netlify.

> El free tier de Render duerme el servicio tras inactividad (primer request lento). Suficiente para un PoC.

---

## 4. Netlify (frontend)

1. Add new site → import del repo → misma rama.
2. Netlify lee `netlify.toml` (raíz): build `pnpm --filter @agendly/frontend build`, publish `packages/frontend/dist`, Node 24. Usa pnpm automáticamente (detecta `packageManager` del root).
3. **Environment variables** (Site settings → Environment):
   - `NUXT_PUBLIC_API_URL` = la URL de Render del backend (ej. `https://agendly-api.onrender.com`).
   - **NO** setear `NUXT_API_URL_INTERNAL` (es solo para Docker local).
4. Deploy. Nitro autodetecta `NETLIFY` → preset `netlify` → función serverless SSR + estáticos.

**Gotcha conocido (monorepo + SSR):** si en el primer deploy las rutas SSR dan 404 (los estáticos cargan pero `/[slug]` no renderiza server-side), es que el catch-all a la función SSR no se registró. Fix: verificar en el build log que Netlify detectó Nuxt/Nitro; si no, agregar el módulo oficial `@netlify/nuxt` o un `_redirects` con `/* /.netlify/functions/server 200`. En un build local con `NITRO_PRESET=netlify` se generan `packages/frontend/dist/` (estáticos) y `packages/frontend/.netlify/functions-internal/server/server.mjs` (la función) — esa es la salida esperada.

---

## 5. CORS

El backend usa `FRONTEND_URL` para `enableCors` (`main.ts`). En Render, `FRONTEND_URL` **debe** ser exactamente la URL de Netlify (sin barra final), o el navegador bloquea las llamadas. Si cambiás el dominio de Netlify, actualizá `FRONTEND_URL` en Render y redeployá.

---

## Matriz de variables de entorno

### Backend (Docker local + Render)

| Var | Req | Local (compose) | Prod (Render) |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql://agendly:agendly_dev@db:5432/agendly` (ya en compose) | Neon (`...?sslmode=require`) |
| `JWT_SECRET` | ✅ | local válido en compose | secreto fuerte 32+ chars (`openssl rand -hex 32`); el default inseguro es rechazado al boot |
| `JWT_EXPIRATION` | ○ | `7d` | `7d` |
| `FRONTEND_URL` | ○→✅ | `http://localhost:3001` | URL de Netlify |
| `PORT` | ○ | `3000` (compose) | Render lo inyecta |
| `R2_ACCOUNT_ID` | ○ | — | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | ○ | — | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | ○ | — | Cloudflare R2 |
| `R2_BUCKET_NAME` | ○ | — | Cloudflare R2 |
| `R2_PUBLIC_URL` | ○ | — | URL pública del bucket |
| `RESEND_API_KEY` | ○ | — | para emails reales (si no, se loguean) |
| `GOOGLE_CLIENT_ID` / `_SECRET` / `_CALLBACK_URL` | ○ | — | OAuth Google (no-op si faltan) |
| `LOG_LEVEL` | ○ | `info` | `info` (o `debug` para diagnosticar) |
| `SENTRY_DSN` | ○ | — | error tracking backend (ver OBSERVABILITY.md) |

### Frontend (Docker local + Netlify)

| Var | Req | Local (compose) | Prod (Netlify) |
|---|---|---|---|
| `NUXT_PUBLIC_API_URL` | ✅ | `http://localhost:3000` (ya en compose) | URL de Render |
| `NUXT_API_URL_INTERNAL` | solo local | `http://backend:3000` (ya en compose) | **no setear** |
| `NUXT_PUBLIC_SENTRY_DSN` | ○ | — | error tracking frontend (ver OBSERVABILITY.md) |

Vars de Stripe (backend, opcionales; sin ellas billing responde 503 y la UI muestra "contáctanos"):

| Var | Dónde obtenerla |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (usa la **test** `sk_test_...`) |
| `STRIPE_PRICE_ID` | Stripe → Products → tu plan → Price ID (`price_...`) |
| `STRIPE_WEBHOOK_SECRET` | del endpoint de webhook (`whsec_...`, ver abajo) |

---

## Stripe (suscripción SaaS)

Modelo: un plan mensual flat (el precio se define en Stripe, no en el código). Trial de 14 días automático al registrarse; al vencer sin pago, el admin se bloquea (redirige a `/admin/subscription`) y el negocio deja de tomar reservas públicas.

**Setup (test mode, una sola vez):**
1. Crear cuenta en https://stripe.com (modo **Test** activado, sin verificación de negocio para probar).
2. **Product + Price**: Products → Add product → nombre "Agendly Profesional" → precio **recurrente mensual** en MXN (ej. $299) → guardar → copiar el **Price ID** (`price_...`) → `STRIPE_PRICE_ID`.
3. **API key**: Developers → API keys → copiar la **Secret key** de test (`sk_test_...`) → `STRIPE_SECRET_KEY`.
4. **Webhook**:
   - **Prod (Render)**: Developers → Webhooks → Add endpoint → URL `https://<tu-backend>.onrender.com/billing/webhook` → eventos: `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` → copiar el **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` en Render.
   - **Local**: instalar [Stripe CLI](https://stripe.com/docs/stripe-cli) → `stripe listen --forward-to localhost:3000/billing/webhook` → imprime el `whsec_...` → ponerlo en el `.env` de compose.
5. **Probar el flujo**: login → `/admin/subscription` → Suscribirme → Checkout de Stripe (tarjeta test `4242 4242 4242 4242`, cualquier fecha futura/CVC) → el webhook activa la suscripción (`ACTIVE`). Probar fallo con `stripe trigger invoice.payment_failed`.

El webhook verifica la firma sobre el body crudo; el resto de la API valida DTOs normalmente. El "Customer Portal" (gestionar/cancelar) se habilita en Stripe → Settings → Billing → Customer portal.

---

## Cloudflare R2 (imágenes: logos y banners)

**¿Vale la pena?** Sí: el código ya está escrito para R2 (`storage.service.ts`, S3-compatible), el free tier da **10 GB de storage, 10M lecturas/mes, 1M escrituras/mes**, y el **egreso es $0** — servir las imágenes a los clientes no cuesta nunca (a diferencia de S3). Además el backend optimiza cada imagen antes de subir (sharp: resize + WebP), así que 10 GB alcanzan para decenas de miles de negocios.

Pasos (una sola vez):

1. Crear cuenta en https://dash.cloudflare.com (el plan free alcanza). Al activar **R2 Object Storage** pide una tarjeta de verificación — **no cobra** mientras estés dentro del free tier.
2. R2 → **Create bucket** → nombre `agendly-media`, ubicación automática.
3. Acceso público para servir las imágenes: en el bucket → **Settings → Public access → R2.dev subdomain → Allow**. La URL que te da (ej. `https://pub-xxxx.r2.dev`) es tu `R2_PUBLIC_URL`.
   - Para producción real conviene un **custom domain** (ej. `media.agendly.mx`) con caché CDN de Cloudflare; para el PoC el subdominio r2.dev alcanza.
4. Credenciales: R2 → **Manage R2 API Tokens → Create API Token** → permiso **Object Read & Write**, scoped al bucket `agendly-media` → te da `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`. El `R2_ACCOUNT_ID` aparece en la home del dashboard de R2.
5. Setear las 5 variables:
   - **Render**: Environment → agregar `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME=agendly-media`, `R2_PUBLIC_URL`.
   - **Local**: en un `.env` en la raíz del repo (compose las inyecta al backend).

Sin estas variables todo funciona igual, excepto subir logo/banner (falla con error controlado al intentarlo).

**Optimización automática:** toda imagen subida pasa por sharp (`packages/backend/src/profile/image-processor.ts`): rotación EXIF, resize (logo máx 512×512, banner máx 1600×900, sin agrandar) y conversión a **WebP** — típicamente 70-90% menos peso que el original sin pérdida visible. Se aceptan JPEG, PNG y WebP de entrada.

---

## Auto-deploy (sin GitHub Actions de deploy — $0)

Las integraciones git nativas hacen todo; no hay que escribir workflows de deploy:

- **Render**: en el servicio → Settings → **Auto-Deploy: On Commit** para la rama `main`. Opcional y recomendado: **"Wait for CI to pass"** — Render espera el check verde de GitHub Actions antes de deployar. Push a main → CI → deploy automático.
- **Netlify**: auto-deploy on push viene activado por defecto al conectar el repo. Activá también **Deploy Previews** (Site configuration → Build & deploy → Deploy Previews) — cada PR obtiene una URL de preview gratis.
- **Protección de la rama main**: en repo **público** es gratis (Settings → Branches → require status checks antes de merge). En repo **privado** free no está disponible — el "Wait for CI" de Render cubre lo esencial (nunca se deploya un build con CI rojo).
- Si algún día se quiere deploy orquestado desde Actions (por ejemplo, para correr migraciones como paso separado): Render y Netlify exponen **Deploy Hooks** (una URL a la que se hace POST) — se agrega un job al final del CI que los llama. No hace falta para el PoC.

El CI (`.github/workflows/ci.yml`) corre en cada push/PR a `main`: typecheck + lint + tests (backend con Postgres real) + build de los tres packages. Costo: $0 (repo público ilimitado; privado 2,000 min/mes vs ~5 min/run).

---

## Limitaciones conocidas (PoC)

- **`forgot-password`** pega a `/api/auth/forgot-password` (ruta relativa que no existe) → falla en silencio. Pendiente (ver `ROADMAP.md`).
- **Migraciones en el arranque:** OK con un solo contenedor. Si escalás a múltiples instancias en Render, mover `prisma migrate deploy` a un job de release separado.
- **Datos legacy de logo:** tenants que subieron logo antes de la migración a R2 tienen `logoUrl` relativo (`/uploads/...`) servido por el static mount deprecado del backend; basta resubir el logo para migrarlos.
