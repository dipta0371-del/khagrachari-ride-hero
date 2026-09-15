import { useEffect, useRef } from "react";

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
    const platform = Capacitor.getPlatform();
    if (platform === "android" || platform === "ios") return platform;
  } catch {
    /* fall through */
  }
  return "web";
}

export type LocationCallback = (pos: { lat: number; lng: number; accuracy?: number }) => void;

export async function startNativeLocationWatcher(callback: LocationCallback): Promise<() => void> {
  const native = await isNativePlatform();
  if (!native) throw new Error("native-only");
  const { BackgroundGeolocation } = await import("@capacitor-community/background-geolocation");
  const id = await BackgroundGeolocation.addWatcher(
    {
      backgroundMessage: "CHT GARI চালকের লোকেশন শেয়ার করা হচ্ছে",
      backgroundTitle: "লোকেশন ট্র্যাকিং",
      distanceFilter: 20,
      requestPermissions: true,
    },
    (location) => {
      if (!location) return;
      callback({ lat: location.latitude, lng: location.longitude, accuracy: location.accuracy ?? undefined });
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
        id: options.id,
        title: options.title,
        body: options.body,
        schedule: { at: new Date(Date.now() + 600) },
      },
    ],
  });
}

/** React hook that pushes the user's position to a ride while enabled.
 *  Uses native background location in the APK; falls back to browser geolocation on the web. */
export function useLocationPusher({ rideId, enabled }: { rideId?: string; enabled: boolean }) {
  const push = useServerFnPlaceholder<typeof import("@/lib/rides.functions").pushLocation>();
  const lastSent = useRef(0);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !rideId) {
      stopRef.current?.();
      stopRef.current = null;
      return;
    }
    let active = true;

    const send = (lat: number, lng: number, accuracy: number) => {
      const now = Date.now();
      if (now - lastSent.current < 5000) return;
      lastSent.current = now;
      push({ data: { rideId, lat, lng, accuracy, capturedAt: now } }).catch(() => {});
    };

    isNativePlatform().then((native) => {
      if (!active) return;
      if (native) {
        startNativeLocationWatcher((pos) => send(pos.lat, pos.lng, pos.accuracy ?? 0)).then((stop) => {
          if (active) stopRef.current = stop;
        });
      } else if ("geolocation" in navigator) {
        const id = navigator.geolocation.watchPosition(
          (p) => send(p.coords.latitude, p.coords.longitude, p.coords.accuracy ?? 0),
          () => {},
          { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
        );
        stopRef.current = () => navigator.geolocation.clearWatch(id);
      }
    });

    return () => {
      active = false;
      stopRef.current?.();
      stopRef.current = null;
    };
  }, [enabled, rideId, push]);
}

// Inline placeholder so the hook file stays self-contained until rides.functions is imported below.
// This will be removed in the real hook implementation.
function useServerFnPlaceholder<T>() {
  return (() => {
    throw new Error("useServerFn not available in native-bridge");
  }) as unknown as (arg: { data: any }) => Promise<any>;
}
