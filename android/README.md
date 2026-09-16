# CHT GARI — Android APK তৈরির নির্দেশনা

প্রজেক্টে ইতিমধ্যে Capacitor + Android wrapper যোগ করা আছে। তবে APK বানাতে আর Push Notification চালু করতে দুটো অতিরিক্ত কাজ তোমাকে করতে হবে।

## ১. `google-services.json` যোগ করো (Push Notification-এর জন্য Must)

Android-এ Firebase Cloud Messaging (FCM) চালু করতে `android/app/google-services.json` ফাইল লাগবে। এটি ছাড়া APK বানানো যাবে, কিন্তু Push Notification কাজ করবে না।

**ফাইলটা কোথায় পাবে:**
- Firebase Console → CHT GARI project → Project settings → General → "Your apps" → Android app (`com.amarkgc.chtgari`) → `google-services.json` download করো।
- ✅ ফাইলটি ইতিমধ্যে `android/app/google-services.json`-এ যোগ করা আছে — নতুন করে কিছু করতে হবে না।
- যদি Lovable Cloud-এর Firebase connector থেকে নিজে access না পাও, তাহলে Lovable support বা project owner-কে বলে `google-services.json` নিয়ে আসো।

**যোগ করার ধাপ:**
```bash
# ডাউনলোড করা google-services.json কে এই লোকেশনে রাখো:
android/app/google-services.json
```

ফাইলটা `.gitignore`-এ আছে, তাই GitHub-এ upload হবে না — এটাই ঠিক।

## ২. Android Studio দিয়ে APK বানাও

```bash
# ১. Lovable থেকে প্রজেক্ট GitHub-এ export করো
# ২. নিজের কম্পিউটারে clone করো
# ৩. Android Studio install না থাকলে https://developer.android.com/studio থেকে নাও (ফ্রি)
# ৪. Terminal-এ এই command চালাও
npm install
npx cap sync
npx cap open android
```

Android Studio খোলার পর:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- APK `android/app/build/outputs/apk/debug/app-debug.apk` তে তৈরি হবে
- Release APK পেতে চাইলে **Build → Generate Signed App Bundle or APK** → কীস্টোর তৈরি করে sign করো

## ৩. বিকল্প: GitHub Actions দিয়ে সরাসরি APK ডাউনলোড

নিজের কম্পিউটারে Android Studio না থাকলে `.github/workflows/build-apk.yml` যোগ করে GitHub Actions দিয়ে APK বানানো যায়। এটার জন্য `GOOGLE_SERVICES_JSON` নামে একটি GitHub secret-এ `google-services.json` এর base64 কন্টেন্ট রাখতে হবে।

## ৪. APK তে কী কী কাজ করবে

- রাইড বুকিং, ড্রাইভার accept, live tracking — সব কাজ করবে
- Background location — ড্রাইভার ফোন lock থাকলেও চলবে (Android permission "Allow all the time" দিতে হবে)
- Push notification — কেবল `google-services.json` যোগ করলে চালু হবে
- ভাষা বাংলা, ক্যাশ অনলি, ফোন lock-এ location warning থাকবে না (ওয়েবের মতো নয়)

## ৫. সতর্কতা

- APK-তে অ্যাপটি published web URL `https://khagrachari-ride-hero.lovable.app` থেকে লোড হয়। তাই web-এ কোনো পরিবর্তন publish করলে APK আপনাআপনি update হবে, নতুন APK লাগবে না।
- Internet ছাড়া অ্যাপ খুলবে না।
- Play Store-এ দিতে চাইলে একবার $25 ডেভেলপার অ্যাকাউন্ট লাগবে।
