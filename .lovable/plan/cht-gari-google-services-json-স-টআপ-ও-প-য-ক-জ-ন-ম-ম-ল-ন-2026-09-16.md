# CHT GARI — google-services.json সেটআপ ও প্যাকেজ নাম মেলানো

## সমস্যা

তুমি যে `google-services.json` এনেছ, সেখানে Android অ্যাপের প্যাকেজ নাম লেখা **`com.amarkgc.chtgari`**, কিন্তু আমাদের অ্যাপের প্যাকেজ নাম **`com.chtgari.app`**। নাম না মিললে Firebase এই ফাইলটা চিনবে না — APK বানানো যাবে, কিন্তু **পুশ নোটিফিকেশন আসবে না**।

দুটো পথ:

- **A) আমাদের অ্যাপের নাম বদলে Firebase-এর সাথে মেলাই** (`com.amarkgc.chtgari`) — আমি নিজেই করে দিতে পারি, তোমার কিছু করতে হবে না। প্যাকেজ নাম ইউজার কখনো দেখে না, তাই কোনো পার্থক্য বোঝা যাবে না।
- **B) Firebase Console-এ নতুন Android অ্যাপ যোগ করো** `com.chtgari.app` নামে → নতুন `google-services.json` ডাউনলোড — তোমাকে আবার Firebase-এ গিয়ে কাজ করতে হবে।

**সুপারিশ: A** — দ্রুত, ঝামেলাহীন। (প্ল্যান অনুমোদনের সময় B চাইলে বলো।)

## যা যা করব (পথ A)

1. **প্যাকেজ নাম বদলানো `com.amarkgc.chtgari`-এ**
   - `capacitor.config.ts`: `appId` আপডেট
   - `android/app/build.gradle`: `namespace` ও `applicationId` আপডেট
   - `android/app/src/main/java/.../MainActivity.java`: নতুন ফোল্ডার `com/amarkgc/chtgari/`-এ সরিয়ে package ঘোষণা ঠিক করা
   - `android/app/src/main/res/values/strings.xml`: `package_name`/`custom_url_scheme` আপডেট
   - `npx cap sync` চালিয়ে যাচাই

2. **`google-services.json` বসানো**
   - আপলোড করা ফাইল `android/app/google-services.json`-এ কপি
   - বিল্ড স্ক্রিপ্ট আগে থেকেই ফাইলটা চিনে google-services প্লাগিন চালু করে — পুশ নোটিফিকেশন তখনই কাজ করবে

3. **GitHub Actions-এর জন্য প্রস্তুতি**
   - ফাইলের base64 ভার্সন বানিয়ে রাখব, যাতে তুমি GitHub-এর `GOOGLE_SERVICES_JSON` secret-এ বসাতে পারো (নির্দেশনা চ্যাটে দেব)

4. **যাচাই**
   - TypeScript চেক + `npx cap sync` সফল কিনা দেখা
   - Firebase প্রজেক্ট (`cht-gari`) আমাদের পুশ সংযোগের প্রজেক্টের সাথে মেলে কিনা নিশ্চিত করা

## এরপর তোমার করণীয় (APK বিল্ড)

- প্রজেক্ট GitHub-এ এক্সপোর্ট → Android Studio বা GitHub Actions দিয়ে APK — ধাপগুলো `android/README.md`-এ আছে (নতুন প্যাকেজ নাম অনুযায়ী আপডেট করে দেব)।
- ফোনে ইনস্টল করে রাইড + নোটিফিকেশন একবার টেস্ট।

## সীমাবদ্ধতা

- এই পরিবেশে Android SDK নেই — APK এখানে বানানো যায় না; বিল্ড তোমার কম্পিউটার/GitHub-এ হবে।
