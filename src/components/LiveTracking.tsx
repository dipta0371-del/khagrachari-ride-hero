import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Navigation, NavigationOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { RideMap, type MapPin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { useLocationPusher } from "@/hooks/useLocationPusher";
import { scheduleLocalNotification } from "@/integrations/native/native-bridge";
import { bn, distanceKm, etaMinutes, statusLabels } from "@/lib/domain";
import { getRideLocations, stopSharing } from "@/lib/rides.functions";
import type { RideRow } from "@/lib/rides.functions";

/** Statuses where each side should be broadcasting its position, Uber-style. */
function shouldShare(ride: RideRow, isDriver: boolean) {
  if (isDriver) return ["accepted", "arrived", "in_progress"].includes(ride.status);
  return ["accepted", "arrived"].includes(ride.status);
}

export function LiveTracking({ ride, me }: { ride: RideRow; me: string }) {
  const isDriver = me === ride.driverId;
  const autoShare = shouldShare(ride, isDriver);
  const [muted, setMuted] = useState(false);
  const [denied, setDenied] = useState(false);
  const sharing = autoShare && !muted && !denied;

  const lastSent = useRef(0);
  const push = useServerFn(pushLocation);
  const stop = useServerFn(stopSharing);
  const fetchLocations = useServerFn(getRideLocations);

  const { data: peers } = useQuery({
    queryKey: ["ride-locations", ride.id],
    queryFn: () => fetchLocations({ data: { rideId: ride.id } }),
    refetchInterval: 3500,
  });

  // Re-render every second so the "x সেকেন্ড আগে" label stays honest.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!sharing) return;
    if (!("geolocation" in navigator)) {
      setDenied(true);
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
        setDenied(true);
        toast.error("লোকেশন পাওয়া যায়নি — ব্রাউজারে অনুমতি দিন।");
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharing, ride.id, push]);

  async function toggle() {
    if (sharing) {
      setMuted(true);
      await stop({ data: { rideId: ride.id } }).catch(() => {});
    } else {
      setMuted(false);
      setDenied(false);
    }
  }

  const pins: MapPin[] = [
    { ...ride.pickup, kind: "pickup" },
    { ...ride.dropoff, kind: "dropoff" },
  ];
  if (peers?.rider) pins.push({ lat: peers.rider.lat, lng: peers.rider.lng, kind: "rider" });
  if (peers?.driver) pins.push({ lat: peers.driver.lat, lng: peers.driver.lng, kind: "driver" });

  const other = isDriver ? peers?.rider : peers?.driver;
  const otherLabel = isDriver ? "যাত্রীর" : "চালকের";
  const age = other ? Math.max(0, Math.round((Date.now() - other.capturedAt) / 1000)) : null;
  const live = age !== null && age <= 20;

  // Driver → pickup before the trip starts, driver → destination during the trip.
  const target = ride.status === "in_progress" ? ride.dropoff : ride.pickup;
  const targetLabel = ride.status === "in_progress" ? "গন্তব্যে" : "পিকআপে";
  const driverPos = peers?.driver;
  const gapKm = driverPos ? distanceKm(driverPos, target) : null;
  const eta = gapKm !== null ? etaMinutes(gapKm, ride.vehicle) : null;

  return (
    <div className="space-y-3">
      <RideMap pins={pins} className="h-64 w-full overflow-hidden rounded-xl border sm:h-80" />

      {eta !== null && gapKm !== null && (
        <div className="flex items-center justify-between rounded-xl border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">
            {ride.status === "in_progress" ? "গন্তব্যে পৌঁছাতে" : "চালক পৌঁছাবেন"} প্রায় {bn(eta)}{" "}
            মিনিটে
          </span>
          <span className="text-xs text-muted-foreground">
            {targetLabel} আর {bn(Math.max(0.1, Math.round(gapKm * 10) / 10))} কিমি
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          {other ? (
            <>
              <span
                className={`inline-block size-2 rounded-full ${live ? "animate-pulse bg-primary" : "bg-muted-foreground"}`}
                aria-hidden
              />
              {live
                ? `${otherLabel} অবস্থান লাইভ`
                : `${otherLabel} সর্বশেষ অবস্থান ${bn(age ?? 0)} সেকেন্ড আগে`}
            </>
          ) : (
            `${otherLabel} লোকেশন এখনও আসেনি।`
          )}
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

      {denied && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          লোকেশন বন্ধ আছে। ব্রাউজারের ঠিকানা বারের পাশে থাকা আইকনে ট্যাপ করে এই সাইটকে লোকেশন
          অনুমতি দিন, তারপর আবার শেয়ার চালু করুন।
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        রাইড চলাকালীন আপনার অবস্থান আপনাআপনি শেয়ার হয় এবং রাইড শেষ হলে মুছে যায়। ব্রাউজার
        ব্যাকগ্রাউন্ডে গেলে বা ফোন লক হলে শেয়ার থেমে যেতে পারে।
      </p>
    </div>
  );
}
