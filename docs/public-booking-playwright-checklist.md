# Public booking Playwright CLI checklist

Use this checklist after the branch is deployed to a reachable frontend URL. Do not run it against stale production if the current branch changes are not deployed yet.

## Required target URLs

- Frontend public app URL: `https://agendly-admin1.netlify.app`
- Browser API URL: same-origin `/api`; Nitro's private `NUXT_API_PROXY_TARGET` points to Render
- A tenant slug with public access enabled, for example: `<slug>`

## Lightweight manual CLI flow

```bash
npx --no-install playwright-cli open https://agendly-admin1.netlify.app/<slug>
npx --no-install playwright-cli snapshot
npx --no-install playwright-cli click "getByText('Agendar cita')"
npx --no-install playwright-cli snapshot
```

## Verification checklist

1. Confirm the page resolves at `https://agendly-admin1.netlify.app/<slug>`.
2. Confirm the public booking form renders without any `agendly.mx` booking-link text.
3. Confirm admin/onboarding copy surfaces show the Netlify-root-based booking URL format.
4. Confirm any copy-to-clipboard action uses the deployed `NUXT_PUBLIC_APP_URL` base.
5. If the slug is invalid, confirm the page returns the existing public 404 experience.

## Current blocker in this workspace

This repository session did not start a local frontend server and the current branch changes are not deployed from this workspace, so Playwright CLI cannot verify the new runtime-config-driven booking URL end-to-end here without unsupported infrastructure steps.
