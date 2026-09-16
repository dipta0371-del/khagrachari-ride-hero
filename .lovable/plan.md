# CHT GARI — Emergent.sh (Hermes agent) APK handoff

## Goal
CHT GARI ওয়েব অ্যাপটাকে Android APK-এ কনভার্ট করে নিয়ে আসা, push notification সহ।

## Current project state (verified)
- Capacitor Android wrapper আছে (`android/` folder, `capacitor.config.ts`).
- Package name: `com.amarkgc.chtgari` (সব জায়গায় মিলানো আছে).
- Firebase project ID: `cht-gari`; web push config-এ appId আছে (`1:340064546983:web:...`).
- **GitHub এখনো কানেক্টেড নয়** — বর্তমান git remote শুধু Lovable-এর internal storage।
- **`android/app/google-services.json` ফাইলটি মিসিং** — এটি ছাড়া APK বানানো যাবে, কিন্তু push notification কাজ করবে না।
- GitHub Actions workflow রেডি আছে (`.github/workflows/build-apk.yml`), কিন্তু সেটা চালু করতে GitHub secret `GOOGLE_SERVICES_JSON` লাগবে।

## Step 1 — Before contacting Emergent.sh
1. Lovable-এ প্রজেক্ট GitHub-এ sync/connect করো (Plus menu → GitHub → Connect project)।
2. Firebase Console-ে গিয়ে CHT GARI (`cht-gari`) প্রজেক্ট → Project settings → Android app (`com.amarkgc.chtgari`) → `google-services.json` ডাউনলোড করে নাও।

## Step 2 — Exact message to paste to Emergent.sh
```text
Build an Android APK for the CHT GARI ride-sharing app from this GitHub repo.

Repo: <তোমার GitHub repo URL>
Package name: com.amarkgc.chtgari
Tech stack: TanStack Start + React + Capacitor (android/ folder already exists)

Requirements:
1. Install dependencies and run `npx cap sync`.
2. Place the attached `google-services.json` into `android/app/google-services.json`.
3. Build a debug APK with Android Studio OR via the existing GitHub Actions workflow `.github/workflows/build-apk.yml`.
4. If using GitHub Actions, create a repository secret named `GOOGLE_SERVICES_JSON` containing the base64-encoded content of the attached `google-services.json` file, then run the workflow manually.
5. Return the APK file or the download link, plus step-by-step install instructions for a real Android phone.

Also test push notification registration if possible, and report back any errors.
```

## Step 3 — What to attach/upload
- `google-services.json` (downloaded from Firebase Console)।
- যদি GitHub Actions path নাও, তাহলে Hermes agent-কে সেই ফাইলটাই base64 করে `GOOGLE_SERVICES_JSON` secret হিসেবে GitHub-এ যোগ করতে বলো।

## Step 4 — Expected output
- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Install command: `adb install app-debug.apk` বা phone-এ file transfer করে tap-install।
- Push notification test result (success / error message)।

## Note
APK-তে অ্যাপ published URL `https://khagrachari-ride-hero.lovable.app` থেকে লোড হবে। তাই web-এ নতুন পরিবর্তন publish করলে APK আপনাআপনি update হবে, নতুন APK লাগবে না।
