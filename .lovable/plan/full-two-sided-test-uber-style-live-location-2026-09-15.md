# Full two-sided test + Uber-style live location

Goal: verify CHT GARI end to end with a simulated rider and driver moving on the map, fix what breaks, and confirm it is safe to open to the public.

## Part 1 — Make live location behave like Uber

Today location sharing only starts when a person taps "আমার অবস্থান শেয়ার করুন". In Uber nobody taps anything — the driver's dot just moves. Changes:

- The driver's position is shared automatically whenever they have an active ride (accepted, arrived, on trip). No button press needed.
- The rider's position is shared automatically from the moment a ride is accepted until pickup, so the driver can find them.
- A visible on/off control stays available for anyone who wants to stop sharing, plus a clear note when the phone has blocked location permission.
- The moving dot updates every few seconds and shows "live" vs "last seen X seconds ago" when updates stop.
- Show the driver's distance and rough arrival time to the pickup point while the driver is on the way, and to the destination during the trip.
- Location rows are still deleted when the ride ends.

## Part 2 — Full two-sided test with moving GPS

Run an automated test with two browser sessions (rider and driver), each with a simulated GPS position that moves along a route in Khagrachhari, and check:

1. Rider signs up, driver signs up, admin approves the driver.
2. Driver goes online and stays online after a page reload.
3. Rider books a bike ride; the request appears on the driver board.
4. Driver accepts; rider screen switches to tracking automatically.
5. Driver's dot moves on the rider's map as the simulated position changes; arrival estimate updates.
6. Arrived → trip started → completed; fare and earnings correct.
7. Rider rates the driver; driver rating average updates.
8. Cancellation paths: rider cancels before accept, driver cancels after accept.
9. Second ride is blocked while one is active; tomtom vehicle type works too.
10. Location rows are gone after the ride completes.
11. Signed-out visitors cannot reach rider, driver or admin screens; a non-admin cannot open the admin screen.
12. Mobile-size screen check of every page (most users will be on phones).

Anything that fails gets fixed and re-tested in the same pass.

## Part 3 — Public-readiness check

- Confirm access rules on every table (a rider cannot read other people's rides, a driver only sees open requests matching their vehicle).
- Confirm rate/fare settings can only be changed by the admin.
- Remove all test data afterwards so the live app starts empty and the first real account can claim admin.
- Production build check, then publish.

## Known limits to accept for launch

- Location updates stop if the phone screen locks or the browser goes to background — this is a browser limitation; the app shows a warning. A real background-tracking app would need a native app later.
- No SMS/push notifications yet; the rider and driver see updates while the app is open.
- Payment is cash only.

## Technical notes

- Automated checks run with Playwright using `context.set_geolocation` + `permissions=["geolocation"]`, moving the coordinates step by step between waypoints.
- Auto-sharing is driven from the ride status in `LiveTracking` and the driver panel, with the existing 5-second throttle and 3.5-second peer polling retained.
- ETA is computed from remaining straight-line distance with the same speed assumption used by the fare estimate.
