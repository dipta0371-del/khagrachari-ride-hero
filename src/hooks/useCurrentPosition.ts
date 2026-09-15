import { useEffect, useRef, useState } from "react";

import { isNativePlatform, startNativeLocationWatcher } from "@/integrations/native/native-bridge";

/** Ignore GPS jitter smaller than this (metres) so the UI does not churn. */
const MIN_MOVE_M = 50;

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = (b.lat - a.lat) * 111_320;
  const dLng = (b.lng - a.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function useCurrentPosition() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const lastRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let active = true;

    const update = (lat: number, lng: number) => {
      const next = { lat, lng };
      const prev = lastRef.current;
      if (prev && metres(prev, next) < MIN_MOVE_M) return;
      lastRef.current = next;
      setPos(next);
    };

    isNativePlatform().then((native) => {
      if (!active) return;
      if (native) {
        startNativeLocationWatcher((p) => update(p.lat, p.lng)).then((s) => {
          if (active) stop = s;
        });
      } else if ("geolocation" in navigator) {
        const id = navigator.geolocation.watchPosition(
          (p) => update(p.coords.latitude, p.coords.longitude),
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

