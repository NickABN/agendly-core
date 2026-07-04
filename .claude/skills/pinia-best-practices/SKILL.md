---
name: pinia
description: Pinia conventions for the Agendly frontend. Use when defining stores, working with state/getters/actions, or deciding store vs composable in packages/frontend.
metadata:
  version: "2.0.0"
  scope: packages/frontend
---

# Agendly Pinia Rules

Self-contained project guide. No external references.

## When a store, when a composable

- **Pinia store**: state shared across multiple pages/components that must survive navigation (auth session, business profile).
- **Composable**: per-page data fetching and CRUD (`use<Feature>.ts`). Most features here need a composable, NOT a store. Don't create stores for page-local calendar/list state.

## Store style: setup stores only

```ts
export const useProfileStore = defineStore('profile', () => {
  const profile = ref<TenantProfileDto | null>(null);
  const pending = ref(false);

  const isOnboarded = computed(() => !!profile.value?.onboardedAt);

  async function load() { /* ... */ }

  return { profile, pending, isOnboarded, load };
});
```

- No Options-API stores (`{ state, getters, actions }`) in new code; migrate old ones when touched.
- Instantiate dependencies (e.g. `useProfileApi()`) ONCE at store setup, not inside every action.
- Reading store state in components: destructure via `storeToRefs(store)` to keep reactivity; actions can be destructured directly.

## Rules

- Types from `@agendly/shared`; no anonymous state shapes.
- Stores never touch `$fetch` directly — they call the feature's API composable.
- SSR: stores are safe (Pinia + Nuxt module handles hydration); never share state via module-scope variables.
- Testing: `@pinia/testing`'s `createTestingPinia()` with spies; see `stores/profile.spec.ts` for the in-repo pattern.
