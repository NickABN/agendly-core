# Agendly

Plataforma SaaS de agendamiento de citas para negocios pequeños de belleza y estética en México
(salones, barberías, spas). Los clientes del negocio reservan solos desde una página pública, sin
crear cuenta, y el dueño administra su agenda desde un panel pensado primero para el celular.

## Enlaces de entrega

| Recurso                   | Enlace                                               |
| ------------------------- | ---------------------------------------------------- |
| Demo (panel)              | https://agendly-admin1.netlify.app                   |
| Página pública de ejemplo | https://agendly-admin1.netlify.app/bellas-nails-demo |
| Presentación (slides)     | TODO: agregar enlace                                 |
| Video de demostración     | TODO: agregar enlace                                 |
| Repositorio               | https://github.com/NickABN/agendly-core              |

### Usuario de prueba

| Campo      | Valor             |
| ---------- | ----------------- |
| Correo     | `demo@agendly.mx` |
| Contraseña | `demo1234`        |

Ingreso en https://agendly-admin1.netlify.app/login.

> **Importante**
>
> - **Es una cuenta compartida.** Cualquier persona con estas credenciales ve y modifica los mismos
>   datos, así que lo que encuentres puede haber sido cambiado por otra persona evaluadora.
> - **El primer request puede tardar ~50 s.** El backend corre en el plan gratuito de Render, que
>   suspende el servicio tras un período de inactividad. Si la primera carga parece colgada, espera y
>   recarga; a partir de ahí responde con normalidad.

## Índice

