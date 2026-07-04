---
name: nuxt
description: Nuxt 3 conventions for the Agendly frontend. Use when working with pages, layouts, data fetching, middleware, or SSR behavior in packages/frontend.
metadata:
  version: "2.0.0"
  scope: packages/frontend
---

# Agendly Nuxt Rules

Self-contained project guide. No external references.

## Project layout

- `pages/` file-based routing. Admin area under `pages/admin/` (layout `admin`), public booking at `pages/[slug].vue` (layout `public`), auth under `pages/auth/`.
- Auth is enforced globally by `middleware/auth.global.ts` — do NOT add per-page `middleware: 'auth'`.
- Auto-imports are on: `composables/`, `utils/`, and `components/` need no import statements. Feature components live in `components/<feature>/` and are referenced by their prefixed name (e.g. `components/calendar/CalendarHeader.vue` → `<CalendarHeader>`).

## Data fetching

- Initial page data that should render on SSR: `useAsyncData`/`useFetch` (the public `[slug]` page does this for tenant data).
- Interactive/authenticated CRUD: the `useApi()` wrapper (`composables/useApi.ts`) inside feature composables (`use<Feature>.ts`). Pages never call `useApi()` directly.
- API base URL comes from runtime config (`useRuntimeConfig().public.apiUrl`) — never hardcode.
- Handle errors in the composable and expose `{ pending, error }` state; don't copy-paste try/catch into pages.

## Public pages (SEO + status codes)

- A nonexistent resource must be a REAL 404: `throw createError({ statusCode: 404, statusMessage: '...' })` — not an in-page empty state (which returns 200 to crawlers).
- Shareable public pages set `useSeoMeta` (title, description, OG tags) from tenant data.

## SSR safety

- No `window`/`document` access during setup — guard with `import.meta.client` or move to `onMounted`.
- Anything locale/timezone-dependent renders through shared datetime utils so server and client output match (hydration).
- State that must survive SSR serialization uses `useState` or a Pinia store — not module-scope variables.

## Polling (MVP convention)

- Admin data polls every 10-15s ONLY while the tab is visible. Use a composable that registers `visibilitychange` + interval in `onMounted` and removes BOTH in `onUnmounted`.
