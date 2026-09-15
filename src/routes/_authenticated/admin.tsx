import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_RATES,
  bn,
  money,
  statusLabels,
  timeBn,
  vehicleLabels,
  type Rates,
  type Vehicle,
} from "@/lib/domain";
import { getAdminBoard, setDriverApproval, updateRates } from "@/lib/rides.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "অ্যাডমিন — CHT GARI" },
      { name: "description", content: "চালক অনুমোদন, ভাড়ার হার ও রাইডের পরিসংখ্যান।" },
      { property: "og:title", content: "অ্যাডমিন — CHT GARI" },
      { property: "og:description", content: "CHT GARI পরিচালনার কেন্দ্র।" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const boardFn = useServerFn(getAdminBoard);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-board"],
    queryFn: () => boardFn(),
    refetchInterval: 8000,
    retry: false,
  });

  if (error) {
    return (
      <AppShell>
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          এই পাতা দেখার অনুমতি নেই।
        </p>
      </AppShell>
    );
  }

  if (isLoading && !data) {
    return (
      <AppShell>
        <div className="grid h-64 place-items-center text-muted-foreground">
          <Loader2 className="size-6 animate-spin" aria-hidden />
        </div>
      </AppShell>
    );
  }

  const s = data!.stats;

  return (
    <AppShell>
      <div className="space-y-5">
        <h1 className="font-display text-2xl font-bold">অ্যাডমিন</h1>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Box label="আজকের রাইড" value={bn(s.todayRides)} />
          <Box label="চলমান" value={bn(s.active)} />
          <Box label="সম্পন্ন" value={bn(s.completed)} />
          <Box label="মোট ভাড়া" value={money(s.revenue)} />
          <Box label="বাতিল" value={bn(s.cancelled)} />
          <Box label="অনলাইন চালক" value={bn(s.onlineDrivers)} />
          <Box label="অনুমোদনের অপেক্ষায়" value={bn(s.pendingDrivers)} />
          <Box label="সর্বশেষ রাইড" value={bn(data!.rides.length)} />
        </div>

        <Tabs defaultValue="drivers">
          <TabsList>
            <TabsTrigger value="drivers">চালক</TabsTrigger>
            <TabsTrigger value="rides">রাইড</TabsTrigger>
            <TabsTrigger value="rates">ভাড়ার হার</TabsTrigger>
          </TabsList>

          <TabsContent value="drivers" className="mt-4 space-y-3">
            {data!.drivers.length === 0 ? (
              <Empty>এখনও কোনো চালক নিবন্ধন করেননি।</Empty>
            ) : (
              data!.drivers.map((d) => <DriverRow key={d.userId} driver={d} />)
            )}
          </TabsContent>

          <TabsContent value="rides" className="mt-4 space-y-3">
            {data!.rides.length === 0 ? (
              <Empty>এখনও কোনো রাইড হয়নি।</Empty>
            ) : (
              data!.rides.map((r) => (
                <div key={r.id} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.pickup.name} → {r.dropoff.name}
                    </p>
                    <Badge variant="secondary">{statusLabels[r.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {timeBn(r.createdAt)} · {vehicleLabels[r.vehicle]} · {bn(r.distance)} কিমি ·{" "}
                    {money(r.fare)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    যাত্রী: {r.riderName || "—"} · চালক: {r.driverName || "এখনও নেই"}
                  </p>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="rates" className="mt-4">
            <RatesForm rates={data!.rates ?? DEFAULT_RATES} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
      {children}
    </p>
  );
}

function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}

function DriverRow({
  driver,
}: {
  driver: {
    userId: string;
    name: string;
    phone: string | null;
    vehicle: Vehicle;
    plate: string;
    approved: boolean;
    online: boolean;
  };
}) {
  const queryClient = useQueryClient();
  const fn = useServerFn(setDriverApproval);
  const m = useMutation({
    mutationFn: (approved: boolean) => fn({ data: { userId: driver.userId, approved } }),
    onSuccess: () => {
      toast.success("হালনাগাদ হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["admin-board"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div>
        <p className="font-medium">{driver.name || "নাম নেই"}</p>
        <p className="text-sm text-muted-foreground">
          {vehicleLabels[driver.vehicle]} · {driver.plate || "নম্বর নেই"}
          {driver.phone ? ` · ${driver.phone}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {driver.approved ? (
          <Badge variant={driver.online ? "default" : "secondary"}>
            {driver.online ? "অনলাইন" : "অনুমোদিত"}
          </Badge>
        ) : (
          <Badge variant="outline">অপেক্ষমাণ</Badge>
        )}
        <Button
          size="sm"
          variant={driver.approved ? "outline" : "default"}
          onClick={() => m.mutate(!driver.approved)}
          disabled={m.isPending}
        >
          {driver.approved ? "অনুমোদন বাতিল" : "অনুমোদন দিন"}
        </Button>
      </div>
    </div>
  );
}

function RatesForm({ rates }: { rates: Rates }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Rates>(rates);
  useEffect(() => setForm(rates), [rates]);

  const fn = useServerFn(updateRates);
  const m = useMutation({
    mutationFn: () => fn({ data: form }),
    onSuccess: () => {
      toast.success("ভাড়ার হার সংরক্ষিত হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["admin-board"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(v: Vehicle, key: "base" | "perKm" | "minimum", value: string) {
    setForm((f) => ({ ...f, [v]: { ...f[v], [key]: Number(value) || 0 } }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">ভাড়ার হার</CardTitle>
        <CardDescription>
          পরিবর্তন সঙ্গে সঙ্গে নতুন বুকিংয়ে প্রযোজ্য হবে। চলমান রাইডের ভাড়া বদলাবে না।
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {(["bike", "tomtom"] as Vehicle[]).map((v) => (
          <div key={v} className="space-y-3">
            <h3 className="font-semibold">{vehicleLabels[v]}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["base", "বেস ভাড়া"],
                  ["perKm", "প্রতি কিমি"],
                  ["minimum", "সর্বনিম্ন ভাড়া"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`${v}-${key}`}>{label}</Label>
                  <Input
                    id={`${v}-${key}`}
                    type="number"
                    dir="ltr"
                    min={0}
                    value={form[v][key]}
                    onChange={(e) => set(v, key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <Button onClick={() => m.mutate()} disabled={m.isPending}>
          সংরক্ষণ করুন
        </Button>
      </CardContent>
    </Card>
  );
}
