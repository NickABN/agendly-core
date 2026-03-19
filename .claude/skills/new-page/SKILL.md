---
name: new-page
description: Scaffold a new Nuxt 3 page with composables and Pinia store. Use when creating a new frontend view.
---

## Steps to create a new Nuxt page

1. Create the page file:
   ```
   packages/frontend/pages/<path>.vue
   ```

2. Create a composable if the page needs data fetching or complex logic:
   ```
   packages/frontend/composables/use<Name>.ts
   ```

3. Create a Pinia store if the page needs shared state:
   ```
   packages/frontend/stores/<name>.ts
   ```

## Rules

- **All visible text must be in Mexican Spanish** (es-MX, natural tone)
- Use **Nuxt UI 3 components**: UButton, UCard, UTable, UModal, UInput, USelect, etc.
- **Mobile-first design** — start with mobile layout, then add `md:` and `lg:` breakpoints
- Use `useFetch` or `$fetch` for API calls, reading `apiUrl` from runtime config
- Use `definePageMeta({ middleware: 'auth' })` for protected pages
- Keep page components thin — move logic to composables
- Use Pinia stores for state shared between multiple pages
