import { Mountain, Phone } from "lucide-react";

import { Button } from "@/components/ui/button";
import { vehicleLabels, type Vehicle } from "@/lib/domain";

/**
 * Uber-style counterparty card: a logo badge instead of a personal name,
 * with the vehicle and plate carrying the identification weight.
 */
export function PartyCard({
  kind,
  vehicle,
  plate,
  phone,
}: {
  kind: "driver" | "rider";
  vehicle?: Vehicle;
  plate?: string | null;
  phone?: string | null;
}) {
  const title = kind === "driver" ? "আপনার চালক" : "আপনার যাত্রী";
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
          <p className="text-sm text-muted-foreground">{sub}</p>
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
