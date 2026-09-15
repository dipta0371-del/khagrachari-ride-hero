import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/useMe";
import { roleLabels, vehicleLabels, type Role, type Vehicle } from "@/lib/domain";
import { claimAdmin, registerDriver, updateProfile } from "@/lib/rides.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "প্রোফাইল — CHT GARI" },
      { name: "description", content: "নাম, মোবাইল নম্বর ও চালক হিসেবে নিবন্ধন করুন।" },
      { property: "og:title", content: "প্রোফাইল — CHT GARI" },
      { property: "og:description", content: "আপনার তথ্য হালনাগাদ করুন।" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: me } = useMe();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState<Vehicle>("bike");
  const [plate, setPlate] = useState("");

  useEffect(() => {
    if (!me) return;
    setName(me.name);
    setPhone(me.phone ?? "");
    if (me.driver) {
      setVehicle(me.driver.vehicle);
      setPlate(me.driver.plate);
    }
  }, [me]);

  const saveFn = useServerFn(updateProfile);
  const driverFn = useServerFn(registerDriver);
  const adminFn = useServerFn(claimAdmin);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["me"] });

  const save = useMutation({
    mutationFn: () => saveFn({ data: { name, phone } }),
    onSuccess: () => {
      toast.success("প্রোফাইল সংরক্ষিত হয়েছে");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const becomeDriver = useMutation({
    mutationFn: () => driverFn({ data: { vehicle, plate } }),
    onSuccess: () => {
      toast.success("চালকের তথ্য জমা হয়েছে — অ্যাডমিন অনুমোদনের অপেক্ষায়");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const takeAdmin = useMutation({
    mutationFn: () => adminFn(),
    onSuccess: () => {
      toast.success("আপনি এখন অ্যাডমিন");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-bold">প্রোফাইল</h1>
          {(me?.roles ?? []).map((r) => (
            <Badge key={r} variant="secondary">
              {roleLabels[r as Role] ?? r}
            </Badge>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">আপনার তথ্য</CardTitle>
            <CardDescription>
              মোবাইল নম্বর দিলে রাইড চলাকালীন চালক ও যাত্রী একে অপরকে কল করতে পারবেন।
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">পুরো নাম</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">মোবাইল নম্বর</Label>
              <Input
                id="phone"
                value={phone}
                dir="ltr"
                placeholder="01812345678"
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              সংরক্ষণ করুন
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">চালক হিসেবে যুক্ত হোন</CardTitle>
            <CardDescription>
              {me?.driver
                ? me.driver.approved
                  ? "আপনার চালক অ্যাকাউন্ট অনুমোদিত।"
                  : "অ্যাডমিন অনুমোদন দিলেই আপনি রাইড নিতে পারবেন।"
                : "গাড়ির তথ্য দিন। অ্যাডমিন যাচাই করে অনুমোদন দেবেন।"}
            </CardDescription>
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
                    onClick={() => setVehicle(v)}
                  >
                    {vehicleLabels[v]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plate">গাড়ির নম্বর</Label>
              <Input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="খাগড়াছড়ি-হ-১২-৩৪৫৬"
              />
            </div>
            <Button
              onClick={() => becomeDriver.mutate()}
              disabled={becomeDriver.isPending}
              variant={me?.driver ? "outline" : "default"}
            >
              {me?.driver ? "তথ্য হালনাগাদ করুন" : "চালক হিসেবে নিবন্ধন করুন"}
            </Button>
          </CardContent>
        </Card>

        {me && !me.adminExists && (
          <Card className="border-accent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="size-5 text-accent" aria-hidden /> প্রথম অ্যাডমিন নির্ধারণ
              </CardTitle>
              <CardDescription>
                এখনও কোনো অ্যাডমিন নেই। আপনি চাইলে এই অ্যাকাউন্টটিকে অ্যাডমিন করতে পারেন — এটি একবারই
                করা যায়।
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => takeAdmin.mutate()} disabled={takeAdmin.isPending}>
                আমাকে অ্যাডমিন করুন
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
