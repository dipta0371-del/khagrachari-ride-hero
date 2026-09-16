import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Flag, Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { bn, money, reportCategories, statusLabels, timeBn, vehicleLabels } from "@/lib/domain";
import { getMyRides, rateRide, reportRide, type RideRow } from "@/lib/rides.functions";

export const Route = createFileRoute("/_authenticated/rides")({
  head: () => ({
    meta: [
      { title: "আমার রাইড — CHT GARI" },
      { name: "description", content: "আগের রাইডের তালিকা, ভাড়া ও রেটিং দেওয়ার সুযোগ।" },
      { property: "og:title", content: "আমার রাইড — CHT GARI" },
      { property: "og:description", content: "আপনার রাইডের ইতিহাস এক জায়গায়।" },
    ],
  }),
  component: RidesPage,
});

function RidesPage() {
  const listFn = useServerFn(getMyRides);
  const { data, isLoading } = useQuery({
    queryKey: ["my-rides"],
    queryFn: () => listFn(),
  });

  const rated = new Set(data?.ratedRideIds ?? []);
  const rides = data?.rides ?? [];
  const completed = rides.filter((r) => r.status === "completed");
  const spent = completed.reduce((t, r) => t + r.fare, 0);

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">আমার রাইড</h1>

        <div className="grid grid-cols-3 gap-3">
          <Box label="মোট রাইড" value={bn(rides.length)} />
          <Box label="সম্পন্ন" value={bn(completed.length)} />
          <Box label="মোট খরচ" value={money(spent)} />
        </div>

        {isLoading && !data ? (
          <div className="grid h-40 place-items-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </div>
        ) : rides.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            এখনও কোনো রাইড নেই।
          </p>
        ) : (
          <div className="space-y-3">
            {rides.map((r) => (
              <RideCard key={r.id} ride={r} rated={rated.has(r.id)} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function RideCard({ ride, rated }: { ride: RideRow; rated: boolean }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const rateFn = useServerFn(rateRide);

  const submit = useMutation({
    mutationFn: () => rateFn({ data: { rideId: ride.id, score, comment } }),
    onSuccess: () => {
      toast.success("রেটিংয়ের জন্য ধন্যবাদ");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["my-rides"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            {ride.pickup.name} → {ride.dropoff.name}
          </CardTitle>
          <Badge variant={ride.status === "cancelled" ? "outline" : "secondary"}>
            {statusLabels[ride.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>{timeBn(ride.createdAt)}</span>
          <span>{vehicleLabels[ride.vehicle]}</span>
          <span>{bn(ride.distance)} কিমি</span>
          <span className="font-semibold text-foreground">{money(ride.fare)}</span>
        </div>
        {ride.driverId && (
          <p className="text-sm text-muted-foreground">
            চালক: {ride.driverName?.trim() || vehicleLabels[ride.vehicle]}
            {ride.driverPlate ? ` · ${ride.driverPlate}` : ""}
          </p>
        )}
        {ride.cancelReason && (
          <p className="text-sm text-muted-foreground">বাতিলের কারণ: {ride.cancelReason}</p>
        )}

        {ride.status === "completed" && <Receipt ride={ride} />}
        {(ride.status === "completed" || ride.status === "cancelled") && <ReportBox ride={ride} />}


        {ride.status === "completed" &&
          ride.driverId &&
          (rated ? (
            <p className="text-sm text-muted-foreground">রেটিং দেওয়া হয়েছে ✓</p>
          ) : open ? (
            <div className="space-y-3 rounded-xl border p-3">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setScore(n)}
                    aria-label={`${bn(n)} তারকা`}
                    className="p-1"
                  >
                    <Star
                      className={`size-6 ${n <= score ? "fill-accent text-accent" : "text-muted-foreground"}`}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={comment}
                maxLength={300}
                onChange={(e) => setComment(e.target.value)}
                placeholder="কিছু বলতে চান? (ঐচ্ছিক)"
              />
              <div className="flex gap-2">
                <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                  জমা দিন
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  বাতিল
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Star className="size-4" aria-hidden /> চালককে রেটিং দিন
            </Button>
          ))}
      </CardContent>
    </Card>
  );
}

/** Fare breakdown receipt for a finished ride. */
function Receipt({ ride }: { ride: RideRow }) {
  const [open, setOpen] = useState(false);
  const minutes =
    ride.startedAt && ride.completedAt
      ? Math.max(
          1,
          Math.round(
            (new Date(ride.completedAt).getTime() - new Date(ride.startedAt).getTime()) / 60000,
          ),
        )
      : null;

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <FileText className="size-4" aria-hidden /> রসিদ দেখুন
      </Button>
    );
  }

  return (
    <div className="space-y-1.5 rounded-xl border p-3 text-sm">
      <p className="font-semibold">রসিদ</p>
      <Line label="দূরত্ব" value={`${bn(ride.distance)} কিমি`} />
      {minutes != null && <Line label="সময়" value={`${bn(minutes)} মিনিট`} />}
      <Line label="যান" value={vehicleLabels[ride.vehicle]} />
      <Line label="চালক" value={ride.driverName?.trim() || (ride.driverPlate ?? "—")} />
      <Line
        label="ভাড়া নির্ধারণ"
        value={ride.pricingMode === "negotiated" ? "দরদাম" : "নির্ধারিত হার"}
      />
      <Line label="পরিশোধ" value="নগদ" />
      <div className="flex items-center justify-between border-t pt-2 font-semibold">
        <span>মোট</span>
        <span>{money(ride.fare)}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
        বন্ধ করুন
      </Button>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/** Report a problem with a finished or cancelled ride. */
function ReportBox({ ride }: { ride: RideRow }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(reportCategories[0] ?? "");
  const [details, setDetails] = useState("");
  const reportFn = useServerFn(reportRide);
  const submit = useMutation({
    mutationFn: () => reportFn({ data: { rideId: ride.id, category, details } }),
    onSuccess: () => {
      toast.success("রিপোর্ট পাঠানো হয়েছে — আমরা দেখছি");
      setOpen(false);
      setDetails("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Flag className="size-4" aria-hidden /> সমস্যা জানান
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="সমস্যার ধরন"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      >
        {reportCategories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <Textarea
        value={details}
        maxLength={500}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="কী হয়েছিল, সংক্ষেপে লিখুন (ঐচ্ছিক)"
      />
      <div className="flex gap-2">
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          রিপোর্ট পাঠান
        </Button>
        <Button variant="outline" onClick={() => setOpen(false)}>
          বাতিল
        </Button>
      </div>
    </div>
  );
}
