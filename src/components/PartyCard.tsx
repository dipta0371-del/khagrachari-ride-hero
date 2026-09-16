import { Mountain, Phone, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bn, vehicleLabels, type Vehicle } from "@/lib/domain";

/** Counterparty card: name, rating, vehicle/plate and a call button. */
export function PartyCard({
  kind,
  name,
  rating,
  vehicle,
  plate,
  phone,
}: {
  kind: "driver" | "rider";
  name?: string | null;
  rating?: { average: number | null; total: number } | null;
  vehicle?: Vehicle;
  plate?: string | null;
  phone?: string | null;
}) {
  const fallback = kind === "driver" ? "আপনার চালক" : "আপনার যাত্রী";
  const title = name && name.trim() ? name : fallback;
  const sub =
    kind === "driver"
      ? `${vehicle ? vehicleLabels[vehicle] : "যান"} · ${plate || "নম্বর নেই"}`
      : "নগদে ভাড়া পরিশোধ করবেন";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full ridge-panel text-primary-foreground">
          <Mountain className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{sub}</span>
            <RatingChip rating={rating ?? null} />
          </p>
        </div>
      </div>
      {phone ? (
        <Button asChild variant="outline">
          <a href={`tel:${phone}`}>
            <Phone className="size-4" aria-hidden /> কল করুন
          </a>
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground">নম্বর যোগ করা নেই</span>
      )}
    </div>
  );
}

export function RatingChip({ rating }: { rating: { average: number | null; total: number } | null }) {
  if (!rating || rating.average == null || rating.total === 0) {
    return <span className="text-xs text-muted-foreground">নতুন</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <Star className="size-3.5 fill-current text-accent" aria-hidden />
      <span className="font-medium text-foreground">{bn(rating.average)}</span>
      <span>· {bn(rating.total)}টি রাইড</span>
    </span>
  );
}
