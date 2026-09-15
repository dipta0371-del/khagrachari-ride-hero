import { useEffect, useState } from "react";

import { isNativePlatform, startNativeLocationWatcher } from "@/integrations/native/native-bridge";

export function useCurrentPosition() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let active = true;

    isNativePlatform().then((native) => {
      if (!active) return;
      if (native) {
        startNativeLocationWatcher((p) => setPos({ lat: p.lat, lng: p.lng })).then((s) => {
          if (active) stop = s;
        });
      } else if ("geolocation" in navigator) {
        const id = navigator.geolocation.watchPosition(
          (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => {},
          { enableHighAccuracy: true, maximumAge: 15000 },
        );
        stop = () => navigator.geolocation.clearWatch(id);
      }
    });

    return () => {
      active = false;
      stop?.();
    };
  }, []);

  return pos;
}
