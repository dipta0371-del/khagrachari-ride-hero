# Switch the whole app to English

Every Bengali word in the app becomes English: about 470 lines across 22 screens and parts. No Bengali will be left anywhere.

## What changes
- **All screens:** home page, sign in / sign up, booking, active ride, the screen after a ride ends, ride history, driver panel, admin, profile, and the shared live-trip link.
- **Messages:** pop-up messages, error messages, and status names (Requested, Accepted, Arrived, On trip, Completed, Cancelled).
- **Numbers and dates:** shown in English digits, for example ৳120, 3.5 km, "Oct 7, 4:30 PM". The ৳ sign stays.
- **Map:** the pin letters, "Loading map…", and the search hint ("Search pickup — market, school, hotel…").
- **Notifications:** phone alert text such as "New ride request" and "Driver accepted".
- **Google place search:** results come back in English first, but Bengali names typed by riders still work.
- **Page titles and sharing previews:** in English.
- **Fonts:** a clean English font replaces the Bengali fonts. The "CHT GARI" brand and its green colour stay as they are.

## What stays the same
How the app works: fares, the 10 km area, any-amount bargaining, cash-only payment, live tracking, and the steps of a ride. Accounts and past rides are untouched.

## Technical details
- Translate the strings in all files listed by the Bengali text search (`src/routes/*`, `src/components/*`, `src/lib/domain.ts`, `rides.functions.ts`, `places.functions.ts`, `native-bridge.ts`).
- In `domain.ts`: `bn()` returns `toLocaleString("en-US")` (keep the name or rename it and update callers). `money()` gives `৳1,234`. The date helpers use `en-US`. Translate `statusLabels`, `vehicleLabels` (Bike / Tomtom), `cancelReasons`, and the places list names.
- Server-side error and notification messages in `rides.functions.ts` move to English.
- Places: `languageCode: "en"`.
- `__root.tsx`: change `lang="en"`, use the Space Grotesk + DM Sans fonts, and update the font tokens in `styles.css`.
- Update `head()` meta tags on every page.
- Android: the location-tracking notification text in `native-bridge.ts` becomes English.
- Check: the Bengali text search returns nothing and the type check passes. Then a Playwright run at phone size through booking → ride → finish screen to catch layout breaks.
