import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DEFAULT_RATES,
  LOCATION_STALE_MS,
  activeStatuses,
  bookingSchema,
  distanceKm,
  nextStatus,
  quote,
  ratesSchema,
  type Rates,
  type RideStatus,
  type Vehicle,
} from "./domain";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

type AnyClient = {
  from: (t: string) => any;
};

function fail(message: string): never {
  throw new Error(message);
}

async function loadRates(db: AnyClient): Promise<Rates> {
  const { data } = await db.from("app_settings").select("value").eq("key", "rates").maybeSingle();
  const parsed = ratesSchema.safeParse(data?.value);
  return parsed.success ? parsed.data : DEFAULT_RATES;
}

const RIDE_COLUMNS =
  "id, rider_id, driver_id, status, vehicle, passengers, note, pickup_name, pickup_lat, pickup_lng, dropoff_name, dropoff_lat, dropoff_lng, distance_km, fare, cancel_reason, created_at, updated_at";

export interface RideRow {
  id: string;
  riderId: string;
  driverId: string | null;
  status: RideStatus;
  vehicle: Vehicle;
  passengers: number;
  note: string;
  pickup: { name: string; lat: number; lng: number };
  dropoff: { name: string; lat: number; lng: number };
  distance: number;
  fare: number;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  riderName?: string | null;
  riderPhone?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  driverPlate?: string | null;
}

function mapRide(r: any): RideRow {
  return {
    id: r.id,
    riderId: r.rider_id,
    driverId: r.driver_id,
    status: r.status,
    vehicle: r.vehicle,
    passengers: r.passengers,
    note: r.note ?? "",
    pickup: { name: r.pickup_name, lat: r.pickup_lat, lng: r.pickup_lng },
    dropoff: { name: r.dropoff_name, lat: r.dropoff_lat, lng: r.dropoff_lng },
    distance: Number(r.distance_km),
    fare: r.fare,
    cancelReason: r.cancel_reason ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Attach the counterparty's name / phone / plate where policy allows it. */
async function decorate(db: AnyClient, rides: RideRow[]): Promise<RideRow[]> {
  if (!rides.length) return rides;
  const ids = Array.from(
    new Set(rides.flatMap((r) => [r.riderId, r.driverId]).filter(Boolean) as string[]),
  );
  const [{ data: profiles }, { data: drivers }] = await Promise.all([
    db.from("profiles").select("id, full_name, phone").in("id", ids),
    db.from("drivers").select("user_id, plate, vehicle").in("user_id", ids),
  ]);
  const pMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
  const dMap = new Map<string, any>((drivers ?? []).map((d: any) => [d.user_id, d]));
  return rides.map((r) => ({
    ...r,
    riderName: pMap.get(r.riderId)?.full_name ?? null,
    riderPhone: pMap.get(r.riderId)?.phone ?? null,
    driverName: r.driverId ? (pMap.get(r.driverId)?.full_name ?? null) : null,
    driverPhone: r.driverId ? (pMap.get(r.driverId)?.phone ?? null) : null,
    driverPlate: r.driverId ? (dMap.get(r.driverId)?.plate ?? null) : null,
  }));
}

/* ------------------------------------------------------------------ */
/* public                                                              */
/* ------------------------------------------------------------------ */

export const getPublicRates = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const db = createClient(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init: any) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  return loadRates(db as unknown as AnyClient);
});

/* ------------------------------------------------------------------ */
/* account                                                             */
/* ------------------------------------------------------------------ */

