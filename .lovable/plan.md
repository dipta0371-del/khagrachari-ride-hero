# CHT GARI — Emergent.sh Android-only APK: চূড়ান্ত prompt

## গুরুত্বপূর্ণ তথ্য (যাচাই করা)
- Emergent-এর Mobile Agent শুধু **Expo/React Native** stack-এ কাজ করে [2](https://help.emergent.sh/mobile-app-development) — paid plan ($20+/month) লাগে, free tier-এ নেই।
- আমাদের অ্যাপ TanStack Start + Capacitor। Emergent সরাসরি এই Capacitor প্রজেক্ট build করবে না — সে নতুন করে Expo-তে বানাবে।
- আপনার repo: `https://github.com/dipta0371-del/khagrachari-ride-hero.git`
- Package name: `com.amarkgc.chtgari`, Firebase project: `cht-gari`
- Live web app: `https://chtgari.com` (backend Supabase)

## যা Emergent-কে দিতে হবে
1. GitHub repo লিংক (উপরে) — repo public না হলে public করো বা Emergent-কে access দাও।
2. Firebase `google-services.json` (Firebase Console → cht-gari → Android app `com.amarkgc.chtgari` → download) — attach করো।
3. **Supabase credentials (শুধু নিচের দুটো):**
   - Supabase project URL
   - Supabase anon/publishable key
   - **Service role key কখনো দেবেন না** — সেটা শুধর server-এর।
4. অ্যাপ আইকন / ব্র্যান্ড কালার (`#2F5D3C`)।

---

## চূড়ান্ত Prompt (হুবহু copy-paste করো)

```text
Build a NATIVE ANDROID-ONLY app for my existing ride-sharing web service "CHT GARI". No iOS needed.

SOURCE CODE (read this repo first to understand all features, screens, business rules, fare logic, Bengali text, and database schema):
https://github.com/dipta0371-del/khagrachari-ride-hero.git

LIVE WEB APP (for reference): https://chtgari.com

WHAT IT IS:
A ride-sharing app for Khagrachari hill district, Bangladesh. Bengali language UI. Cash-only payments. Two vehicle types: bike and totom (CNG-like local vehicle). Three roles: Rider, Driver, Admin.

TECHNICAL REQUIREMENTS:
- Android only (Expo/React Native is fine)
- MUST reuse the SAME backend: Supabase (auth + Postgres + realtime). Do NOT create a new backend or database. I will provide the Supabase URL and anon key. Users who signed up on web must be able to log in on the Android app.
- Android package name MUST be: com.amarkgc.chtgari
- Firebase Cloud Messaging for push notifications (Firebase project: cht-gari). I will attach google-services.json.
- Google Places API for location search with Khagrachari bias; OpenStreetMap or Google Maps for the map display.

FEATURES TO REPLICATE (all already exist in the repo — match them exactly):
1. Auth: email/password signup and login for riders and drivers. Admin role approves drivers before they can go online.
2. Rider flow (Uber-style booking screen):
   - Two stacked search rows: pickup (green dot) and destination (red square), each with Google Places autocomplete in Bengali and English
   - Swap button between the two rows
   - Map pin selection: full map with a center-fixed pin the user drags, reverse-geocoded address shown below, "confirm this location" button
   - "My location" GPS button
   - Saved places and popular place chips
   - Vehicle cards (bike / totom) showing fare and ETA
   - Negotiable fare: rider can enter ANY positive amount, no min/max limit
   - 10 km service radius validation from Khagrachari center
3. Driver flow: vehicle registration, online/offline toggle, incoming ride requests, counter-offer any amount, accept, mark arrived → started → completed, earnings summary.
4. Live tracking: driver uploads GPS location every 5 seconds while online or in a ride. Rider sees the driver marker moving on the map with live ETA. Ride status polls every 3.5 seconds.
5. BACKGROUND LOCATION (this is the main reason I need a native app): driver location must keep uploading even when the phone screen is locked or the app is in the background. Use a foreground service with a persistent notification.
6. Push notifications via FCM: new ride request (to nearby online drivers), driver accepted, driver arrived, ride started, ride completed, ride cancelled.
7. Ratings: rider rates driver after ride completion.
8. Cancellation: both sides can cancel before the ride starts.
9. Admin screens: approve/reject drivers, edit fare rates per vehicle type, view statistics.
10. Access control: riders cannot see driver screens and vice versa; a user with an active ride cannot book another one.

UI/UX:
- All user-facing text in Bengali (copy the exact Bengali strings from the repo)
- Bengali number and date formatting
- Brand color #2F5D3C, app name "CHT GARI" in Latin script
- Mobile-first layouts matching the existing web screens

DELIVERABLES:
1. A working debug APK I can install on a real Android phone
2. The full source code
3. A list of all environment variables / config I need to set
4. Step-by-step instructions to install the APK and test push notifications and background location on a real device

IMPORTANT: Read the GitHub repo thoroughly before writing code. The fare calculation, ride state machine, Bengali strings, and Supabase table schema are all already defined there — match them, don't reinvent them.
```

---

## কোথায় থেকে Supabase URL আর Anon Key পাবেন
Lovable editor-এ:
1. **Cloud** বা **Backend** প্যানেল খুলুন
2. **Project settings / Environment variables / Supabase** সেকশনে দেখুন
3. দুটো value কপি করুন:
   - `SUPABASE_URL` (যেমন `https://othzgksynaxdodfokegp.supabase.co` — নিজের প্রজেক্টেরটা হবে)
   - `SUPABASE_ANON_KEY` বা `SUPABASE_PUBLISHABLE_KEY`

এই দুটো শুধু mobile app frontend-কে backend-এ connect করতে লাগে; user login, database read/write RLS-এর মাধ্যমে secure।

## Prompt দেওয়ার পর Emergent যা চাইবে
- Supabase URL + anon key → উপরের স্টেপ থেকে
- `google-services.json` → Firebase Console থেকে download করে attach করো
- Google Maps API key → তোমার Google Cloud Console থেকে
- অ্যাপ আইকন → নিজের লোগো ফাইল

## বিকল্প (দ্রুততর)
তোমার repo-তে ইতিমধ্যে Capacitor Android wrapper আছে। Android Studio বা GitHub Actions দিয়ে সরাসরি APK বানানো যাবে — Emergent-এ নতুন করে rebuild না করেই। তবে background location আর native push-এর জন্য Emergent-এর native rebuild বেশি ভালো ফল দেবে।
