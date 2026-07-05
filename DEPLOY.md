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
   - **Health Check Path:** `/` (el `AppController` responde)
3. **Environment variables** (ver matriz abajo): `DATABASE_URL` (Neon), `JWT_SECRET`, `FRONTEND_URL` (la URL de Netlify), `R2_*` (opcional). Render inyecta `PORT` solo; el entrypoint lo respeta.
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
| `JWT_SECRET` | ✅ | dev default en compose | secreto fuerte (generá con `openssl rand -hex 32`) |
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

### Frontend (Docker local + Netlify)

| Var | Req | Local (compose) | Prod (Netlify) |
|---|---|---|---|
| `NUXT_PUBLIC_API_URL` | ✅ | `http://localhost:3000` (ya en compose) | URL de Render |
| `NUXT_API_URL_INTERNAL` | solo local | `http://backend:3000` (ya en compose) | **no setear** |

---

## Limitaciones conocidas (PoC)

- **Ruta legacy `/tenant/logo`** usa disco local (multer `diskStorage`) → efímero en Render (se pierde en cada redeploy). La ruta nueva `/profile/logo` y `/profile/banner` usa R2 (persistente). El panel de configuración vieja usa la legacy; la de settings usa R2.
- **`forgot-password`** pega a `/api/auth/forgot-password` (ruta relativa que no existe) → falla en silencio. Pendiente.
- **Migraciones en el arranque:** OK con un solo contenedor. Si escalás a múltiples instancias en Render, mover `prisma migrate deploy` a un job de release separado.
