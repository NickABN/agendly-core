---
name: vue-best-practices
description: MUST be used for Vue.js tasks in this repo. Composition API with `<script setup lang="ts">` only. Load for any .vue file, component design, or refactor in packages/frontend.
metadata:
  version: "2.0.0"
  scope: packages/frontend
---

# Agendly Vue Rules

Self-contained project guide (Vue 3 + Nuxt 3 + Nuxt UI 3 + Tailwind). No external references.

## Component style

- Always `<script setup lang="ts">`; SFC section order: `<script>` → `<template>` → `<style>` (styles via Tailwind utilities; `<style>` blocks are rare).
- Props down / events up. Define contracts with `defineProps<{...}>()` and `defineEmits<{...}>()` — typed, no runtime-only declarations.
- Keep source state minimal (`ref`), derive with `computed`. Never call functions in templates inside `v-for` for filtering/grouping — precompute a `computed` Map keyed by the loop key.
- Watchers are for side effects (fetch on selection change), not for deriving state.

## Component boundaries (required before coding)

For any non-trivial feature, map components first:
- Route/page components are thin composition surfaces (≤ ~150 lines): navigation state + child wiring.
- Split when: 3+ distinct UI sections, >1 modal, repeated template blocks, or any section with its own fetch concern.
- Feature folder layout: `components/<feature>/...` + `composables/use<Feature>.ts`.
- ⚠️ Auto-import naming: Nuxt prefixes the directory and only dedupes EXACT segment overlap. `services/ServicesFormModal.vue` → `<ServicesFormModal>`, but `services/ServiceFormModal.vue` → `<ServicesServiceFormModal>` (singular ≠ plural — the component silently fails to resolve if you guess wrong). Name files starting with the exact PascalCase directory name.
- Good in-repo examples: `components/booking/*`, `components/profile/*`, `components/calendar/*`. Anti-example (historical): the old 1122-line `pages/admin/index.vue`.

## Data flow & logic placement

- ALL API access lives in composables (`composables/use<Feature>.ts`), never inline in pages or presentational components.
- Presentational components receive data via props and emit intents; they do not fetch.
- Reusable pure helpers go in `utils/` (auto-imported): `utils/date.ts` (re-export of `@agendly/shared` datetime), `utils/colors.ts`, `utils/initials.ts`. Check there before writing a helper.
- Payload/response types come from `@agendly/shared` — no inline anonymous API types.

## Dates & SSR safety

- Format dates/times ONLY through `formatTime`/`formatDate` from `utils/date.ts` (they pin `timeZone: America/Mexico_City` and consistent `hour12`). This also prevents SSR hydration mismatches from server/client locale differences.
- Never `new Date(str)` on a zoneless string; API instants always carry `Z`.

## Cleanup & lifecycle

- Every `addEventListener`/`setInterval` registered in `onMounted` gets its symmetric removal in `onUnmounted`. Prefer wrapping the pair in a composable so cleanup is impossible to forget.

## Accessibility (mandatory checklist)

- Labels associated via `for`/`id`.
- Icon-only buttons: `aria-label` in Spanish.
- Selection/toggle buttons: `aria-pressed`; current item in pickers: `aria-current`.
- Loading spinners/async regions: `role="status"` or `aria-live="polite"`.
- Interactive elements are real `<button>`/`<a>` — never `<div @click>`.
