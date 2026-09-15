import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Crosshair, Loader2, MapPinned, Phone, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LiveTracking } from "@/components/LiveTracking";
import { RideMap, type MapPin as Pin } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/hooks/useMe";
import {
  CENTER,
  DEFAULT_RATES,
  SERVICE_RADIUS_KM,
  activeStatuses,
  bn,
  distanceKm,
  money,
  places,
  quote,
  statusLabels,
  vehicleLabels,
  type Point,
  type Rates,
  type Vehicle,
} from "@/lib/domain";
import { bookRide, cancelRide, getMyRides, type RideRow } from "@/lib/rides.functions";

export const Route = createFileRoute("/_authenticated/book")({
  head: () => ({
    meta: [
      { title: "রাইড বুক করুন — CHT GARI" },
      { name: "description", content: "খাগড়াছড়িতে বাইক বা টমটম রাইড বুক করুন এবং লাইভ দেখুন।" },
      { property: "og:title", content: "রাইড বুক করুন — CHT GARI" },
      { property: "og:description", content: "ভাড়া আগে দেখে নিন, তারপর রাইড নিশ্চিত করুন।" },
    ],
  }),
  component: BookPage,
});

function BookPage() {
  const { data: me } = useMe();
  const listFn = useServerFn(getMyRides);
  const { data, isLoading } = useQuery({
    queryKey: ["my-rides"],
    queryFn: () => listFn(),
    refetchInterval: 3500,
  });

  const active = (data?.rides ?? []).find((r) => activeStatuses.includes(r.status));

  return (
    <AppShell>
      {isLoading && !data ? (
        <div className="grid h-64 place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      ) : active ? (
        <ActiveRide ride={active} meId={me?.userId ?? ""} />
      ) : (
        <BookingForm rates={me?.rates ?? DEFAULT_RATES} />
      )}
    </AppShell>
  );
}

/* ---------------- active ride ---------------- */

