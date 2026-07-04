---
name: new-page
description: Scaffold a new Nuxt 3 page with composables and Pinia store. Use when creating a new frontend view.
---

## Steps to create a new Nuxt page

1. Create the page file:
   ```
   packages/frontend/pages/<path>.vue
   ```
   The page is a thin composition surface: layout + component wiring + navigation state. Target ≤ ~150 lines.

2. Put ALL data fetching and mutations in a feature composable:
   ```
   packages/frontend/composables/use<Feature>.ts
   ```
   Convention: it returns `{ items, pending, error, create, update, remove }` (or the domain equivalent). Pages never call `useApi()` inline.

3. Extract UI into feature components:
   ```
   packages/frontend/components/<feature>/<Feature>List.vue
   packages/frontend/components/<feature>/<Feature>FormModal.vue
   ```

4. Create a Pinia store (setup style) only for state shared between multiple pages:
   ```
   packages/frontend/stores/<name>.ts   // defineStore('<name>', () => { ... })
   ```

## Hard split thresholds

Split into components + composable when ANY of these hits — no exceptions:
- Page exceeds ~250 lines
- Page contains more than 1 modal
- Page has more than 2 distinct fetch/mutation concerns
- A template section repeats (v-for card layouts, form groups)

Reference example of the pattern done right: the profile feature (`stores/profile.ts` + `composables/useProfileApi.ts` + `components/profile/*`).

## Rules

- **All visible text in Mexican Spanish** (es-MX, natural tone); code and identifiers in English.
- Use **Nuxt UI 3 components**: UButton, UCard, UTable, UModal, UInput, USelect, USlideover, etc.
- **Mobile-first**: design at 375px first, then add `md:`/`lg:`. No fixed widths that force horizontal page scroll; wide grids scroll inside their own `overflow-x-auto` container.
- **Auth is global**: `middleware/auth.global.ts` already protects routes — do NOT add `definePageMeta({ middleware: 'auth' })`. Public pages opt out via the global middleware's own rules.
- **Dates and times**: display ONLY via the shared datetime utils (`formatTime`/`formatDate` re-exported in `utils/date.ts` from `@agendly/shared`). Never call `toLocaleTimeString`/`toLocaleDateString` without an explicit `timeZone`, and never `new Date(str)` on a zoneless string.
- Shared helpers live in `utils/` (`date.ts`, `colors.ts`, `initials.ts`) — check before writing a local copy.
- Types for API payloads come from `@agendly/shared` — no inline anonymous response types.
- **Accessibility checklist (mandatory):** every `<label>` has `for` + input `id`; icon-only buttons have `aria-label`; toggle/selection buttons expose `aria-pressed`; async regions announce with `role="status"`/`aria-live="polite"`; interactive elements are `<button>`, not `<div @click>`.
