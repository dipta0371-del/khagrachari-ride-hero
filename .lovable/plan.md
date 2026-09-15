# CHT GARI — Move to Lovable, Polish, and Launch

## What you have today
I downloaded and reviewed the zip. It's a genuinely well-built Bangla-first ride-booking MVP for Khagrachari:

- **Rider flow** — pick up / drop off on a map, choose bike or reserved tomtom, see a server-calculated fare, book, track, cancel, view history.
- **Driver flow** — go online, accept a matching request, mark arrived, start, complete with cash.
- **Admin console** — view all rides, approve or suspend drivers, edit fare rates.
- **Live location sharing** during an active ride for both rider and driver.
- Real rules enforced on the server: 10 km service zone, passenger limits, one active ride per person, only the assigned driver can advance a ride.
- Bangla interface with proper Bengali typography, OpenStreetMap maps, keyboard and mobile support.

It currently runs only on your own computer: the data lives in a local file, and logins are demo buttons with no passwords.

## What has to change to go live
The three things standing between this and a public app:

1. **Storage** — the local database file has to become a real hosted database so data survives and multiple people share it.
2. **Logins** — the "demo entry" buttons need to become real accounts (phone or email) with rider / driver / admin roles.
3. **Hosting** — the app needs to run on the web instead of `127.0.0.1`.

## Plan

### Phase 1 — Rebuild in Lovable
Port the app into this Lovable project, keeping all your existing logic, Bangla copy, fare rules, and screens intact.
- Rider booking screen, driver screen, admin screen, map picker, live location — all carried over.
- Fare maths, service zone, validation, and ride state machine reused as-is.

### Phase 2 — Real backend on Lovable Cloud
Replace the local file database with Lovable Cloud (hosted database + logins + storage).
- Tables for users, drivers, rides, live locations, rate settings, and audit records.
- Security rules so riders only see their own rides, drivers only their assigned ride, and admins everything.
- Seed the demo drivers and starting fares so the app is usable the moment it opens.

### Phase 3 — Real accounts (email sign-up)
- Riders and drivers sign up and sign in with **email and password**. Phone sign-in comes later.
- Profile stores name and an optional phone number for rider–driver contact during a ride.
- Driver registration with vehicle type and plate, pending admin approval before they can accept rides.
- Admin role stored securely in a separate roles table, never editable from the browser.

### Phase 4 — Design upgrade
- A distinct visual identity for CHT GARI — hill-district palette, not a generic template.
- Polished mobile-first booking screen, clearer ride-status tracking, better driver dashboard, cleaner admin tables.
- Keep the Bengali typography and accessibility work you already did.

### Phase 5 — Missing features (my picks, in order)
For a real ride-sharing launch these matter most, so I'll build them in this order:

1. **Phone numbers and in-ride contact** — a rider must be able to call their driver. Without this the app can't be used for real trips.
2. **Ratings and reports after a ride** — the only trust and safety signal you have. Riders rate drivers, drivers rate riders, admin sees low scores.
3. **Fare breakdown shown before booking** — base + per-km + minimum spelled out, so nobody argues about price at the end.
4. **Driver earnings summary** — today's and this week's completed rides and cash totals. Drivers won't stay without it.
5. **Smarter driver matching** — show pending requests nearest-first instead of a plain list.
6. **Admin stats dashboard** — daily rides, completion rate, cancellations, active drivers.

Ride notifications (SMS/push) are deliberately left for later: they need a paid SMS provider and a native app for reliable push.

### Phase 6 — Launch
- Security scan, build check, end-to-end test of the full booking flow.
- Publish to a live web address; optional custom domain.

## Technical notes
- Source stack: Vite + React 19 SPA, Express 5 API, `node:sqlite`, Zod, Leaflet / react-leaflet, Noto Sans Bengali.
- Target stack: TanStack Start (React 19, SSR) + Lovable Cloud (Postgres, auth, storage). Express routes become server functions; `shared/domain.ts` (Zod schemas, `quote`, `distanceKm`, state machine) ports essentially unchanged.
- Leaflet must be loaded client-only behind `ClientOnly` with a dynamic import, since the new stack renders on the server.
- Polling intervals (3.5 s status, 5 s location upload) carry over initially; live location can move to realtime subscriptions later.
- Idempotent booking, atomic ride acceptance, and the partial unique indexes for one-active-ride become Postgres constraints plus row-level security policies.

## Decisions needed from you
1. Should riders and drivers sign in with **phone number** or **email**?
2. Which Phase 5 features matter most for your first real launch?
3. ~~Keep the name পাহাড়ি / Pahari, or rebrand?~~ Rebrand to **CHT GARI**.
