import { registerPlugin } from "@capacitor/core";
import type { BackgroundGeolocationPlugin, Location as BgLocation } from "@capacitor-community/background-geolocation";

export async function isNativePlatform(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function getPlatform(): Promise<"android" | "ios" | "web"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const p = Capacitor.getPlatform();
    if (p === "android" || p === "ios") return p;
  } catch {
    /* web */
  }
  return "web";
}

export type LocationCallback = (pos: { lat: number; lng: number; accuracy?: number }) => void;

export async function startNativeLocationWatcher(callback: LocationCallback): Promise<() => void> {
  const native = await isNativePlatform();
  if (!native) throw new Error("native-only");
  const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>("BackgroundGeolocation");
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: "CHT GARI চালকের লোকেশন শেয়ার করা হচ্ছে",
      backgroundTitle: "লোকেশন ট্র্যাকিং",
      distanceFilter: 20,
      requestPermissions: true,
    },
    (location?: BgLocation) => {
      if (!location) return;
      callback({
        lat: location.latitude,
        lng: location.longitude,
        accuracy: location.accuracy ?? undefined,
      });
    },
  );
  return () => {
    void BackgroundGeolocation.removeWatcher({ id });
  };
}

export async function registerPushToken(): Promise<{
  token: string | null;
  platform: "android" | "ios" | "web";
}> {
  const platform = await getPlatform();
  const native = await isNativePlatform();
  if (!native) return { token: null, platform };

  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return { token: null, platform };

  await PushNotifications.register();
  return new Promise((resolve) => {
    PushNotifications.addListener("registration", (token) => {
      resolve({ token: token.value, platform });
      void PushNotifications.removeAllListeners();
    });
    PushNotifications.addListener("registrationError", () => {
      resolve({ token: null, platform });
      void PushNotifications.removeAllListeners();
    });
  });
}

function idToNumber(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export async function scheduleLocalNotification(options: {
  id: string;
  title: string;
  body: string;
}): Promise<void> {
  const native = await isNativePlatform();
  if (!native) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.schedule({
    notifications: [
      {
        id: idToNumber(options.id),
        title: options.title,
        body: options.body,
        schedule: { at: new Date(Date.now() + 600) },
      },
    ],
  });
}
