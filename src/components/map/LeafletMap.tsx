import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, Circle, useMap, useMapEvents } from "react-leaflet";

import { CENTER, SERVICE_RADIUS_KM } from "@/lib/domain";

export interface MapPin {
  lat: number;
  lng: number;
  kind: "pickup" | "dropoff" | "rider" | "driver";
  label?: string;
}

const PIN_STYLES: Record<MapPin["kind"], { bg: string; glyph: string }> = {
  pickup: { bg: "var(--color-primary)", glyph: "A" },
  dropoff: { bg: "var(--color-accent)", glyph: "B" },
  rider: { bg: "var(--color-chart-3)", glyph: "য" },
  driver: { bg: "var(--color-primary)", glyph: "চ" },
};

function pinIcon(kind: MapPin["kind"]) {
  const { bg, glyph } = PIN_STYLES[kind];
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<span style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:999px;background:${bg};color:#fff;font-weight:700;font-size:13px;box-shadow:0 2px 10px rgba(0,0,0,.35);border:2px solid #fff">${glyph}</span>`,
  });
}

function Recenter({ pins, follow }: { pins: MapPin[]; follow: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!follow || pins.length === 0) return;
    if (pins.length === 1) {
      map.setView([pins[0]!.lat, pins[0]!.lng], Math.max(map.getZoom(), 15));
    } else {
      map.fitBounds(
        L.latLngBounds(pins.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 16 },
      );
    }
  }, [map, follow, JSON.stringify(pins)]);
  return null;
}

function ClickCatcher({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LeafletMap({
  pins = [],
  onPick,
  follow = true,
  showZone = false,
  className = "",
}: {
  pins?: MapPin[];
  onPick?: (lat: number, lng: number) => void;
  follow?: boolean;
  showZone?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <MapContainer
        center={[CENTER.lat, CENTER.lng]}
        zoom={14}
        scrollWheelZoom
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        {showZone && (
          <Circle
            center={[CENTER.lat, CENTER.lng]}
            radius={SERVICE_RADIUS_KM * 1000}
            pathOptions={{ color: "var(--color-primary)", weight: 1.5, fillOpacity: 0.05 }}
          />
        )}
        {pins.map((p, i) => (
          <Marker key={`${p.kind}-${i}`} position={[p.lat, p.lng]} icon={pinIcon(p.kind)} />
        ))}
        {onPick && <ClickCatcher onPick={onPick} />}
        <Recenter pins={pins} follow={follow} />
      </MapContainer>
    </div>
  );
}
