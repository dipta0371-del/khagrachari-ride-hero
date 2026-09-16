import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowUpDown,
  Bike,
  Crosshair,
  Loader2,
  MapPin as MapPinIcon,
  MapPinned,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LiveTracking } from "@/components/LiveTracking";
import { PartyCard } from "@/components/PartyCard";
import { PlaceSearch } from "@/components/PlaceSearch";
import { reverseGeocode } from "@/lib/places.functions";
import { PushSetupCard } from "@/components/PushSetupCard";
import { OffersPanel } from "@/components/OffersPanel";
import { SafetyBar } from "@/components/SafetyBar";
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
  cancelReasons,
  distanceKm,
  etaMinutes,
  savedPlaceLabels,
  money,
  places,
  quote,
  statusLabels,
  vehicleLabels,
  type Point,
  type Rates,
  type Vehicle,
} from "@/lib/domain";
import {
  bookRide,
  cancelRide,
  driverAvailability,
  getMyRides,
  listSavedPlaces,
  savePlace,
  type RideRow,
} from "@/lib/rides.functions";

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
  const [reason, setReason] = useState<string>(cancelReasons[0] ?? "");
  const cancelMutation = useMutation({
    mutationFn: () => cancelFn({ data: { rideId: ride.id, reason } }),
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
      <PushSetupCard />
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
            <>
              <PartyCard
                kind="driver"
                name={ride.driverName ?? null}
                rating={ride.driverRating ?? null}
                vehicle={ride.vehicle}
                plate={ride.driverPlate ?? null}
                phone={ride.driverPhone ?? null}
              />
              {ride.pickupCode && ride.status !== "in_progress" && (
                <div className="rounded-xl border border-dashed p-4 text-center">
                  <p className="text-xs text-muted-foreground">পিকআপ কোড</p>
                  <p className="font-display text-3xl font-bold tracking-[0.4em]">
                    {bn(Number(ride.pickupCode)).padStart(4, "০")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    যাত্রা শুরুর আগে এই কোডটি চালককে বলুন। অন্য কাউকে দেবেন না।
                  </p>
                </div>
              )}
              <SafetyBar shareToken={ride.shareToken} />
            </>
          ) : ride.pricingMode === "negotiated" ? (
            <OffersPanel ride={ride} />
          ) : (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              কাছের অনুমোদিত চালকদের কাছে আপনার অনুরোধ পৌঁছেছে। কেউ গ্রহণ করলেই এখানে দেখাবে।
            </p>
          )}

          <LiveTracking ride={ride} me={meId} />

          {ride.status !== "in_progress" && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                aria-label="বাতিলের কারণ"
                className="rounded-md border bg-background px-3 py-2 text-sm sm:flex-1"
              >
                {cancelReasons.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
              >
                <X className="size-4" aria-hidden /> রাইড বাতিল করুন
              </Button>
            </div>
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
  const [activeField, setActiveField] = useState<"pickup" | "dropoff">("dropoff");
  const [pricingMode, setPricingMode] = useState<"fixed" | "negotiated">("fixed");
  const [offeredFare, setOfferedFare] = useState("");
  const [mapMode, setMapMode] = useState(false);
  const [pinPoint, setPinPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [pinName, setPinName] = useState("");
  const [pinLoading, setPinLoading] = useState(false);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number } | null>(null);
  const reverseFn = useServerFn(reverseGeocode);
  const revTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idem = useRef(crypto.randomUUID());

  const placesFn = useServerFn(listSavedPlaces);
  const { data: saved } = useQuery({ queryKey: ["saved-places"], queryFn: () => placesFn() });
  const saveFn = useServerFn(savePlace);
  const savePlaceMutation = useMutation({
    mutationFn: (payload: { label: string; name: string; lat: number; lng: number }) =>
      saveFn({ data: payload }),
    onSuccess: () => {
      toast.success("জায়গাটি সংরক্ষণ হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["saved-places"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availFn = useServerFn(driverAvailability);
  const { data: avail } = useQuery({
    queryKey: ["driver-availability"],
    queryFn: () => availFn(),
    refetchInterval: 15000,
  });



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

  const offerInvalid = (() => {
    if (pricingMode !== "negotiated" || !estimate.q || !offeredFare) return false;
    const n = Number(offeredFare);
    return !Number.isFinite(n) || n < 1;
  })();

  function setPointFor(field: "pickup" | "dropoff", p: Point) {
    if (distanceKm(CENTER, p) > SERVICE_RADIUS_KM) {
      toast.error("এই জায়গা সেবার ১০ কিমি এলাকার বাইরে।");
      return;
    }
    if (field === "pickup") setPickup(p);
    else setDropoff(p);
  }

  function setPoint(p: Point) {
    setPointFor(activeField, p);
  }

  function swapPoints() {
    const p = pickup;
    setPickup(dropoff);
    setDropoff(p);
  }

  function enterMapMode() {
    const current = activeField === "pickup" ? pickup : dropoff;
    const start = current ?? pickup ?? dropoff ?? CENTER;
    setPinPoint({ lat: start.lat, lng: start.lng });
    setPinName(current?.name ?? "");
    setFlyTo({ lat: start.lat, lng: start.lng });
    setMapMode(true);
  }

  function scheduleReverse(lat: number, lng: number) {
    setPinLoading(true);
    if (revTimer.current) clearTimeout(revTimer.current);
    revTimer.current = setTimeout(() => {
      reverseFn({ data: { lat, lng } })
        .then((r) => setPinName(r.name))
        .catch(() => setPinName("মানচিত্রে বেছে নেওয়া জায়গা"))
        .finally(() => setPinLoading(false));
    }, 400);
  }

  function confirmPin() {
    if (!pinPoint) return;
    setPointFor(activeField, {
      name: pinName || "মানচিত্রে বেছে নেওয়া জায়গা",
      lat: pinPoint.lat,
      lng: pinPoint.lng,
    });
    setMapMode(false);
    setPinPoint(null);
    setPinName("");
  }

  function locateOnMap() {
    if (!("geolocation" in navigator)) {
      toast.error("এই ডিভাইসে লোকেশন সাপোর্ট নেই।");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => toast.error("লোকেশন পাওয়া যায়নি — ব্রাউজারে অনুমতি দিন।"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function useMyLocation(field: "pickup" | "dropoff" = activeField) {
    if (!("geolocation" in navigator)) {
      toast.error("এই ডিভাইসে লোকেশন সাপোর্ট নেই।");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setPointFor(field, {
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
      pricingMode,
      ...(pricingMode === "negotiated" && offeredFare
        ? { offeredFare: Number(offeredFare) }
        : {}),
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
            {/* Uber-স্টাইল দুটি সারি: পিকআপ ও গন্তব্য */}
            <div className="relative">
              <div
                className="absolute bottom-10 start-[27px] top-10 w-px bg-border"
                aria-hidden
              />
              <div
                className={`relative flex items-center gap-3 rounded-t-xl border p-2 ps-4 transition-colors ${activeField === "pickup" ? "border-primary bg-secondary/50" : ""}`}
              >
                <span className="size-3 shrink-0 rounded-full bg-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <PlaceSearch
                    label="পিকআপ"
                    presetName={pickup?.name ?? null}
                    onPick={(p) => setPointFor("pickup", p)}
                    onFocusInput={() => setActiveField("pickup")}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setActiveField("pickup");
                    useMyLocation("pickup");
                  }}
                  aria-label="আমার অবস্থান পিকআপ হিসেবে"
                  title="আমার অবস্থান"
                >
                  <Crosshair className="size-4" aria-hidden />
                </Button>
              </div>
              <div
                className={`relative flex items-center gap-3 rounded-b-xl border border-t-0 p-2 ps-4 transition-colors ${activeField === "dropoff" ? "border-primary bg-secondary/50" : ""}`}
              >
                <span className="size-3 shrink-0 rounded-[3px] bg-accent" aria-hidden />
                <div className="min-w-0 flex-1">
                  <PlaceSearch
                    label="কোথায় যাবেন?"
                    autoFocus
                    presetName={dropoff?.name ?? null}
                    onPick={(p) => setPointFor("dropoff", p)}
                    onFocusInput={() => setActiveField("dropoff")}
                  />
                </div>
              </div>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={swapPoints}
                aria-label="পিকআপ ও গন্তব্য উল্টে দিন"
                title="উল্টে দিন"
                className="absolute end-3 top-1/2 z-10 size-8 -translate-y-1/2 rounded-full shadow"
              >
                <ArrowUpDown className="size-4" aria-hidden />
              </Button>
            </div>

            {/* দ্রুত বিকল্প — সক্রিয় ফিল্ডে বসে */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {activeField === "pickup" ? "পিকআপ" : "গন্তব্য"} হিসেবে দ্রুত বেছে নিন:
              </p>
              <div className="flex flex-wrap gap-2">
                {(saved?.places ?? []).map((p) => (
                  <Button
                    key={p.id}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setPoint({ name: p.name, lat: p.lat, lng: p.lng })}
                  >
                    {p.label}: {p.name}
                  </Button>
                ))}
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
                <Button type="button" size="sm" variant="secondary" onClick={enterMapMode}>
                  <MapPinned className="size-4" aria-hidden /> মানচিত্রে বেছে নিন
                </Button>
              </div>
              {(activeField === "pickup" ? pickup : dropoff) && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">এই জায়গাটি সংরক্ষণ করুন:</span>
                  {savedPlaceLabels.map((label) => (
                    <Button
                      key={label}
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const p = activeField === "pickup" ? pickup : dropoff;
                        if (!p) return;
                        savePlaceMutation.mutate({ label, name: p.name, lat: p.lat, lng: p.lng });
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* ম্যাপ — পিন টেনে বা ট্যাপ করে বাছাই */}
            {mapMode ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  ম্যাপ টেনে মাঝের পিনটি {activeField === "pickup" ? "পিকআপ" : "গন্তব্য"} জায়গায় আনুন
                </p>
                <div className="relative h-80 w-full overflow-hidden rounded-xl border">
                  <RideMap
                    showZone
                    pins={pins}
                    follow={false}
                    flyTo={flyTo}
                    onMove={(lat, lng) => {
                      setPinPoint({ lat, lng });
                      scheduleReverse(lat, lng);
                    }}
                    className="h-full w-full"
                  />
                  <div
                    className="pointer-events-none absolute inset-0 z-[500] grid place-items-center"
                    aria-hidden
                  >
                    <MapPinIcon
                      className={`size-10 -translate-y-5 drop-shadow-lg ${activeField === "pickup" ? "text-primary" : "text-accent"}`}
                      fill="currentColor"
                      strokeWidth={1}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 rounded-xl border p-3">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {pinLoading
                      ? "ঠিকানা খোঁজা হচ্ছে…"
                      : pinName || "ম্যাপ টেনে জায়গা ঠিক করুন"}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={locateOnMap}
                  >
                    <Crosshair className="size-4" aria-hidden /> আমার অবস্থান
                  </Button>
                  <Button type="button" size="sm" onClick={confirmPin} disabled={!pinPoint}>
                    এই জায়গা ঠিক করুন
                  </Button>
                </div>
              </div>
            ) : (
              <RideMap
                showZone
                pins={pins}
                follow={false}
                onPick={(lat, lng) => {
                  setPoint({ name: "মানচিত্রে বেছে নেওয়া জায়গা", lat, lng });
                  void reverseFn({ data: { lat, lng } })
                    .then((r) => setPoint({ name: r.name, lat, lng }))
                    .catch(() => {});
                }}
                className="h-56 w-full overflow-hidden rounded-xl border sm:h-64"
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-xl">যাত্রার তথ্য</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">যান বেছে নিন</Label>
              <div className="grid gap-2">
                {(["bike", "tomtom"] as Vehicle[]).map((v) => {
                  let fare: number | null = null;
                  let eta: number | null = null;
                  if (pickup && dropoff) {
                    try {
                      const q = quote(
                        { pickup, dropoff, vehicle: v, passengers: v === "bike" ? 1 : passengers, note },
                        rates,
                      );
                      fare = q.fare;
                      eta = etaMinutes(q.distance, v);
                    } catch {
                      fare = null;
                    }
                  }
                  const selected = vehicle === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        setVehicle(v);
                        if (v === "bike") setPassengers(1);
                      }}
                      aria-pressed={selected}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-start transition-colors ${
                        selected
                          ? "border-primary bg-secondary ring-1 ring-primary"
                          : "hover:bg-secondary/60"
                      }`}
                    >
                      <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-secondary" aria-hidden>
                        {v === "bike" ? (
                          <Bike className="size-6" />
                        ) : (
                          <span className="text-xl font-bold">ট</span>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">{vehicleLabels[v]}</span>
                        <span className="block text-xs text-muted-foreground">
                          {v === "bike" ? "১ জন যাত্রী, দ্রুত" : "২–৪ জন যাত্রী"}
                          {eta !== null && ` · প্রায় ${bn(eta)} মিনিট`}
                        </span>
                      </span>
                      {fare !== null && (
                        <span className="shrink-0 text-lg font-bold">{money(fare)}</span>
                      )}
                    </button>
                  );
                })}
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
            {avail && (
              <p className="rounded-lg bg-secondary p-3 text-sm">
                {avail[vehicle] > 0
                  ? `এখন ${bn(avail[vehicle])} জন ${vehicleLabels[vehicle]} চালক অনলাইনে আছেন।`
                  : `এখন কোনো ${vehicleLabels[vehicle]} চালক অনলাইনে নেই — অনুরোধ পাঠালে কেউ অনলাইনে এলে দেখতে পাবেন।`}
              </p>
            )}
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
                    <span className="font-semibold">প্রস্তাবিত ভাড়া (নগদে)</span>
                    <span className="text-2xl font-bold">{money(estimate.q.fare)}</span>
                  </div>

                  <div className="flex gap-2">
                    {(["fixed", "negotiated"] as const).map((m) => (
                      <Button
                        key={m}
                        type="button"
                        variant={pricingMode === m ? "default" : "outline"}
                        className="flex-1"
                        onClick={() => setPricingMode(m)}
                      >
                        {m === "fixed" ? "নির্ধারিত ভাড়া" : "দরদাম"}
                      </Button>
                    ))}
                  </div>

                  {pricingMode === "negotiated" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="offered">আপনার ভাড়া</Label>
                      <Input
                        id="offered"
                        value={offeredFare}
                        inputMode="numeric"
                        onChange={(e) =>
                          setOfferedFare(e.target.value.replace(/\D/g, "").slice(0, 5))
                        }
                        placeholder={String(estimate.q.fare)}
                      />
                      <p
                        className={
                          offerInvalid
                            ? "text-xs text-destructive"
                            : "text-xs text-muted-foreground"
                        }
                      >
                        আপনার ইচ্ছেমতো যেকোনো ভাড়া দিন। চালকেরা পাল্টা ভাড়া প্রস্তাব করতে পারবেন, আপনি পছন্দেরটি বেছে নেবেন।
                      </p>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground">
                    ভাড়া আনুমানিক — রাস্তার প্রকৃত দূরত্বের ভিত্তিতে সামান্য ভিন্ন হতে পারে।
                  </p>
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={confirm}
                    disabled={booking.isPending || offerInvalid}
                  >
                    {booking.isPending
                      ? "পাঠানো হচ্ছে…"
                      : `${money(pricingMode === "negotiated" && offeredFare ? Number(offeredFare) : estimate.q.fare)} — রাইড নিশ্চিত করুন`}
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
