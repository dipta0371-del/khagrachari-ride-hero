# CHT GARI — Android APK: কী আছে আর কী বাকি

## এখন যা রেডি (এগুলো দিয়েই APK বানানো যাবে)

- Capacitor মোড়ক + `android/` ফোল্ডার — সম্পূর্ণ, `npx cap sync` সফল।
- Android permissions ঠিক আছে — লোকেশন (foreground + background), নোটিফিকেশন, foreground service।
- Push নোটিফিকেশনের সব কোড লেখা — native bridge, PushSetupCard, ডেটাবেসে device token সংরক্ষণ, রাইড ইভেন্টে নোটিফিকেশন পাঠানো।
- `android/README.md` — বিল্ড নির্দেশনা, `.github/workflows/build-apk.yml` — GitHub-এ অটো-বিল্ড।
- ওয়েব অ্যাপ সম্পূর্ণ টেস্ট করা (দুই পক্ষ, ৪৫+ চেক পাস)।

## বাকি যা আছে (APK বানানোর আগে)

1. **সর্বশেষ পরিবর্তন পাবলিশ করা** — অফার-সীমার ফিক্স ও নতুন Uber/Pathao-স্টাইল UX এখনো পাবলিশ সাইটে নেই। APK পাবলিশড সাইট থেকে কন্টেন্ট লোড করে, তাই আগে পাবলিশ করতে হবে।

2. **`google-services.json` আনা (শুধু পুশ নোটিফিকেশনের জন্য)** — Firebase Console → CHT GARI প্রজেক্ট → Android অ্যাপ `com.chtgari.app` → ফাইলটি ডাউনলোড করে `android/app/google-services.json`-এ রাখতে হবে। এটি ছাড়াও APK বানানো যাবে ও রাইড সব চলবে, কিন্তু পুশ নোটিফিকেশন আসবে না।

3. **APK বিল্ড করা (আপনার কম্পিউটারে বা GitHub-এ)** — এই স্যান্ডবক্সে Android SDK নেই, তাই এখানে বিল্ড সম্ভব নয়:
   - Android Studio: GitHub-এ এক্সপোর্ট → `npm install && npx cap sync && npx cap open android` → Build APK।
   - অথবা GitHub Actions: `GOOGLE_SERVICES_JSON` secret সেট করে Actions ট্যাব থেকে APK ডাউনলোড।

4. **ঐচ্ছিক (পরে করা যাবে)** — অ্যাপ আইকন ও স্প্ল্যাশ স্ক্রিন কাস্টমাইজ (এখন ডিফল্ট Capacitor আইকন), Play Store তালিকার স্ক্রিনশট ও বিবরণ।

## ধাপ

1. সর্বশেষ পরিবর্তন পাবলিশ।
2. আপনি `google-services.json` এনে দিলে সেটআপ করে দেব (না পেলে ও ধাপ ৩ চলবে)।
3. আপনি Android Studio বা GitHub Actions দিয়ে APK বানাবেন — নির্দেশনা `android/README.md`-এ আছে।
4. ফোনে ইনস্টল করে একবার পুরো রাইড + নোটিফিকেশন টেস্ট।

## সারসংক্ষেপ

কোডের দিক থেকে আর কোনো কাজ বাকি নেই — APK-এর জন্য রেডি। বাকিটা শুধু: পাবলিশ → google-services.json → বিল্ড।
