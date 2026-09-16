import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { RatingChip } from "@/components/PartyCard";
import { Button } from "@/components/ui/button";
import { bn, distanceKm, etaMinutes, money, vehicleLabels } from "@/lib/domain";
import { acceptOffer, listOffers, type RideRow } from "@/lib/rides.functions";

/** Rider-side list of driver fare offers on an open (negotiated) request. */
export function OffersPanel({ ride }: { ride: RideRow }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listOffers);
  const acceptFn = useServerFn(acceptOffer);

  const { data, isLoading } = useQuery({
    queryKey: ["ride-offers", ride.id],
    queryFn: () => listFn({ data: { rideId: ride.id } }),
    refetchInterval: 3500,
  });

  const accept = useMutation({
    mutationFn: (offerId: string) => acceptFn({ data: { rideId: ride.id, offerId } }),
    onSuccess: () => {
      toast.success("চালক নিশ্চিত হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["my-rides"] });
      void queryClient.invalidateQueries({ queryKey: ["ride-offers", ride.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offers = data?.offers ?? [];

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold">চালকদের প্রস্তাব</p>
        <span className="text-sm text-muted-foreground">
          {isLoading && !data ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            `${bn(offers.length)}টি`
          )}
        </span>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          এখনো কেউ প্রস্তাব দেননি। কিছুক্ষণ অপেক্ষা করুন, অথবা বাতিল করে বেশি ভাড়ায় আবার অনুরোধ পাঠান।
        </p>
      ) : (
        <ul className="space-y-2">
          {offers.map((o) => {
            const km = distanceKm(ride.pickup, ride.pickup);
            void km;
            const eta = o.driverVehicle ? etaMinutes(ride.distance, o.driverVehicle) : null;
            return (
              <li
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{o.driverName?.trim() || "চালক"}</p>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {o.driverVehicle ? vehicleLabels[o.driverVehicle] : ""} · {o.driverPlate || "নম্বর নেই"}
                    </span>
                    <RatingChip rating={o.rating} />
                    {eta != null && <span>· যাত্রায় প্রায় {bn(eta)} মিনিট</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold">{money(o.amount)}</span>
                  <Button
                    size="sm"
                    onClick={() => accept.mutate(o.id)}
                    disabled={accept.isPending}
                  >
                    গ্রহণ
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
