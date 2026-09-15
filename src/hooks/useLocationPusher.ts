import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { isNativePlatform, startNativeLocationWatcher } from "@/integrations/native/native-bridge";
import { pushLocation } from "@/lib/rides.functions";

export function useLocationPusher({ rideId, enabled }: { rideId?: string; enabled: boolean }) {
  const push = useServerFn(pushLocation);
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
      void push({ data: { rideId, lat, lng, accuracy, capturedAt: now } }).catch(() => {});
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
