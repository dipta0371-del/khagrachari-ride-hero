import { ClientOnly } from "@tanstack/react-router";
import { Suspense, lazy } from "react";

import type { MapPin } from "./LeafletMap";

export type { MapPin };

// Leaflet touches `window` at import time, so it must never enter the SSR graph.
const LeafletMap = lazy(() => import("./LeafletMap"));

function MapSkeleton({ className }: { className?: string | undefined }) {
  return (
    <div
      className={`grid place-items-center bg-muted text-sm text-muted-foreground ${className ?? ""}`}
    >
      মানচিত্র লোড হচ্ছে…
    </div>
  );
}

export interface RideMapProps {
  pins?: MapPin[] | undefined;
  onPick?: ((lat: number, lng: number) => void) | undefined;
  onMove?: ((lat: number, lng: number) => void) | undefined;
  flyTo?: { lat: number; lng: number } | null | undefined;
  follow?: boolean | undefined;
  showZone?: boolean | undefined;
  className?: string | undefined;
}

export function RideMap(props: RideMapProps) {
  return (
    <ClientOnly fallback={<MapSkeleton className={props.className} />}>
      <Suspense fallback={<MapSkeleton className={props.className} />}>
        <LeafletMap {...props} />
      </Suspense>
    </ClientOnly>
  );
}
