import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";

import { RideMap, type MapPin as Pin } from "@/components/map";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND, bn, money, statusLabels, vehicleLabels } from "@/lib/domain";
import { getSharedTrip } from "@/lib/rides.functions";

export const Route = createFileRoute("/trip/$token")({
  head: () => ({
    meta: [
      { title: `যাত্রা লাইভ দেখুন — ${BRAND}` },
      { name: "description", content: "শেয়ার করা যাত্রার অবস্থান ও অবস্থা লাইভ দেখুন।" },
      { property: "og:title", content: `যাত্রা লাইভ দেখুন — ${BRAND}` },
      { property: "og:description", content: "প্রিয়জনের যাত্রা কোথায় আছে দেখে নিন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedTripPage,
  errorComponent: () => <Shell>যাত্রার তথ্য দেখানো যায়নি।</Shell>,
  notFoundComponent: () => <Shell>এই লিংকের কোনো যাত্রা পাওয়া যায়নি।</Shell>,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl p-5">
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </main>
  );
}

function SharedTripPage() {
  const { token } = Route.useParams();
  const tripFn = useServerFn(getSharedTrip);
  const { data, isLoading } = useQuery({
    queryKey: ["shared-trip", token],
    queryFn: () => tripFn({ data: { token } }),
    refetchInterval: 4000,
  });

  if (isLoading && !data) {
    return (
      <Shell>
        <Loader2 className="size-5 animate-spin" aria-hidden />
      </Shell>
    );
  }
  if (!data?.found) return <Shell>এই লিংকের কোনো যাত্রা পাওয়া যায়নি।</Shell>;

  const pins: Pin[] = [
    { lat: data.pickup.lat, lng: data.pickup.lng, kind: "pickup" },
    { lat: data.dropoff.lat, lng: data.dropoff.lng, kind: "dropoff" },
  ];
  if (data.driverAt) {
    pins.push({ lat: data.driverAt.lat, lng: data.driverAt.lng, kind: "driver" });
  }

  return (
    <main className="mx-auto max-w-2xl space-y-4 p-5">
      <Card className="shadow-ridge">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="font-display text-xl">{BRAND} — যাত্রা লাইভ</CardTitle>
            <Badge variant="secondary">{statusLabels[data.status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">পিকআপ</p>
              <p className="font-medium">{data.pickup.name}</p>
            </div>
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">গন্তব্য</p>
              <p className="font-medium">{data.dropoff.name}</p>
            </div>
          </div>

          <RideMap pins={pins} follow className="h-72 w-full overflow-hidden rounded-xl border" />

          <p className="text-sm text-muted-foreground">
            {vehicleLabels[data.vehicle]} · {data.plate || "নম্বর নেই"} · {bn(data.distance)} কিমি ·{" "}
            {money(data.fare)}
          </p>
          {!data.driverAt && (
            <p className="text-xs text-muted-foreground">
              এখন লাইভ অবস্থান পাওয়া যাচ্ছে না — যাত্রা শুরু হলে বা নেটওয়ার্ক ফিরলে দেখাবে।
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