export interface MeData {
  userId: string;
  name: string;
  phone: string | null;
  roles: string[];
  driver: { vehicle: Vehicle; plate: string; approved: boolean; online: boolean } | null;
  rates: Rates;
  adminExists: boolean;
}

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MeData> => {
    const db = context.supabase as unknown as AnyClient;
    const [{ data: profile }, { data: roles }, { data: driver }, rates] = await Promise.all([
      db.from("profiles").select("full_name, phone").eq("id", context.userId).maybeSingle(),
      db.from("user_roles").select("role").eq("user_id", context.userId),
      db.from("drivers").select("vehicle, plate, approved, online").eq("user_id", context.userId).maybeSingle(),
      loadRates(db),
    ]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    return {
      userId: context.userId,
      name: profile?.full_name ?? "",
      phone: profile?.phone ?? null,
      roles: (roles ?? []).map((r: any) => r.role),
      driver: driver ?? null,
      rates,
      adminExists: (count ?? 0) > 0,
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(2, "নাম অন্তত ২ অক্ষরের হতে হবে").max(80),
        phone: z
          .string()
          .trim()
          .regex(/^01[3-9]\d{8}$/, "১১ ডিজিটের সঠিক মোবাইল নম্বর দিন (যেমন 01812345678)")
          .or(z.literal("")),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("profiles")
      .update({ full_name: data.name, phone: data.phone || null })
      .eq("id", context.userId);
    if (error) fail(error.message);
    return { ok: true };
  });

export const registerDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vehicle: z.enum(["bike", "tomtom"]),
        plate: z.string().trim().min(3, "গাড়ির নম্বর দিন").max(40),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("drivers")
      .upsert(
        { user_id: context.userId, vehicle: data.vehicle, plate: data.plate },
        { onConflict: "user_id" },
      );
    if (error) fail(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "driver" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

/** Bootstrap: the very first account may claim admin. Locked forever after. */
export const claimAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) fail("অ্যাডমিন ইতিমধ্যে নির্ধারিত হয়েছে।");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "admin" });
    if (error) fail(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* rider                                                               */
/* ------------------------------------------------------------------ */

export const bookRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    bookingSchema.extend({ idempotencyKey: z.string().uuid(), expectedFare: z.number().int() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const rates = await loadRates(db);
    const q = quote(data, rates);
    if (q.fare !== data.expectedFare) {
      fail(`ভাড়া হালনাগাদ হয়েছে — নতুন ভাড়া ৳${q.fare}। আবার নিশ্চিত করুন।`);
    }

    const { data: existing } = await db
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("rider_id", context.userId)
      .eq("idempotency_key", data.idempotencyKey)
      .maybeSingle();
    if (existing) return mapRide(existing);

    const { data: active } = await db
      .from("rides")
      .select("id")
      .eq("rider_id", context.userId)
      .in("status", activeStatuses)
      .maybeSingle();
    if (active) fail("আপনার একটি রাইড এখনও চলছে।");

    const { data: row, error } = await db
      .from("rides")
      .insert({
        rider_id: context.userId,
        status: "requested",
        vehicle: data.vehicle,
        passengers: data.passengers,
        note: data.note ?? "",
        pickup_name: data.pickup.name,
        pickup_lat: data.pickup.lat,
        pickup_lng: data.pickup.lng,
        dropoff_name: data.dropoff.name,
        dropoff_lat: data.dropoff.lat,
        dropoff_lng: data.dropoff.lng,
        distance_km: q.distance,
        fare: q.fare,
        idempotency_key: data.idempotencyKey,
      })
      .select(RIDE_COLUMNS)
      .single();
    if (error) fail("রাইড তৈরি করা যায়নি — আবার চেষ্টা করুন।");
    return mapRide(row);
  });

export const getMyRides = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data } = await db
      .from("rides")
      .select(RIDE_COLUMNS)
      .eq("rider_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    const rides = await decorate(db, (data ?? []).map(mapRide));
    const { data: rated } = await db
      .from("ride_ratings")
      .select("ride_id")
      .eq("rater_id", context.userId);
    return { rides, ratedRideIds: (rated ?? []).map((r: any) => r.ride_id) as string[] };
  });

export const cancelRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: ride } = await db
      .from("rides")
      .select("id, status, rider_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride) fail("রাইড পাওয়া যায়নি।");
    if (!activeStatuses.includes(ride.status)) fail("এই রাইড আর বাতিল করা যাবে না।");
    if (ride.status === "in_progress") fail("চলমান রাইড বাতিল করা যাবে না।");
    const byRider = ride.rider_id === context.userId;
    const { error } = await db
      .from("rides")
      .update({
        status: "cancelled",
        cancel_reason: byRider ? "যাত্রী বাতিল করেছেন" : "চালক বাতিল করেছেন",
      })
      .eq("id", data.rideId);
    if (error) fail(error.message);
    await db.from("ride_locations").delete().eq("ride_id", data.rideId);
    return { ok: true };
  });

export const rateRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rideId: z.string().uuid(),
        score: z.number().int().min(1).max(5),
        comment: z.string().trim().max(300).default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: ride } = await db
      .from("rides")
      .select("rider_id, driver_id, status")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride) fail("রাইড পাওয়া যায়নি।");
    if (ride.status !== "completed") fail("রাইড সম্পন্ন হলে রেটিং দেওয়া যাবে।");
    const ratee = ride.rider_id === context.userId ? ride.driver_id : ride.rider_id;
    if (!ratee) fail("রেটিং দেওয়ার মতো কেউ নেই।");
    const { error } = await db.from("ride_ratings").insert({
      ride_id: data.rideId,
      rater_id: context.userId,
      ratee_id: ratee,
      score: data.score,
      comment: data.comment ?? "",
    });
    if (error) fail("রেটিং সংরক্ষণ হয়নি — হয়তো আগেই দেওয়া হয়েছে।");
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* driver                                                              */
/* ------------------------------------------------------------------ */

