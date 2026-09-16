import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star, TrendingUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { LiveTracking } from "@/components/LiveTracking";
import { PartyCard } from "@/components/PartyCard";
import { PushSetupCard } from "@/components/PushSetupCard";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useCurrentPosition } from "@/hooks/useCurrentPosition";
import { useMe } from "@/hooks/useMe";
import { Input } from "@/components/ui/input";
import {
  bn,
  cancelReasons,
  driverActionLabels,
  money,
  

  statusLabels,
  timeBn,
  vehicleLabels,
  type RideStatus,
  type Vehicle,
} from "@/lib/domain";
import {
  acceptRide,
  advanceRide,
  cancelRide,
  getDriverBoard,
  makeOffer,
  setDriverOnline,
  type RideRow,
} from "@/lib/rides.functions";

export const Route = createFileRoute("/_authenticated/driver")({
  head: () => ({
    meta: [
      { title: "চালক প্যানেল — CHT GARI" },
      { name: "description", content: "রাইডের অনুরোধ দেখুন, গ্রহণ করুন এবং আয়ের হিসাব রাখুন।" },
      { property: "og:title", content: "চালক প্যানেল — CHT GARI" },
      { property: "og:description", content: "কাছের রাইড আগে দেখুন এবং আয়ের হিসাব রাখুন।" },
    ],
  }),
  component: DriverPage,
});

