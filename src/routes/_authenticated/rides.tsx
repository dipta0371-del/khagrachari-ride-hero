import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Star } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { bn, money, statusLabels, timeBn, vehicleLabels } from "@/lib/domain";
import { getMyRides, rateRide, type RideRow } from "@/lib/rides.functions";

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
            চালক: {vehicleLabels[ride.vehicle]}
            {ride.driverPlate ? ` · ${ride.driverPlate}` : ""}
          </p>
        )}


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
