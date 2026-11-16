# Public booking Playwright CLI checklist

End-to-end check of the main flow: a client books from the public link without an account, and
the appointment shows up in the admin agenda. Run it with `playwright-cli` and two separate
browser sessions: one admin session and one unauthenticated client session.

## Verification status

| Environment                   | Status       | Notes                                                                                 |
| ----------------------------- | ------------ | ------------------------------------------------------------------------------------- |
| Local (Docker Compose)        | Verified     | 2026-11-15, Firefox through `playwright-cli`, seed data, fictional client data        |
| Production (Netlify + Render) | Not verified | Run this checklist before recording or submitting; expect a cold start of up to ~50 s |

The duplicate-booking check below was a sequential API test. It does not prove behavior under
concurrent requests.

## Targets

| Environment | Public booking page                                  | Admin login                              |
| ----------- | ---------------------------------------------------- | ---------------------------------------- |
| Local       | http://localhost:3001/bellas-nails-demo              | http://localhost:3001/login              |
| Production  | https://agendly-admin1.netlify.app/bellas-nails-demo | https://agendly-admin1.netlify.app/login |

Demo account: `demo@agendly.mx` / `demo1234`. It is shared, so other people may have changed its
data. Use fictional client data only.

In production, open https://agendly-admin1.netlify.app/bellas-nails-demo once and wait for it to
load before starting. Render's free plan suspends the backend when it is idle.

## Client session (unauthenticated)

```bash
playwright-cli -s=client open --browser=firefox <public booking page>
playwright-cli -s=client resize 430 932
playwright-cli -s=client snapshot
```

1. Step 1 of 4 lists the services with duration and price. Pick one, for example `Manicure`.
2. Step 2 of 4 lists the specialists who offer it. Pick one, for example `Ana García`.
3. Step 3 of 4 shows the next days and the available time slots. Pick a future day and a slot,
   then click `Continuar`.
4. Step 4 of 4: fill `Nombre completo` and `Teléfono móvil` with fictional data and accept the
   privacy notice and terms checkbox.
5. Click `Confirmar cita`. Expect `¡Tu cita está confirmada!` with the service, specialist,
   date, time and a booking reference.

## Admin session

```bash
playwright-cli -s=admin open --browser=firefox <admin login>
playwright-cli -s=admin resize 1440 900
```

6. Log in with the demo account. Expect a redirect to `/admin` with the agenda.
7. Move the agenda to the booked day with `Siguiente`. Expect the new appointment with the client
   name, service and time range, in `Confirmada` status.
8. Check that `Tu enlace de reservas` shows the public URL of the environment being tested.
9. Log out, then open `/admin` again. Expect a redirect to the login page.

## Duplicate booking (API, sequential)

10. Send a second `POST /availability/book?tenantSlug=bellas-nails-demo` request for the same
    specialist and start time as the confirmed appointment. Expect HTTP `409` and no new
    appointment in the agenda.

## Other checks

- An unknown slug, such as `/no-existe`, shows the public 404 page.
- No step shows real personal data or secrets on screen.

## Cleanup

```bash
playwright-cli close-all
```