export const setDriverOnline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ online: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("drivers")
      .update({ online: data.online })
      .eq("user_id", context.userId);
    if (error) fail(error.message);
    return { ok: true };
  });

export const getDriverBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ lat: z.number().optional(), lng: z.number().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: driver } = await db
      .from("drivers")
      .select("vehicle, plate, approved, online")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!driver) return { driver: null, queue: [], active: null, earnings: null };

    const [{ data: openRows }, { data: activeRows }, { data: doneRows }] = await Promise.all([
      driver.approved
        ? db
            .from("rides")
            .select(RIDE_COLUMNS)
            .eq("status", "requested")
            .eq("vehicle", driver.vehicle)
            .order("created_at", { ascending: true })
            .limit(25)
        : Promise.resolve({ data: [] }),
      db
        .from("rides")
        .select(RIDE_COLUMNS)
        .eq("driver_id", context.userId)
        .in("status", ["accepted", "arrived", "in_progress"])
        .maybeSingle()
        .then((r: any) => ({ data: r.data ? [r.data] : [] })),
      db
        .from("rides")
        .select("fare, created_at")
        .eq("driver_id", context.userId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    let queue: RideRow[] = ((openRows ?? []) as any[]).map(mapRide);
    if (typeof data.lat === "number" && typeof data.lng === "number") {
      const me = { lat: data.lat, lng: data.lng };
      queue = queue
        .map((r: RideRow) => ({ r, d: distanceKm(me, r.pickup) }))
        .sort((a: { d: number }, b: { d: number }) => a.d - b.d)
        .map(({ r, d }: { r: RideRow; d: number }) => ({
          ...r,
          pickupAwayKm: Math.round(d * 10) / 10,
        }) as RideRow);
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(Date.now() - 7 * 86400000);
    const done = doneRows ?? [];
    const sum = (rows: any[]) => rows.reduce((t, r) => t + (r.fare ?? 0), 0);
    const today = done.filter((r: any) => new Date(r.created_at) >= startOfDay);
    const week = done.filter((r: any) => new Date(r.created_at) >= startOfWeek);

    const { data: ratings } = await db
      .from("ride_ratings")
      .select("score")
      .eq("ratee_id", context.userId);
    const scores = (ratings ?? []).map((r: any) => r.score);

    return {
      driver,
      queue: await decorate(db, queue),
      active: (await decorate(db, (activeRows ?? []).map(mapRide)))[0] ?? null,
      earnings: {
        todayCount: today.length,
        todayTotal: sum(today),
        weekCount: week.length,
        weekTotal: sum(week),
        allCount: done.length,
        allTotal: sum(done),
        rating: scores.length
          ? Math.round((scores.reduce((a: number, b: number) => a + b, 0) / scores.length) * 10) / 10
          : null,
        ratingCount: scores.length,
      },
    };
  });

export const acceptRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: row, error } = await db
      .from("rides")
      .update({ driver_id: context.userId, status: "accepted" })
      .eq("id", data.rideId)
      .eq("status", "requested")
      .is("driver_id", null)
      .select(RIDE_COLUMNS)
      .maybeSingle();
    if (error) fail("রাইড নেওয়া যায়নি — আপনার আরেকটি রাইড চলছে অথবা অনুমোদন নেই।");
    if (!row) fail("এই রাইড অন্য একজন চালক নিয়ে নিয়েছেন।");
    return mapRide(row);
  });

export const advanceRide = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: ride } = await db
      .from("rides")
      .select("status, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride || ride.driver_id !== context.userId) fail("এই রাইড আপনার নয়।");
    const next = nextStatus[ride.status as RideStatus];
    if (!next) fail("এই ধাপ থেকে আর এগোনো যাবে না।");
    const { error } = await db.from("rides").update({ status: next }).eq("id", data.rideId);
    if (error) fail(error.message);
    if (next === "completed") await db.from("ride_locations").delete().eq("ride_id", data.rideId);
    return { status: next };
  });

/* ------------------------------------------------------------------ */
/* live location                                                       */
/* ------------------------------------------------------------------ */