function DriverPage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [declined, setDeclined] = useState<string[]>([]);
  const [otp, setOtp] = useState("");
  const [cancelReason, setCancelReason] = useState<string>(cancelReasons[0] ?? "");
  const pos = useCurrentPosition();

  // Keep the position out of the query key: GPS jitter must not reset the board.
  const posRef = useRef(pos);
  posRef.current = pos;

  const boardFn = useServerFn(getDriverBoard);
  const { data, isLoading } = useQuery({
    queryKey: ["driver-board"],
    queryFn: () => {
      const p = posRef.current;
      return boardFn({ data: p ? { lat: p.lat, lng: p.lng } : {} });
    },
    refetchInterval: 3500,
    placeholderData: keepPreviousData,
  });
  // Beep + toast when a new request shows up while the panel is open.
  const seenRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);
  useEffect(() => {
    const queue = data?.queue ?? [];
    if (firstLoadRef.current) {
      if (!data) return;
      queue.forEach((r) => seenRef.current.add(r.id));
      firstLoadRef.current = false;
      return;
    }
    const fresh = queue.filter((r) => !seenRef.current.has(r.id));
    queue.forEach((r) => seenRef.current.add(r.id));
    if (!fresh.length) return;
    toast.info(`নতুন রাইড অনুরোধ · ${fresh[0]!.pickup.name}`);
    try {
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      setTimeout(() => void ctx.close(), 600);
    } catch {
      /* audio blocked until the driver interacts with the page */
    }
  }, [data]);


  const refresh = () => queryClient.invalidateQueries({ queryKey: ["driver-board"] });
  const onlineFn = useServerFn(setDriverOnline);
  const acceptFn = useServerFn(acceptRide);
  const advanceFn = useServerFn(advanceRide);
  const cancelFn = useServerFn(cancelRide);

  const toggleOnline = useMutation({
    mutationFn: (online: boolean) => onlineFn({ data: { online } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const accept = useMutation({
    mutationFn: (rideId: string) => acceptFn({ data: { rideId } }),
    onSuccess: () => {
      toast.success("রাইড গ্রহণ করা হয়েছে");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const advance = useMutation({
    mutationFn: (rideId: string) => advanceFn({ data: { rideId, pickupCode: otp.trim() } }),
    onSuccess: () => refresh(),
    onError: (e: Error) => toast.error(e.message),
  });
  const drop = useMutation({
    mutationFn: (rideId: string) => cancelFn({ data: { rideId, reason: cancelReason } }),
    onSuccess: () => {
      toast.success("রাইড বাতিল হয়েছে");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading && !data) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      </AppShell>
    );
  }

  if (!data?.driver) {
    return (
      <AppShell>
        <Card className="mx-auto max-w-lg">
          <CardHeader>
            <CardTitle>চালক হিসেবে নিবন্ধন করুন</CardTitle>
            <CardDescription>
              প্রোফাইল পাতায় গিয়ে আপনার যান ও গাড়ির নম্বর দিন। অ্যাডমিন অনুমোদন দিলেই রাইড নিতে
              পারবেন।
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link to="/profile">প্রোফাইলে যান</Link>
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const { driver, queue, active, earnings } = data;

  return (
    <AppShell>
      <div className="space-y-5">
        <Card className="shadow-ridge">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
            <div>
              <p className="font-display text-xl font-bold">
                {vehicleLabels[driver.vehicle as Vehicle]} · {driver.plate || "নম্বর নেই"}
              </p>
              <p className="text-sm text-muted-foreground">
                {driver.approved ? "অনুমোদিত চালক" : "অ্যাডমিন অনুমোদনের অপেক্ষায়"}
              </p>
            </div>
            <label className="flex items-center gap-3">
              <span className="text-sm font-medium">{driver.online ? "অনলাইন" : "অফলাইন"}</span>
              <Switch
                checked={driver.online}
                disabled={!driver.approved || toggleOnline.isPending}
                onCheckedChange={(v) => toggleOnline.mutate(v)}
                aria-label="অনলাইন/অফলাইন"
              />
            </label>
          </CardContent>
        </Card>

        {driver.approved && <PushSetupCard />}



        {earnings && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="আজকের আয়" value={money(earnings.todayTotal)} sub={`${bn(earnings.todayCount)} রাইড`} />
            <Stat label="৭ দিনের আয়" value={money(earnings.weekTotal)} sub={`${bn(earnings.weekCount)} রাইড`} />
            <Stat label="মোট আয়" value={money(earnings.allTotal)} sub={`${bn(earnings.allCount)} রাইড`} />
            <Stat
              label="রেটিং"
              value={earnings.rating ? `${bn(earnings.rating)} ★` : "—"}
              sub={earnings.ratingCount ? `${bn(earnings.ratingCount)} জন` : "এখনও নেই"}
            />
          </div>
        )}

        {active ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-display text-xl">চলমান রাইড</CardTitle>
                <Badge>{statusLabels[active.status]}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="পিকআপ" value={active.pickup.name} />
                <Field label="গন্তব্য" value={active.dropoff.name} />
                <Field label="ভাড়া (নগদ)" value={money(active.fare)} />
                <Field label="যাত্রী সংখ্যা" value={`${bn(active.passengers)} জন`} />
              </div>
              <PartyCard
                kind="rider"
                name={active.riderName ?? null}
                rating={active.riderRating ?? null}
                phone={active.riderPhone ?? null}
              />
              {active.note && (
                <p className="rounded-lg bg-secondary p-3 text-sm">নোট: {active.note}</p>
              )}

              <LiveTracking ride={active} me={me?.userId ?? ""} />

              {active.status === "arrived" && (
                <div className="space-y-2 rounded-xl border border-dashed p-4">
                  <p className="text-sm font-medium">যাত্রীর পিকআপ কোড দিন</p>
                  <p className="text-xs text-muted-foreground">
                    যাত্রীর স্ক্রিনে থাকা ৪ সংখ্যার কোড মিলিয়ে যাত্রা শুরু করুন।
                  </p>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric"
                    placeholder="০০০০"
                    aria-label="পিকআপ কোড"
                    className="max-w-32 text-center text-lg tracking-widest"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => advance.mutate(active.id)}
                  disabled={advance.isPending || (active.status === "arrived" && otp.length !== 4)}
                >
                  {driverActionLabels[active.status as RideStatus] ?? "পরবর্তী ধাপ"}
                </Button>
                {active.status !== "in_progress" && (
                  <div className="flex gap-2">
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      aria-label="বাতিলের কারণ"
                      className="rounded-md border bg-background px-3 py-2 text-sm"
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
                      onClick={() => drop.mutate(active.id)}
                      disabled={drop.isPending}
                    >
                      বাতিল
                    </Button>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-xl">
                নতুন অনুরোধ {queue.length > 0 && `(${bn(queue.length)})`}
              </CardTitle>
              <CardDescription>
                {pos
                  ? "আপনার সবচেয়ে কাছের পিকআপ আগে দেখানো হচ্ছে।"
                  : "লোকেশন অনুমতি দিলে কাছের রাইড আগে দেখানো হবে।"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!driver.approved ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  অ্যাডমিন অনুমোদন দিলেই এখানে রাইডের অনুরোধ দেখতে পাবেন।
                </p>
              ) : queue.filter((r) => !declined.includes(r.id)).length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  এখন কোনো অনুরোধ নেই। অনলাইন থাকুন — নতুন অনুরোধ এলেই এখানে দেখাবে।
                </p>
              ) : (
                queue
                  .filter((r) => !declined.includes(r.id))
                  .map((r) => (
                    <QueueItem
                      key={r.id}
                      ride={r}
                      online={driver.online}
                      onAccept={() => accept.mutate(r.id)}
                      onDecline={() => setDeclined((d) => [...d, r.id])}
                      onRefresh={refresh}
                      busy={accept.isPending}
                    />
                  ))
              )}

            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label === "রেটিং" ? (
          <Star className="size-3.5" aria-hidden />
        ) : (
          <TrendingUp className="size-3.5" aria-hidden />
        )}
        {label}
      </p>
      <p className="mt-1 text-xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

/** One open request: accept at the rider's fare, propose your own, or skip. */
function QueueItem({
  ride,
  online,
  busy,
  onAccept,
  onDecline,
  onRefresh,
}: {
  ride: RideRow & { myOffer?: { amount: number; status: string } | null };
  online: boolean;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onRefresh: () => void;
}) {
  
  const [amount, setAmount] = useState(String(ride.myOffer?.amount ?? ride.fare));
  const offerFn = useServerFn(makeOffer);
  const offer = useMutation({
    mutationFn: () => offerFn({ data: { rideId: ride.id, amount: Number(amount) } }),
    onSuccess: () => {
      toast.success("আপনার প্রস্তাব যাত্রীর কাছে পাঠানো হয়েছে");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const away = (ride as RideRow & { pickupAwayKm?: number }).pickupAwayKm;

  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{ride.pickup.name}</p>
          <p className="text-sm text-muted-foreground">→ {ride.dropoff.name}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {bn(ride.distance)} কিমি · {bn(ride.passengers)} জন · {timeBn(ride.createdAt)}
            {away !== undefined && ` · আপনার থেকে ${bn(away)} কিমি`}
          </p>
        </div>
        <div className="text-end">
          <p className="text-xl font-bold">{money(ride.fare)}</p>
          {ride.pricingMode === "negotiated" && (
            <Badge variant="secondary" className="mt-1">
              যাত্রীর প্রস্তাব
            </Badge>
          )}
        </div>
      </div>
      {ride.note && <p className="mt-2 text-sm text-muted-foreground">নোট: {ride.note}</p>}

      {ride.myOffer && (
        <p className="mt-2 text-sm text-primary">
          আপনি {money(ride.myOffer.amount)} প্রস্তাব করেছেন — যাত্রীর উত্তরের অপেক্ষায়।
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2">
        <Button onClick={onAccept} disabled={busy || !online}>
          {online ? `${money(ride.fare)} — রাইড গ্রহণ করুন` : "আগে অনলাইন হোন"}
        </Button>
        {ride.pricingMode === "negotiated" && online && (
          <div className="flex gap-2">
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/\D/g, "").slice(0, 5))}
              inputMode="numeric"
              aria-label="আপনার প্রস্তাবিত ভাড়া"
              placeholder="আপনার ভাড়া"
            />
            <Button
              variant="secondary"
              onClick={() => offer.mutate()}
              disabled={offer.isPending || !amount}
            >
              ভাড়া প্রস্তাব
            </Button>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={onDecline}>
          আগ্রহী নই
        </Button>
      </div>
    </div>
  );
}
