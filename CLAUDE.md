# Agendly

SaaS de agendamiento de citas para negocios de belleza y estética en México.

## Stack

- **Monorepo pnpm** con 3 packages: `packages/backend`, `packages/frontend`, `packages/shared`
- **Backend:** NestJS 11, Prisma, PostgreSQL, Passport.js (JWT + Google OAuth)
- **Frontend:** Nuxt 3, Vue 3, Tailwind CSS, Nuxt UI 3, Pinia
- **Shared:** DTOs y tipos TypeScript compartidos entre backend y frontend
- **Email:** Resend (SPF/DKIM)
- **Deploy:** free tiers — backend en Render (Docker), frontend en Netlify (Nuxt SSR + proxy `/api`), Postgres en Neon, imágenes en Cloudflare R2. Ver `DEPLOY.md`
- **CI/CD:** GitHub Actions

## Comandos

```bash
# Desarrollo
pnpm dev                    # Levanta backend + frontend en paralelo
pnpm dev:backend            # Solo backend (puerto 3000)
pnpm dev:frontend           # Solo frontend (puerto 3001)

# Build y calidad
pnpm build                  # Build de todos los packages
pnpm lint                   # Lint de todos los packages
pnpm typecheck              # Type-check de todos los packages
pnpm test                   # Tests de todos los packages
pnpm format                 # Formatea con Prettier
pnpm format:check           # Verifica formato

# Base de datos
docker compose up -d        # Levanta PostgreSQL
cd packages/backend && npx prisma migrate dev    # Ejecuta migraciones
cd packages/backend && npx prisma generate       # Genera cliente Prisma
cd packages/backend && npx prisma studio         # UI para explorar la BD

# Individual
pnpm --filter @agendly/backend <script>
pnpm --filter @agendly/frontend <script>
pnpm --filter @agendly/shared <script>
```

## Arquitectura

- **Multi-tenant:** Todas las tablas tienen `tenantId`. Cada negocio es un tenant aislado.
- **Soft deletes:** Empleados y servicios usan `deletedAt` en lugar de borrado físico.
- **Channel-agnostic:** El motor de reservas no sabe por qué canal llegó la cita (web, WhatsApp, manual).
- **Polling en MVP:** El admin se actualiza cada 10-15s con polling (solo cuando el tab está activo). WebSockets en V1.1.
- **URL pública:** Cada negocio tiene una URL compartible `/[slug]` para que sus clientes reserven (hoy `agendly-admin1.netlify.app/[slug]`; `agendly.mx` es el dominio objetivo).
- **Gratis por ahora:** el cobro está apagado (`BILLING_ENFORCED` sin definir). El código de Stripe se conserva, pero `/admin/subscription` funciona como página de apoyo voluntario (`NUXT_PUBLIC_SUPPORT_URL`).
- **Métricas e IA sin costo:** `src/insights/` calcula métricas de impacto y un riesgo de inasistencia interpretable (función pura `no-show-risk.ts`, sin APIs externas). Si cambian los pesos, sube `RISK_MODEL.version`. Las fases con LLM (asistente, onboarding asistido) están en pausa por costo.
- **Recordatorios:** `src/reminders/` los dispara GitHub Actions cada hora (`.github/workflows/reminders.yml`) con `CRON_SECRET`; no uses cron en proceso (Render free se duerme). Todo texto de usuario en correos pasa por `escapeHtml`.
- **Baja de cuenta:** `src/account-deletion/` — el dueño la pide en `/admin/account`; el tenant queda `isActive=false` con `deletionScheduledAt` (+30 días) y `.github/workflows/account-purge.yml` lo borra a diario (cascade + R2). Todo modelo nuevo con `tenantId` debe tener `onDelete: Cascade`.
- **Legal:** `/terminos`, `/privacidad` y `/arco` leen la identidad del responsable de `NUXT_PUBLIC_LEGAL_*`. Si cambia su contenido, sube `LEGAL_DOCS_VERSION` en `packages/shared/src/legal.ts` (se guarda con la aceptación de cada dueño). No anunciar en la landing funciones que no existen.

## Engram Memory

Al inicio de **cada conversación** sobre este proyecto:
1. Llamar `mcp__engram__mem_session_start` con `id=agendly-{fecha}` y `project=agendly`
2. Llamar `mcp__engram__mem_context` con `project=agendly` para recuperar contexto de sesiones anteriores

Al completar trabajo significativo (arquitectura, decisiones, bugs, configuración):
- Guardar con `mcp__engram__mem_save` **proactivamente**, sin esperar que el usuario lo pida

## Convenciones

- **UI en español mexicano**, código y variables en inglés
- TypeScript strict en todo el monorepo
- Prettier: semi, singleQuote, trailingComma: all, printWidth: 100
- Cada módulo NestJS debe usar `TenantGuard` en endpoints protegidos
- DTOs compartidos van en `packages/shared/src/`
- Mobile-first: todo el CSS se diseña primero para móvil
- Tests obligatorios para lógica de negocio crítica (disponibilidad, reservas)