1. [Descripción general](#1-descripción-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Arquitectura](#3-arquitectura)
4. [Estructura del proyecto](#4-estructura-del-proyecto)
5. [Funcionalidades principales](#5-funcionalidades-principales)
6. [IA y métricas de impacto](#6-ia-y-métricas-de-impacto)
7. [Instalación y ejecución local](#7-instalación-y-ejecución-local)
8. [Tests y calidad](#8-tests-y-calidad)
9. [Despliegue](#9-despliegue)
10. [Seguridad y observabilidad](#10-seguridad-y-observabilidad)
11. [Roadmap](#11-roadmap)
12. [Autor y licencia](#12-autor-y-licencia)

---

## 1. Descripción general

### Problema

Los negocios pequeños de belleza en México (1 a 10 empleados) coordinan sus citas a mano por
WhatsApp a lo largo del día. Eso implica:

- cambios constantes de contexto para el dueño, que atiende clientes y contesta mensajes a la vez;
- reservas perdidas o mal registradas;
- inasistencias (_no-shows_) sin aviso;
- un techo de crecimiento: el dueño no puede delegar el agendamiento sin perder el control ni ve su
  demanda real.

### Solución

Agendly automatiza el agendamiento con dos piezas complementarias:

1. **Página pública de reservas** (`/[slug]` del negocio): el cliente elige servicio, empleado,
   fecha y horario disponible, deja nombre y teléfono (el correo es opcional) y recibe confirmación,
   sin crear una cuenta.
2. **Panel de administración**: agenda por día, semana y mes que se actualiza sola, alta de citas
   manuales para clientes sin reserva previa, gestión de servicios, empleados y horarios, y métricas
   del negocio.

El motor de reservas es independiente del canal (web, manual o, a futuro, WhatsApp) y una restricción
en la base de datos impide la doble reserva de un mismo empleado.

### Propuesta de valor

- **Certeza para ambas partes:** el cliente sabe que su cita es real y el dueño tiene su día
  definido sin vigilar un chat.
- **Cero fricción para el cliente final:** reserva desde el celular sin registrarse.
- **Hecho para México:** interfaz en español, zona horaria del negocio y páginas legales alineadas a
  la LFPDPPP (aviso de privacidad y derechos ARCO).
- **Costo de operación $0:** toda la infraestructura usa planes gratuitos y la parte de IA no
  depende de APIs pagas.

Fuente: [`product-brief.md`](product-brief.md).

---

## 2. Stack tecnológico

Monorepo **pnpm** (`pnpm@10.32.1`, ver `package.json` de la raíz) con tres paquetes en TypeScript.

| Capa                      | Tecnología                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Backend                   | NestJS 11, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL                                                    |
| Base de datos (prod)      | PostgreSQL gestionado en Neon                                                                             |
| Autenticación             | Passport.js con JWT (`passport-jwt`) y Google OAuth (`passport-google-oauth20`), bcrypt                   |
| Frontend                  | Nuxt 3, Vue 3, Pinia, Nuxt UI 3, Tailwind CSS 4                                                           |
| Paquete compartido        | `@agendly/shared`: DTOs, enums y utilidades de fecha usados por backend y frontend                        |
| Correo                    | Resend                                                                                                    |
| Archivos (logos, banners) | Cloudflare R2 vía AWS S3 SDK (`@aws-sdk/client-s3`); imágenes optimizadas con `sharp`                     |
| Pagos                     | Stripe (implementado y **apagado**: solo se activa con `BILLING_ENFORCED=true`)                           |
| Observabilidad            | Sentry (`@sentry/nestjs`, `@sentry/vue`), logs estructurados con pino (`nestjs-pino`), `@nestjs/terminus` |
| Seguridad HTTP            | `helmet`, `@nestjs/throttler`, cookies httpOnly (`cookie-parser`)                                         |
| Tests                     | Jest + `fast-check` (backend), Vitest + Vue Test Utils (frontend y `shared`)                              |
| CI y tareas programadas   | GitHub Actions                                                                                            |
| Hosting                   | Render (backend en Docker), Netlify (Nuxt SSR + proxy `/api`)                                             |

---

## 3. Arquitectura

```mermaid
flowchart LR
    U["Navegador<br/>(dueño o cliente)"]

    subgraph Netlify
        N["Nuxt 3 SSR<br/>+ proxy /api"]
    end

    subgraph Render
        B["API NestJS<br/>(contenedor Docker)"]
    end

    DB[("PostgreSQL<br/>Neon")]
    R["Resend<br/>(correo)"]
    R2[("Cloudflare R2<br/>logos y banners")]
    GH["GitHub Actions<br/>cron cada hora"]

    U -- "HTTPS: páginas y /api/**" --> N
    N -- "/api/** sin prefijo" --> B
    B -- "Prisma" --> DB
    B -- "confirmaciones,<br/>recordatorios, reset" --> R
    B -- "S3 API" --> R2
    U -. "imágenes públicas" .-> R2
    GH -- "POST /reminders/run<br/>(x-cron-secret)" --> B
```

- El navegador solo habla con el dominio de Netlify. Nitro reenvía `/api/**` al backend de Render,
  quitando el prefijo y conservando estado, cabeceras, redirecciones y cookies, así que las cookies
  de sesión quedan en el mismo origen. El callback de Google OAuth también entra por
  `/api/auth/google/callback`.
- Render (plan gratuito) se suspende por inactividad. Por eso los recordatorios no usan un cron en
  proceso: los dispara un workflow de GitHub Actions cada hora (`.github/workflows/reminders.yml`).
- Las migraciones se aplican al arrancar el contenedor (`prisma migrate deploy` en
  `docker-entrypoint.sh`).
- Es multi-tenant: cada negocio es un tenant aislado y los datos llevan `tenantId`.

Detalle completo en [`DEPLOY.md`](DEPLOY.md).

---

## 4. Estructura del proyecto

```text
.
├── packages/
│   ├── backend/      API NestJS, esquema y migraciones Prisma, seed, Dockerfile
│   ├── frontend/     App Nuxt 3: landing, página pública /[slug], panel /admin, páginas legales
│   └── shared/       DTOs, enums, fechas, slugs reservados y versión de documentos legales
├── .github/workflows/
│   ├── ci.yml        typecheck + lint + tests + build en cada push/PR a main
│   └── reminders.yml cron horario que dispara los recordatorios
├── docker-compose.yml  PostgreSQL + backend + frontend para desarrollo local
├── netlify.toml        build y cabeceras de seguridad del frontend
├── DEPLOY.md · SECURITY.md · OBSERVABILITY.md · ROADMAP.md · product-brief.md
└── scripts/            utilidades del monorepo (p. ej. bloqueo de tests .only)
```

Módulos de `packages/backend/src`:

| Módulo          | Responsabilidad                                                                                |
| --------------- | ---------------------------------------------------------------------------------------------- |
| `auth/`         | Registro, login, Google OAuth, refresh tokens con rotación, logout, recuperación de contraseña |
| `tenant/`       | Datos del negocio y cierre del onboarding                                                      |
| `services/`     | CRUD de servicios (duración, buffer, precio) y su disponibilidad por día                       |
| `employees/`    | CRUD de empleados y servicios que atiende cada uno                                             |
| `schedules/`    | Horarios por empleado y horario por defecto                                                    |
| `availability/` | Cálculo de horarios libres y creación de reservas (públicas y manuales)                        |
| `appointments/` | Agenda (día, semana, mes), cambio de estado de citas y listado de clientes                     |
| `public/`       | Perfil público de un negocio por `slug` (sin autenticación)                                    |
| `profile/`      | Logo, banner y ubicación del negocio; subida a R2 y geocodificación                            |
| `email/`        | Envío de correos con Resend (confirmación, cancelación, recordatorio, reset, pagos)            |
| `reminders/`    | Endpoint `POST /reminders/run` protegido con `CRON_SECRET`                                     |
| `insights/`     | Métricas de impacto y modelo de riesgo de inasistencia                                         |
| `billing/`      | Integración con Stripe (checkout, portal, webhook); apagada por defecto                        |
| `health/`       | `GET /health` (liveness) y `GET /health/ready` (con ping a la base)                            |
| `config/`       | Validación de variables de entorno, CORS y configuración del logger                            |
| `common/`       | Guards (incluido `TenantGuard`), filtros, interceptores, decoradores y tipos comunes           |
| `prisma/`       | Módulo y servicio de Prisma                                                                    |
| `generated/`    | Cliente Prisma generado                                                                        |

---

## 5. Funcionalidades principales

| Funcionalidad               | Qué hace                                                                                                                                                                                                                                           | Dónde está                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Registro y onboarding       | Alta con correo y contraseña o con Google; asistente que configura negocio, servicios, empleados y horario, y termina mostrando el enlace público                                                                                                  | `auth/`, `tenant/`, `pages/register.vue`, `pages/onboarding.vue`                          |
| Servicios                   | Duración, tiempo de buffer y precio en MXN; eliminación lógica (`deletedAt`)                                                                                                                                                                       | `services/`, `/admin/services`                                                            |
| Empleados                   | Alta, edición y servicios que atiende cada uno; eliminación lógica                                                                                                                                                                                 | `employees/`, `/admin/staff`                                                              |
| Horarios                    | Bloques por día de la semana para cada empleado y horario por defecto                                                                                                                                                                              | `schedules/`                                                                              |
| Reserva pública sin cuenta  | El cliente elige servicio, empleado y horario libre y deja sus datos; se guarda su consentimiento de privacidad con IP y recibe confirmación por correo si lo dio. La base impide la doble reserva con una restricción de exclusión (`btree_gist`) | `pages/[slug].vue`, `availability/`                                                       |
| Agenda                      | Vistas de día, semana y mes; citas manuales; estados completada, cancelada o inasistencia. Se actualiza cada 15 s, solo con la pestaña visible                                                                                                     | `appointments/`, `/admin`, `composables/useAppointmentsCalendar.ts`                       |
| Recordatorios por correo    | Para citas confirmadas con correo que empiezan en 1 a 24 h y se reservaron hace al menos 12 h; máximo 50 por corrida. A las de riesgo alto les pide confirmar                                                                                      | `reminders/`, `.github/workflows/reminders.yml`                                           |
| Recuperación de contraseña  | Token de un solo uso guardado como hash SHA-256, válido 30 min; al restablecer se revocan todas las sesiones                                                                                                                                       | `auth/password-reset.service.ts`, `pages/forgot-password.vue`, `pages/reset-password.vue` |
| Sesiones con refresh tokens | Access token de 15 min y refresh token opaco en cookie httpOnly, rotado en cada uso, con detección de reutilización, vigencia deslizante de 7 días, tope de 30 días y "cerrar todas las sesiones"                                                  | `auth/token.service.ts`                                                                   |
| Páginas legales y ARCO      | Términos, aviso de privacidad y formulario ARCO que prepara la solicitud por correo al responsable; la aceptación de términos se guarda con la versión del documento                                                                               | `/terminos`, `/privacidad`, `/arco`, `shared/src/legal.ts`                                |
| Métricas e IA               | Ver [sección 6](#6-ia-y-métricas-de-impacto)                                                                                                                                                                                                       | `insights/`, `/admin/metrics`                                                             |

---

## 6. IA y métricas de impacto

Esta es la parte que distingue al proyecto en lo académico. Todo se calcula dentro del backend a
partir de las citas del negocio: **no usa servicios externos ni APIs pagas**.

### 6.1 Métricas de impacto (`GET /insights/summary`, página `/admin/metrics`)

Calculadas en `packages/backend/src/insights/insights.service.ts` para un rango de fechas:

- **Autonomía:** porcentaje de citas que el cliente reservó solo por la web frente a las
  capturadas a mano.
- **Inasistencia:** `NO_SHOW / (COMPLETED + NO_SHOW)`, y tasa de cancelación.
- **Fricción:** mediana de segundos que tarda un cliente en completar el formulario público
  (`Appointment.bookingDurationSec`).
- **Anticipación:** mediana de horas entre la reserva y la cita.
- **Clientes únicos y recurrentes**, serie semanal y distribución por canal.
- **Efecto de los recordatorios:** inasistencia de citas con recordatorio frente a sin él. Es una
  comparación observacional, no un experimento controlado: los clientes sin correo no pueden
  recibir recordatorio.

### 6.2 Riesgo de inasistencia interpretable (`src/insights/no-show-risk.ts`)

Función pura que asigna a cada cita una probabilidad estimada de inasistencia, un nivel
(bajo, medio o alto) y las **razones** en lenguaje natural ("Cliente nuevo", "Faltó a 1 cita
anterior"…). El nivel y las razones se muestran en la agenda del dueño.

- **Modelo:** regresión logística, `score = sigmoid(z)`, con **pesos a priori** (versión
  `prior-v1`) basados en la literatura sobre inasistencias en servicios con cita, no entrenados
  con datos del negocio. Variables: faltas previas del cliente (tope 3), visitas completadas
  (tope 4), cliente nuevo, días de anticipación (en escala logarítmica), canal web y ausencia de
  correo.
- **Por qué no un modelo de caja negra:** el dueño tiene que entender por qué se marca una cita, y
  con poco historial por negocio un modelo entrenado se sobreajustaría.
- **Evaluación sin fuga de datos:** `featuresFromHistory` usa solo el historial anterior a cada
  cita, de modo que la misma función sirve para puntuar en vivo y para evaluar hacia atrás.
  `evaluateRiskModel` compara las puntuaciones con lo que pasó realmente y reporta **AUC ROC**
  (Mann–Whitney), **Brier score**, y precisión y recall de las citas marcadas como riesgo medio o
  alto. Estos indicadores aparecen en `/admin/metrics`.
- **Uso:** el recordatorio por correo de las citas de riesgo alto pide confirmar asistencia.
- **Versionado:** si cambian los pesos se sube `RISK_MODEL.version`.

Pendiente: reajustar los pesos con datos reales cuando haya volumen suficiente (ver
[ROADMAP.md](ROADMAP.md), fase 4b). Las fases que usan LLM (asistente conversacional y onboarding
asistido) están en pausa por costo.

---

## 7. Instalación y ejecución local

Los pasos siguientes se probaron en una copia limpia del repositorio, en Linux, con Node 24.22.2,
pnpm 10.32.1 y Docker 29.

### Requisitos

- **Node.js 24** (la versión fijada en [`.nvmrc`](.nvmrc); con nvm: `nvm use`).
- **pnpm 10** (el repositorio declara `pnpm@10.32.1`; con Corepack: `corepack enable`).
- **Docker** con Docker Compose, para PostgreSQL 16.

### Pasos

1. Clonar e instalar dependencias:

   ```bash
   git clone https://github.com/NickABN/agendly-core.git
   ```

   ```bash
   cd agendly-core
   ```

   ```bash
   pnpm install
   ```

2. Levantar solo la base de datos. Compose la expone en el **puerto 5433** del host:

   ```bash
   docker compose up -d db
   ```

3. Crear los archivos de entorno a partir de los ejemplos:

   ```bash
   cp packages/backend/.env.example packages/backend/.env
   ```

   ```bash
   cp packages/frontend/.env.example packages/frontend/.env
   ```

   En `packages/backend/.env` hay que cambiar dos valores:
   - `DATABASE_URL`: el ejemplo usa el puerto 5432, pero Compose publica Postgres en el **5433**:
     `postgresql://agendly:agendly_dev@localhost:5433/agendly`
   - `JWT_SECRET`: un valor de al menos 32 caracteres, por ejemplo la salida de
     `openssl rand -hex 32`.

   Variables mínimas para correr en local:

   | Paquete  | Variable              | Valor local                                               |
   | -------- | --------------------- | --------------------------------------------------------- |
   | backend  | `DATABASE_URL`        | `postgresql://agendly:agendly_dev@localhost:5433/agendly` |
   | backend  | `JWT_SECRET`          | 32 caracteres o más                                       |
   | backend  | `FRONTEND_URL`        | `http://localhost:3001`                                   |
   | backend  | `PUBLIC_APP_URL`      | `http://localhost:3001`                                   |
   | frontend | `NUXT_PUBLIC_API_URL` | `http://localhost:3000`                                   |
   | frontend | `NUXT_PUBLIC_APP_URL` | `http://localhost:3001`                                   |

   Todo lo demás es opcional. Sin `RESEND_API_KEY` los correos solo se registran en el log, sin
   las variables `R2_*` falla únicamente la subida de logo y banner, y sin las de Google el botón
   de Google OAuth no funciona. La matriz completa está en [`DEPLOY.md`](DEPLOY.md).

4. Generar el cliente Prisma, aplicar las migraciones y cargar los datos de demostración:

   ```bash
   cd packages/backend
   ```

   ```bash
   npx prisma generate
   ```

   ```bash
   npx prisma migrate deploy
   ```

   ```bash
   npx prisma db seed
   ```

   El seed crea el negocio **Bellas Nails Demo** (`bellas-nails-demo`) con 6 servicios, 3
   empleadas con horario de lunes a sábado de 9:00 a 19:00, y el usuario
   `demo@agendly.mx` / `demo1234`.

5. Volver a la raíz y levantar backend y frontend en paralelo:

   ```bash
   cd ../..
   ```

   ```bash
   pnpm dev
   ```

| Servicio            | URL                                     |
| ------------------- | --------------------------------------- |
| Frontend            | http://localhost:3001                   |
| Página pública demo | http://localhost:3001/bellas-nails-demo |
| API backend         | http://localhost:3000                   |
| Health check        | http://localhost:3000/health/ready      |

Para apagar la base: `docker compose down` (conserva los datos) o `docker compose down -v` (los
borra).

> También existe un modo con todo el stack en contenedores (`docker compose up --build`), descrito
> en [`DEPLOY.md`](DEPLOY.md) §1. Ese modo no se volvió a probar al redactar este README.

---

## 8. Tests y calidad

Desde la raíz:

```bash
pnpm test
```

```bash
pnpm lint
```

```bash
pnpm typecheck
```

```bash
pnpm format:check
```

Resultado en la copia limpia usada para este README: **401 tests pasan** (backend 215 con Jest,
frontend 130 y `shared` 56 con Vitest), y `lint` y `typecheck` terminan sin errores. Los tests de
unidad no necesitan base de datos. El lint con ESLint está configurado en el backend; frontend y
`shared` todavía no tienen lint propio.

Las pruebas cubren la lógica crítica: disponibilidad y reservas, rotación y revocación de tokens,
recuperación de contraseña, aislamiento entre tenants, recordatorios, métricas y el modelo de
riesgo (incluidas pruebas basadas en propiedades con `fast-check`).

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)): en cada push o PR a `main`, con
Node 24 y un servicio PostgreSQL 16, ejecuta instalación con lockfile congelado, auditoría de
dependencias (informativa), typecheck, lint, tests y build de los tres paquetes.

---

## 9. Despliegue

| Componente    | Plataforma                     | Notas                                                          |
| ------------- | ------------------------------ | -------------------------------------------------------------- |
| Frontend      | Netlify                        | Nuxt SSR; Nitro reenvía `/api/**` al backend                   |
| Backend       | Render (Docker, plan gratuito) | `packages/backend/Dockerfile`; health check en `/health/ready` |
| Base de datos | Neon                           | PostgreSQL gestionado; migraciones al arrancar el backend      |
| Archivos      | Cloudflare R2                  | Logos y banners en WebP                                        |
| Correo        | Resend                         | Requiere un dominio verificado en `EMAIL_FROM`                 |
| Recordatorios | GitHub Actions                 | Cron horario → `POST /reminders/run`                           |

Render y Netlify despliegan automáticamente al hacer push a la rama conectada. El paso a paso, la
matriz de variables de entorno y la configuración de cada servicio están en
[`DEPLOY.md`](DEPLOY.md).

---

## 10. Seguridad y observabilidad

**Seguridad** ([`SECURITY.md`](SECURITY.md)): auditoría contra OWASP Top 10 y la LFPDPPP. Entre lo
corregido: validación de `JWT_SECRET` (mínimo 32 caracteres, rechaza el valor por defecto conocido),
límite de 5 intentos por minuto en login y registro, corrección de IDOR entre tenants en horarios y
empleados, cabeceras con `helmet` y en `netlify.toml`, bcrypt de 12 rondas, sesión en cookies
httpOnly con refresh tokens revocables, y registro de la IP en el consentimiento de privacidad. El
documento lista también lo pendiente.

**Observabilidad** ([`OBSERVABILITY.md`](OBSERVABILITY.md)): logs JSON con pino y un request ID
por petición, redacción de cabeceras sensibles y enmascarado de correos, health checks de
liveness y readiness, y Sentry en backend y frontend (inactivo si no se define el DSN).

---

## 11. Roadmap

El detalle está en [`ROADMAP.md`](ROADMAP.md). Lo principal pendiente:

- Reagendar citas desde el panel con aviso al cliente, y un enlace en el correo para que el cliente
  cancele su propia cita.
- Reajustar los pesos del modelo de riesgo con datos reales cuando haya al menos 200 citas
  atendidas y 20 inasistencias.
- Recordatorios por WhatsApp (hoy solo por correo) y eliminación de cuenta desde el panel.
- Configurar la identidad legal en producción y someter los textos legales a revisión de un
  abogado.

---

## 12. Autor y licencia

**Autor:** Nico ([@NickABN](https://github.com/NickABN)). Proyecto desarrollado como Trabajo Final
de Máster (TFM).

**Licencia:** TODO: definir. El repositorio todavía no incluye un archivo `LICENSE` y el
`package.json` del backend declara `"license": "UNLICENSED"`. Mientras no se agregue una licencia,
aplican todos los derechos reservados por el autor.