export const pushLocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        rideId: z.string().uuid(),
        lat: z.number().finite().min(-90).max(90),
        lng: z.number().finite().min(-180).max(180),
        accuracy: z.number().finite().min(0).max(100000),
        capturedAt: z.number().int(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const age = Date.now() - data.capturedAt;
    if (age > LOCATION_STALE_MS || age < -5000) fail("লোকেশনের সময় সঠিক নয়।");
    const db = context.supabase as unknown as AnyClient;
    const { data: ride } = await db
      .from("rides")
      .select("status, rider_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride) fail("রাইড পাওয়া যায়নি।");
    if (!activeStatuses.includes(ride.status)) fail("রাইড আর চলমান নয়।");
    const { error } = await db.from("ride_locations").upsert(
      {
        ride_id: data.rideId,
        user_id: context.userId,
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        captured_at: new Date(data.capturedAt).toISOString(),
        received_at: new Date().toISOString(),
      },
      { onConflict: "ride_id,user_id" },
    );
    if (error) fail(error.message);
    return { ok: true };
  });

export const getRideLocations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    const { data: ride } = await db
      .from("rides")
      .select("rider_id, driver_id")
      .eq("id", data.rideId)
      .maybeSingle();
    if (!ride) return { rider: null, driver: null };
    const { data: rows } = await db
      .from("ride_locations")
      .select("user_id, lat, lng, accuracy, captured_at")
      .eq("ride_id", data.rideId);
    const pick = (uid: string | null) => {
      const row = (rows ?? []).find((r: any) => r.user_id === uid);
      if (!row) return null;
      const capturedAt = new Date(row.captured_at).getTime();
      if (Date.now() - capturedAt > LOCATION_STALE_MS) return null;
      return { lat: row.lat, lng: row.lng, accuracy: row.accuracy, capturedAt };
    };
    return { rider: pick(ride.rider_id), driver: pick(ride.driver_id) };
  });

export const stopSharing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ rideId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as unknown as AnyClient;
    await db
      .from("ride_locations")
      .delete()
      .eq("ride_id", data.rideId)
      .eq("user_id", context.userId);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* admin                                                               */
/* ------------------------------------------------------------------ */

async function assertAdmin(context: any) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) fail("এই কাজের অনুমতি নেই।");
}

export const getAdminBoard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = context.supabase as unknown as AnyClient;
    const [{ data: rideRows }, { data: driverRows }, rates] = await Promise.all([
      db.from("rides").select(RIDE_COLUMNS).order("created_at", { ascending: false }).limit(60),
      db.from("drivers").select("user_id, vehicle, plate, approved, online, created_at").order("created_at", { ascending: false }),
      loadRates(db),
    ]);
    const rides = await decorate(db, (rideRows ?? []).map(mapRide));
    const driverIds = (driverRows ?? []).map((d: any) => d.user_id);
    const { data: driverProfiles } = await db
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", driverIds.length ? driverIds : ["00000000-0000-0000-0000-000000000000"]);
    const pMap = new Map<string, any>(
      ((driverProfiles ?? []) as any[]).map((p: any) => [p.id, p] as [string, any]),
    );

    const completed = rides.filter((r) => r.status === "completed");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      rides,
      rates,
      drivers: (driverRows ?? []).map((d: any) => ({
        userId: d.user_id,
        vehicle: d.vehicle as Vehicle,
        plate: d.plate,
        approved: d.approved,
        online: d.online,
        name: pMap.get(d.user_id)?.full_name ?? "",
        phone: pMap.get(d.user_id)?.phone ?? null,
      })),
      stats: {
        total: rides.length,
        active: rides.filter((r) => activeStatuses.includes(r.status)).length,
        completed: completed.length,
        cancelled: rides.filter((r) => r.status === "cancelled").length,
        revenue: completed.reduce((t, r) => t + r.fare, 0),
        todayRides: rides.filter((r) => new Date(r.createdAt) >= today).length,
        pendingDrivers: (driverRows ?? []).filter((d: any) => !d.approved).length,
        onlineDrivers: (driverRows ?? []).filter((d: any) => d.online && d.approved).length,
      },
    };
  });

export const setDriverApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), approved: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db
      .from("drivers")
      .update({ approved: data.approved, online: data.approved ? undefined : false })
      .eq("user_id", data.userId);
    if (error) fail(error.message);
    return { ok: true };
  });

export const updateRates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ratesSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = context.supabase as unknown as AnyClient;
    const { error } = await db.from("app_settings").update({ value: data }).eq("key", "rates");
    if (error) fail(error.message);
    return { ok: true };
  });
