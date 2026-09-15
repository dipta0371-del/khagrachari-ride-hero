import { z } from "zod";

export const BRAND = "CHT GARI";
export const BRAND_BN = "সিএইচটি গাড়ি";

export type Vehicle = "bike" | "tomtom";
export type Role = "rider" | "driver" | "admin";
export type RideStatus =
  | "requested"
  | "accepted"
  | "arrived"
  | "in_progress"
  | "completed"
  | "cancelled";

export const CENTER = { lat: 23.1193, lng: 91.9847 };
export const SERVICE_RADIUS_KM = 10;

export const places = [
  { name: "শাপলা চত্বর", lat: 23.1199, lng: 91.9849 },
  { name: "খাগড়াছড়ি বাস টার্মিনাল", lat: 23.1076, lng: 91.9845 },
  { name: "খাগড়াছড়ি বাজার", lat: 23.1187, lng: 91.9818 },
  { name: "খাগড়াছড়ি স্টেডিয়াম", lat: 23.1126, lng: 91.9879 },
  { name: "সরকারি কলেজ এলাকা", lat: 23.1091, lng: 91.982 },
  { name: "জেলা পরিষদ পার্ক এলাকা", lat: 23.137, lng: 91.992 },
];

export const pointSchema = z.object({
  name: z.string().trim().min(2).max(120),
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
});
export type Point = z.infer<typeof pointSchema>;

export const LOCATION_STALE_MS = 30000;

export const bookingSchema = z.object({
  pickup: pointSchema,
  dropoff: pointSchema,
  vehicle: z.enum(["bike", "tomtom"]),
  passengers: z.number().int().min(1).max(4),
  note: z.string().trim().max(200).default(""),
});
export type BookingInput = z.infer<typeof bookingSchema>;

export const ratesSchema = z.object({
  bike: z.object({
    base: z.number().int().min(0).max(1000),
    perKm: z.number().int().min(1).max(500),
    minimum: z.number().int().min(1).max(1000),
  }),
  tomtom: z.object({
    base: z.number().int().min(0).max(1000),
    perKm: z.number().int().min(1).max(500),
    minimum: z.number().int().min(1).max(1000),
  }),
});
export type Rates = z.infer<typeof ratesSchema>;
export const DEFAULT_RATES: Rates = {
  bike: { base: 30, perKm: 15, minimum: 45 },
  tomtom: { base: 40, perKm: 20, minimum: 60 },
};

export function distanceKm(
  a: Pick<Point, "lat" | "lng">,
  b: Pick<Point, "lat" | "lng">,
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

export interface FareBreakdown {
  distance: number;
  directKm: number;
  base: number;
  perKm: number;
  minimum: number;
  metered: number;
  fare: number;
  minimumApplied: boolean;
  approximate: true;
}

export function quote(input: BookingInput, rates: Rates): FareBreakdown {
  if (
    distanceKm(CENTER, input.pickup) > SERVICE_RADIUS_KM ||
    distanceKm(CENTER, input.dropoff) > SERVICE_RADIUS_KM
  ) {
    throw new Error("এই লোকেশন সেবার ১০ কিমি এলাকার বাইরে।");
  }
  if (input.vehicle === "bike" && input.passengers !== 1) {
    throw new Error("বাইকে সর্বোচ্চ ১ জন যাত্রী যেতে পারবেন।");
  }
  const direct = distanceKm(input.pickup, input.dropoff);
  if (direct < 0.1) {
    throw new Error("পিকআপ ও গন্তব্য অন্তত ১০০ মিটার আলাদা হতে হবে।");
  }
  const distance = Math.round(direct * 1.3 * 10) / 10;
  const rate = rates[input.vehicle];
  const metered = Math.ceil(rate.base + distance * rate.perKm);
  const fare = Math.max(rate.minimum, metered);
  return {
    distance,
    directKm: Math.round(direct * 10) / 10,
    base: rate.base,
    perKm: rate.perKm,
    minimum: rate.minimum,
    metered,
    fare,
    minimumApplied: fare > metered,
    approximate: true,
  };
}

export const activeStatuses: RideStatus[] = [
  "requested",
  "accepted",
  "arrived",
  "in_progress",
];

export const nextStatus: Partial<Record<RideStatus, RideStatus>> = {
  accepted: "arrived",
  arrived: "in_progress",
  in_progress: "completed",
};

export const statusLabels: Record<RideStatus, string> = {
  requested: "চালক খোঁজা হচ্ছে",
  accepted: "চালক আসছেন",
  arrived: "চালক পৌঁছেছেন",
  in_progress: "রাইড চলছে",
  completed: "রাইড সম্পন্ন",
  cancelled: "বাতিল হয়েছে",
};

export const driverActionLabels: Partial<Record<RideStatus, string>> = {
  accepted: "পৌঁছেছি",
  arrived: "যাত্রা শুরু",
  in_progress: "ভাড়া নিয়ে সম্পন্ন",
};

export const vehicleLabels: Record<Vehicle, string> = {
  bike: "বাইক",
  tomtom: "টমটম",
};

export const roleLabels: Record<Role, string> = {
  rider: "যাত্রী",
  driver: "চালক",
  admin: "অ্যাডমিন",
};

export const money = (v: number) => `৳${Math.round(v).toLocaleString("bn-BD")}`;
export const bn = (v: number) => v.toLocaleString("bn-BD");

export function timeBn(iso: string) {
  return new Date(iso).toLocaleString("bn-BD", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
