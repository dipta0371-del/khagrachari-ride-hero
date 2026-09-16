# CHT GARI — APK handoff (Emergent.sh vs existing Capacitor)

## What Emergent.sh actually is
Emergent.sh-এর Mobile Agent [2](https://help.emergent.sh/mobile-app-development) নতুন অ্যাপ prompt থেকে Expo/React Native-এ বানায়। এছাড়া "Web ↔ Mobile" ফিচার [3](https://help.emergent.sh/web-mobile) আছে — সেটা existing web অ্যাপের frontend আবার build করে, backend/database/login একই রাখে।

তবে আমাদের অ্যাপ Lovable-এ (TanStack Start + Capacitor Android wrapper)। Emergent-এর সরাসরি GitHub repo থেকে Capacitor APK বানানোর ফিচার নেই। তাই দুটি রাস্তা আছে।

## Recommended path (faster, keeps your Lovable app)
Use the existing `android/` folder and build locally or via GitHub Actions — already configured.

### Step 1 — Pre-requisites
- GitHub sync চালু করো (Lovable → Plus menu → GitHub → Connect project)।
- Firebase Console → CHT GARI (`cht-gari`) → Android app (`com.amarkgc.chtgari`) → `google-services.json` ডাউনলোড করো।

### Step 2 — Build options
**A. Android Studio দিয়ে:**
```bash
npm install
npx cap sync
npx cap open android
# then Build → Build Bundle(s) / APK(s) → Build APK(s)
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

**B. GitHub Actions দিয়ে:**
- GitHub secret `GOOGLE_SERVICES_JSON` = base64 of `google-services.json`
- Run `.github/workflows/build-apk.yml` manually
- Download artifact `cht-gari-debug-apk`

## If you still want Emergent.sh
You can ask Emergent's Mobile Agent to build a **new** Expo/React Native Android app by describing CHT GARI in detail. It won't reuse your existing Lovable code directly, but it can replicate the features.

### Exact prompt to paste to Emergent.sh Mobile Agent
```text
Build an Android (and iOS) ride-sharing app called "CHT GARI" using Expo/React Native.

Overview:
- Ride-sharing app for Khagrachari hill district, Bangladesh
- Two user roles: Rider and Driver
- Cash-only rides
- Bengali UI with Latin-script branding "CHT GARI"

Core features:
1. Auth: email/password signup/login for both riders and drivers. Admin role that approves drivers.
2. Rider flow: pick pickup and destination with Google Places autocomplete (Khagrachari bias), see fare estimate for bike/totom (two vehicle types), confirm booking, live-track driver on map, cancel ride, rate driver after trip.
3. Driver flow: register vehicle, go online/offline, receive ride requests, accept, mark arrived/started/completed, see earnings.
4. Live location: upload driver location every 5 seconds when online/in a ride; rider sees driver marker moving on map with ETA.
5. Push notifications: Firebase Cloud Messaging for new ride requests, driver accepted, ride started/completed.
6. Map: OpenStreetMap or Google Maps for markers, route lines, and pin selection.
7. Admin panel: approve/reject drivers, edit fare rates per vehicle type, view statistics.

Backend: keep shared backend/database/login with the existing web version. The web app is live at https://chtgari.com and backend uses Supabase (auth + Postgres + realtime).

Deliver:
- Expo project source
- APK for Android
- Instructions to run locally and test push notifications
- List of env variables needed (Firebase config, Supabase URL/key, Google Maps key)
```

## What to attach/send if using Emergent
- Screenshot/screen recording of your current web app ( rider booking, driver screen, live tracking )
- Brand assets: app icon, splash image, brand color `#2F5D3C` or current primary color
- Firebase `google-services.json` for Android push (after Firebase project setup)
- Supabase project URL and anon key (if you want Emergent to connect to same backend)
- Google Maps API key (if using Google Maps)

## Honest caveat
Emergent-এ rebuilding করলে আপনার Lovable-এ করা সব customization, fare logic, Bengali date format, approval flow, etc. আবার নতুন করে verify করতে হবে। Capacitor path-এ সেই কাজগুলো already done।
