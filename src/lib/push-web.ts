// Firebase web push config. These are public client identifiers (safe to ship).
const projectId =
  (import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID"] as
    | string
    | undefined) ?? "cht-gari";
const appId =
  (import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID"] as string | undefined) ??
  "1:340064546983:web:629320892eaddc73e86b82";
const vapidKey =
  (import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY"] as string | undefined) ??
  "BEJWB7HcgS3s7-PNDrZHFfOE3J9P0fZ5fGRUCnJB9dy6JALWmV5xLy7yYJAgRxz8nkEj280vo_D5iuYsWUc8PcM";
const apiKey =
  (import.meta.env["VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY"] as
    | string
    | undefined) ?? "AIzaSyCg1Eyfpl52jp018RJzfP69KAhz13Xp6y8";

const messagingSenderId = appId.split(":")[1] ?? "";

export type WebPushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "error";

export type WebPushResult = { status: WebPushStatus; token?: string };

export function webPushConfigured(): boolean {
  return Boolean(apiKey && projectId && appId && vapidKey && messagingSenderId);
}

export function webPushGranted(): boolean {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission === "granted"
    : false;
}

export function inEmbeddedFrame(): boolean {
  return typeof window !== "undefined" && window.top !== window.self;
}

/** Must be called from a click handler. */
export async function enableWebPush(): Promise<WebPushResult> {
  if (!webPushConfigured()) return { status: "not-configured" };
  if (typeof window === "undefined" || !("Notification" in window)) {
    return { status: "unsupported" };
  }

  try {
    const { isSupported, getMessaging, getToken } = await import("firebase/messaging");
    if (!(await isSupported())) return { status: "unsupported" };
    if (inEmbeddedFrame()) return { status: "open-in-new-tab" };

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
    if (permission !== "granted") return { status: "denied" };

    const config = { apiKey: apiKey!, projectId: projectId!, appId: appId!, messagingSenderId };
    const query = new URLSearchParams(config).toString();
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${query}`,
    );

    const { initializeApp, getApps } = await import("firebase/app");
    const app = getApps()[0] ?? initializeApp(config);
    const token = await getToken(getMessaging(app), {
      vapidKey: vapidKey!,
      serviceWorkerRegistration,
    });
    return token ? { status: "registered", token } : { status: "denied" };
  } catch (e) {
    console.error("[push] web registration failed", e);
    return { status: "error" };
  }
}
