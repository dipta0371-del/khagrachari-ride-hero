import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Navigation, NavigationOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RideMap, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { getRideLocations, pushLocation, stopSharing } from "@/lib/rides.functions";
import type { RideRow } from "@/lib/rides.functions";

export function LiveTracking({ ride, me }: { ride: RideRow; me: string }) {
  const [sharing, setSharing] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastSent = useRef(0);
  const push = useServerFn(pushLocation);
  const stop = useServerFn(stopSharing);
  const fetchLocations = useServerFn(getRideLocations);

  const { data: peers } = useQuery({
    queryKey: ["ride-locations", ride.id],
    queryFn: () => fetchLocations({ data: { rideId: ride.id } }),
    refetchInterval: 3500,
  });

  // Stop sharing whenever the ride ends or the component goes away.
  useEffect(() => {
    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  useEffect(() => {
    if (!sharing) return;
    if (!("geolocation" in navigator)) {
      toast.error("এই ডিভাইসে লোকেশন সাপোর্ট নেই।");
      setSharing(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 5000) return;
        lastSent.current = now;
        void push({
          data: {
            rideId: ride.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy ?? 0,
            capturedAt: Math.min(now, pos.timestamp || now),
          },
        }).catch(() => {});
      },
      () => {
        toast.error("লোকেশন পাওয়া যায়নি — ব্রাউজারে অনুমতি দিন।");
        setSharing(false);
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    watchRef.current = id;
    return () => {
      navigator.geolocation.clearWatch(id);
      watchRef.current = null;
    };
  }, [sharing, ride.id, push]);

  async function toggle() {
    if (sharing) {
      setSharing(false);
      await stop({ data: { rideId: ride.id } }).catch(() => {});
    } else {
      setSharing(true);
    }
  }

  const pins: MapPin[] = [
    { ...ride.pickup, kind: "pickup" },
    { ...ride.dropoff, kind: "dropoff" },
  ];
  if (peers?.rider) pins.push({ lat: peers.rider.lat, lng: peers.rider.lng, kind: "rider" });
  if (peers?.driver) pins.push({ lat: peers.driver.lat, lng: peers.driver.lng, kind: "driver" });

  const other = me === ride.riderId ? peers?.driver : peers?.rider;

  return (
    <div className="space-y-3">
      <RideMap pins={pins} className="h-64 w-full overflow-hidden rounded-xl border sm:h-80" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {other
            ? `${me === ride.riderId ? "চালকের" : "যাত্রীর"} সর্বশেষ অবস্থান ${Math.round((Date.now() - other.capturedAt) / 1000)} সেকেন্ড আগে`
            : "সঙ্গীর লোকেশন এখনও আসেনি — দুজনেই শেয়ার চালু করুন।"}
        </p>
        <Button variant={sharing ? "secondary" : "default"} size="sm" onClick={toggle}>
          {sharing ? (
            <>
              <NavigationOff className="size-4" aria-hidden /> শেয়ার বন্ধ করুন
            </>
          ) : (
            <>
              <Navigation className="size-4" aria-hidden /> আমার অবস্থান শেয়ার করুন
            </>
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        লোকেশন শুধু এই রাইডের সময় শেয়ার হয় এবং রাইড শেষ হলে মুছে যায়। ব্রাউজার ব্যাকগ্রাউন্ডে
        গেলে বা ফোন লক হলে শেয়ার থেমে যেতে পারে।
      </p>
    </div>
  );
}