function ActiveRide({ ride, meId }: { ride: RideRow; meId: string }) {
  const queryClient = useQueryClient();
  const cancelFn = useServerFn(cancelRide);
  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { rideId: ride.id } }),
    onSuccess: () => {
      toast.success("রাইড বাতিল হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["my-rides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const steps = ["requested", "accepted", "arrived", "in_progress"] as const;
  const current = steps.indexOf(ride.status as (typeof steps)[number]);

  return (
    <div className="space-y-5">
      <Card className="shadow-ridge">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-display text-xl">{statusLabels[ride.status]}</CardTitle>
            <Badge variant="secondary">{vehicleLabels[ride.vehicle]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <ol className="flex items-center gap-1" aria-label="রাইডের ধাপ">
            {steps.map((s, i) => (
              <li key={s} className="flex-1">
                <span
                  className={`block h-1.5 rounded-full ${i <= current ? "bg-primary" : "bg-muted"}`}
                />
                <span
                  className={`mt-1.5 block text-[11px] ${i <= current ? "text-foreground" : "text-muted-foreground"}`}
                >
                  {statusLabels[s]}
                </span>
              </li>
            ))}
          </ol>

          <div className="grid gap-3 sm:grid-cols-2">
            <Leg label="পিকআপ" value={ride.pickup.name} tone="primary" />
            <Leg label="গন্তব্য" value={ride.dropoff.name} tone="accent" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary p-4">
            <div>
              <p className="text-xs text-muted-foreground">ভাড়া (নগদে)</p>
              <p className="text-2xl font-bold">{money(ride.fare)}</p>
            </div>
            <p className="text-sm text-muted-foreground">আনুমানিক {bn(ride.distance)} কিমি</p>
          </div>

          {ride.driverId ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <p className="font-semibold">{ride.driverName || "চালক"}</p>
                <p className="text-sm text-muted-foreground">
                  {vehicleLabels[ride.vehicle]} · {ride.driverPlate || "নম্বর নেই"}
                </p>
              </div>
              {ride.driverPhone ? (
                <Button asChild variant="outline">
                  <a href={`tel:${ride.driverPhone}`}>
                    <Phone className="size-4" aria-hidden /> কল করুন
                  </a>
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">চালকের নম্বর যোগ করা নেই</span>
              )}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              কাছের অনুমোদিত চালকদের কাছে আপনার অনুরোধ পৌঁছেছে। কেউ গ্রহণ করলেই এখানে দেখাবে।
            </p>
          )}

          <LiveTracking ride={ride} me={meId} />

          {ride.status !== "in_progress" && (
            <Button
              variant="outline"
              className="w-full text-destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <X className="size-4" aria-hidden /> রাইড বাতিল করুন
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Leg({ label, value, tone }: { label: string; value: string; tone: "primary" | "accent" }) {
  return (
    <div className="flex gap-3 rounded-xl border p-3">
      <span
        className={`mt-1 size-3 shrink-0 rounded-full ${tone === "primary" ? "bg-primary" : "bg-accent"}`}
      />
      <span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className="block font-medium">{value}</span>
      </span>
    </div>
  );
}

/* ---------------- booking form ---------------- */

function BookingForm({ rates }: { rates: Rates }) {
  const queryClient = useQueryClient();
  const [pickup, setPickup] = useState<Point | null>(places[0] ?? null);
  const [dropoff, setDropoff] = useState<Point | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle>("bike");
  const [passengers, setPassengers] = useState(1);
  const [note, setNote] = useState("");
  const [target, setTarget] = useState<"pickup" | "dropoff">("dropoff");
  const idem = useRef(crypto.randomUUID());

  const bookFn = useServerFn(bookRide);
  const booking = useMutation({
    mutationFn: (payload: any) => bookFn({ data: payload }),
    onSuccess: () => {
      idem.current = crypto.randomUUID();
      toast.success("রাইডের অনুরোধ পাঠানো হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["my-rides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const estimate = useMemo(() => {
    if (!pickup || !dropoff) return { q: null, error: null as string | null };
    try {
      return { q: quote({ pickup, dropoff, vehicle, passengers, note }, rates), error: null };
    } catch (e) {
      return { q: null, error: (e as Error).message };
    }
  }, [pickup, dropoff, vehicle, passengers, note, rates]);

  function setPoint(p: Point) {
    if (distanceKm(CENTER, p) > SERVICE_RADIUS_KM) {
      toast.error("এই জায়গা সেবার ১০ কিমি এলাকার বাইরে।");
      return;
    }
    if (target === "pickup") setPickup(p);
    else setDropoff(p);
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      toast.error("এই ডিভাইসে লোকেশন সাপোর্ট নেই।");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPoint({
          name: "আমার বর্তমান অবস্থান",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => toast.error("লোকেশন পাওয়া যায়নি — ব্রাউজারে অনুমতি দিন।"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  const pins: Pin[] = [];
  if (pickup) pins.push({ ...pickup, kind: "pickup" });
  if (dropoff) pins.push({ ...dropoff, kind: "dropoff" });

  function confirm() {
    if (!pickup || !dropoff || !estimate.q) return;
    booking.mutate({
      pickup,
      dropoff,
      vehicle,
      passengers,
      note,
      idempotencyKey: idem.current,
      expectedFare: estimate.q.fare,
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">কোথায় যাবেন?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setTarget("pickup")}
                className={`rounded-xl border p-3 text-start transition-colors ${target === "pickup" ? "border-primary bg-secondary" : "hover:bg-secondary/60"}`}
              >
                <span className="block text-xs text-muted-foreground">পিকআপ</span>
                <span className="block font-medium">{pickup?.name ?? "বেছে নিন"}</span>
              </button>
              <button
                type="button"
                onClick={() => setTarget("dropoff")}
                className={`rounded-xl border p-3 text-start transition-colors ${target === "dropoff" ? "border-primary bg-secondary" : "hover:bg-secondary/60"}`}
              >
                <span className="block text-xs text-muted-foreground">গন্তব্য</span>
                <span className="block font-medium">{dropoff?.name ?? "বেছে নিন"}</span>
              </button>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                <MapPinned className="mr-1 inline size-4" aria-hidden />
                {target === "pickup" ? "পিকআপ" : "গন্তব্য"} হিসেবে বেছে নিন
              </p>
              <div className="flex flex-wrap gap-2">
                {places.map((p) => (
                  <Button
                    key={p.name}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPoint(p)}
                  >
                    {p.name}
                  </Button>
                ))}
                <Button type="button" size="sm" variant="secondary" onClick={useMyLocation}>
                  <Crosshair className="size-4" aria-hidden /> আমার অবস্থান
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                অথবা মানচিত্রে ট্যাপ করে {target === "pickup" ? "পিকআপ" : "গন্তব্য"} ঠিক করুন
              </p>
              <RideMap
                showZone
                pins={pins}
                follow={false}
                onPick={(lat, lng) =>
                  setPoint({
                    name: target === "pickup" ? "মানচিত্রে বাছাই (পিকআপ)" : "মানচিত্রে বাছাই (গন্তব্য)",
                    lat,
                    lng,
                  })
                }
                className="h-64 w-full overflow-hidden rounded-xl border sm:h-80"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">যাত্রার তথ্য</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">যান</Label>
              <div className="flex gap-2">
                {(["bike", "tomtom"] as Vehicle[]).map((v) => (
                  <Button
                    key={v}
                    type="button"
                    variant={vehicle === v ? "default" : "outline"}
                    className="flex-1"
                    onClick={() => {
                      setVehicle(v);
                      if (v === "bike") setPassengers(1);
                    }}
                  >
                    {vehicleLabels[v]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">যাত্রী সংখ্যা</Label>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <Button
                    key={n}
                    type="button"
                    variant={passengers === n ? "default" : "outline"}
                    disabled={vehicle === "bike" && n !== 1}
                    className="flex-1"
                    onClick={() => setPassengers(n)}
                  >
                    {bn(n)}
                  </Button>
                ))}
              </div>
              {vehicle === "bike" && (
                <p className="mt-1.5 text-xs text-muted-foreground">বাইকে সর্বোচ্চ ১ জন যাত্রী।</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note">চালকের জন্য নোট (ঐচ্ছিক)</Label>
              <Textarea
                id="note"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="যেমন: গেটের সামনে দাঁড়াবো"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="lg:sticky lg:top-24 lg:h-fit">
        <Card className="shadow-ridge">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">ভাড়ার হিসাব</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!pickup || !dropoff ? (
              <p className="text-sm text-muted-foreground">
                পিকআপ ও গন্তব্য দুটোই বেছে নিলে পুরো ভাড়ার হিসাব এখানে দেখাবে।
              </p>
            ) : estimate.error ? (
              <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {estimate.error}
              </p>
            ) : (
              estimate.q && (
                <>
                  <Row label="সরাসরি দূরত্ব" value={`${bn(estimate.q.directKm)} কিমি`} />
                  <Row
                    label="রাস্তার আনুমানিক দূরত্ব"
                    value={`${bn(estimate.q.distance)} কিমি`}
                  />
                  <Row label="বেস ভাড়া" value={money(estimate.q.base)} />
                  <Row
                    label={`প্রতি কিমি ${money(estimate.q.perKm)}`}
                    value={money(estimate.q.metered - estimate.q.base)}
                  />
                  {estimate.q.minimumApplied && (
                    <Row label="সর্বনিম্ন ভাড়া প্রযোজ্য" value={money(estimate.q.minimum)} />
                  )}
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="font-semibold">মোট (নগদে)</span>
                    <span className="text-2xl font-bold">{money(estimate.q.fare)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ভাড়া আনুমানিক — রাস্তার প্রকৃত দূরত্বের ভিত্তিতে সামান্য ভিন্ন হতে পারে।
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={confirm}
                    disabled={booking.isPending}
                  >
                    {booking.isPending ? "পাঠানো হচ্ছে…" : `${money(estimate.q.fare)} — রাইড নিশ্চিত করুন`}
                  </Button>
                </>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
