import { createFileRoute, Link } from "@tanstack/react-router";
import { Bike, Clock, MapPin, ShieldCheck, Star, Wallet } from "lucide-react";
import { useMemo, useState } from "react";

import { BrandMark } from "@/components/AppShell";
import { RideMap } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BRAND,
  DEFAULT_RATES,
  money,
  places,
  quote,
  vehicleLabels,
  type Rates,
  type Vehicle,
} from "@/lib/domain";
import { getPublicRates } from "@/lib/rides.functions";

export const Route = createFileRoute("/")({
  loader: async () => ({ rates: await getPublicRates() }),
  head: () => ({
    meta: [
      { title: "CHT GARI — খাগড়াছড়ির বাইক ও টমটম রাইড সেবা" },
      {
        name: "description",
        content:
          "খাগড়াছড়ি শহরে বাইক ও টমটম রাইড বুক করুন। আগেই ভাড়া জানুন, লাইভ লোকেশন দেখুন, নগদে ভাড়া দিন।",
      },
      { property: "og:title", content: "CHT GARI — খাগড়াছড়ির রাইড সেবা" },
      {
        property: "og:description",
        content: "স্বচ্ছ ভাড়া, লাইভ ট্র্যাকিং আর অনুমোদিত চালক — খাগড়াছড়ির নিজস্ব রাইড সেবা।",
      },
    ],
  }),
  errorComponent: () => (
    <div className="grid min-h-screen place-items-center p-6 text-center text-muted-foreground">
      পাতাটি লোড করা যায়নি। একটু পরে আবার চেষ্টা করুন।
    </div>
  ),
  notFoundComponent: () => <div className="p-6">পাওয়া যায়নি</div>,
  component: Landing,
});

function FareEstimator({ rates }: { rates: Rates }) {
  const [from, setFrom] = useState(places[0]!.name);
  const [to, setTo] = useState(places[1]!.name);
  const [vehicle, setVehicle] = useState<Vehicle>("bike");

  const result = useMemo(() => {
    const a = places.find((p) => p.name === from)!;
    const b = places.find((p) => p.name === to)!;
    try {
      return {
        q: quote(
          { pickup: a, dropoff: b, vehicle, passengers: 1, note: "" },
          rates,
        ),
        error: null as string | null,
      };
    } catch (e) {
      return { q: null, error: (e as Error).message };
    }
  }, [from, to, vehicle, rates]);

  return (
    <Card className="shadow-ridge">
      <CardHeader>
        <CardTitle className="text-base">আগেই ভাড়া দেখে নিন</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">কোথা থেকে</span>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {places.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">কোথায় যাবেন</span>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {places.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>

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

        {result.q ? (
          <div className="rounded-xl bg-secondary p-4">
            <p className="text-3xl font-bold text-foreground">{money(result.q.fare)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              আনুমানিক {result.q.distance.toLocaleString("bn-BD")} কিমি · ভাড়া নগদে
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">{result.error}</p>
        )}

        <Button asChild size="lg" className="w-full">
          <Link to="/auth">রাইড বুক করুন</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function Landing() {
  const { rates } = Route.useLoaderData();
  const safeRates: Rates = rates ?? DEFAULT_RATES;

  const features = [
    {
      icon: Wallet,
      title: "ভাড়া আগেই জানা",
      body: "বুকিংয়ের আগেই পুরো ভাড়ার হিসাব দেখতে পাবেন। কোনো লুকানো খরচ নেই, ভাড়া নগদে।",
    },
    {
      icon: MapPin,
      title: "লাইভ লোকেশন",
      body: "রাইড চলাকালীন যাত্রী ও চালক একে অপরের অবস্থান মানচিত্রে দেখতে পান।",
    },
    {
      icon: ShieldCheck,
      title: "অনুমোদিত চালক",
      body: "প্রতিটি চালকের গাড়ির নম্বর যাচাই করে অ্যাডমিন অনুমোদন দেন।",
    },
    {
      icon: Star,
      title: "রেটিং ব্যবস্থা",
      body: "রাইড শেষে দুই পক্ষই রেটিং দিতে পারেন, ফলে সেবার মান ধরে রাখা সহজ।",
    },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
        <BrandMark />
        <Button asChild variant="outline">
          <Link to="/auth">সাইন ইন</Link>
        </Button>
      </header>

      <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1.1fr_1fr] lg:py-16">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
            <Bike className="size-3.5" aria-hidden /> খাগড়াছড়ি শহর ও আশপাশের ১০ কিমি
          </span>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            পাহাড়ের শহরে <span className="text-primary">সহজ রাইড</span>
          </h1>
          <p className="max-w-prose text-lg text-muted-foreground">
            {BRAND} খাগড়াছড়ির যাত্রী আর স্থানীয় বাইক-টমটম চালকদের এক জায়গায় আনে। ভাড়া আগেই
            জানা, চালক অনুমোদিত, আর পুরো যাত্রা মানচিত্রে দেখা যায়।
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">যাত্রী হিসেবে শুরু করুন</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth" search={{ mode: "driver" }}>
                চালক হিসেবে যুক্ত হন
              </Link>
            </Button>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t pt-6">
            <div>
              <dt className="text-xs text-muted-foreground">বাইক শুরু</dt>
              <dd className="text-xl font-bold">{money(safeRates.bike.minimum)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">টমটম শুরু</dt>
              <dd className="text-xl font-bold">{money(safeRates.tomtom.minimum)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">সেবার পরিধি</dt>
              <dd className="text-xl font-bold">১০ কিমি</dd>
            </div>
          </dl>
        </div>

        <FareEstimator rates={safeRates} />
      </section>

      <section className="border-y bg-card/60 py-12">
        <div className="mx-auto w-full max-w-5xl px-4">
          <h2 className="font-display text-2xl font-bold">কেন {BRAND}</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5">
                <f.icon className="size-6 text-primary" aria-hidden />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <h2 className="font-display text-2xl font-bold">আমরা যেখানে সেবা দিই</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          খাগড়াছড়ি শহরকে কেন্দ্র করে ১০ কিলোমিটার এলাকা।
        </p>
        <RideMap
          showZone
          pins={places.map((p) => ({ ...p, kind: "pickup" as const }))}
          className="mt-5 h-72 w-full overflow-hidden rounded-xl border sm:h-96"
        />
      </section>

      <section className="border-t bg-card/60 py-12">
        <div className="mx-auto w-full max-w-5xl px-4 text-center">
          <Clock className="mx-auto size-8 text-primary" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-bold">আজই শুরু করুন</h2>
          <p className="mx-auto mt-2 max-w-prose text-muted-foreground">
            একটি ইমেইল দিয়েই অ্যাকাউন্ট খোলা যায়। চালক হতে চাইলে গাড়ির নম্বর দিন, অ্যাডমিন অনুমোদন
            দিলেই রাইড নেওয়া শুরু।
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link to="/auth">অ্যাকাউন্ট খুলুন</Link>
          </Button>
        </div>
      </section>

      <footer className="py-8 text-center text-xs text-muted-foreground">
        {BRAND} · খাগড়াছড়ি · ভাড়া নগদে পরিশোধযোগ্য
      </footer>
    </div>
  );
}
