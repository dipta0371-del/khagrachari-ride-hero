import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

/** Khagrachhari town centre — biases every search to the service area. */
const BIAS = { latitude: 23.1193, longitude: 91.9847, radius: 30000 };

function creds() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const mapsKey = process.env["GOOGLE_MAPS_API_KEY"];
  if (!lovableKey || !mapsKey) {
    throw new Error("ম্যাপ সেবা এখন যুক্ত নেই। কিছুক্ষণ পর আবার চেষ্টা করুন।");
  }
  return { lovableKey, mapsKey };
}

async function gateway(
  path: string,
  init: { method: "GET" | "POST"; fieldMask: string; body?: unknown },
) {
  const { lovableKey, mapsKey } = creds();
  const res = await fetch(`${GATEWAY}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": mapsKey,
      "Content-Type": "application/json",
      "X-Goog-FieldMask": init.fieldMask,
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`google maps gateway ${path} [${res.status}]: ${text}`);
    throw new Error("জায়গা খোঁজা যাচ্ছে না। একটু পরে আবার চেষ্টা করুন।");
  }
  return (await res.json()) as Record<string, any>;
}

/** Autocomplete suggestions, biased to Khagrachhari. */
export const suggestPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ query: z.string().trim().min(2).max(120), sessionToken: z.string().max(64) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const json = await gateway("/places/v1/places:autocomplete", {
      method: "POST",
      fieldMask:
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
      body: {
        input: data.query,
        sessionToken: data.sessionToken,
        includedRegionCodes: ["bd"],
        languageCode: "bn",
        locationBias: { circle: { center: { latitude: BIAS.latitude, longitude: BIAS.longitude }, radius: BIAS.radius } },
      },
    });
    const suggestions = (json["suggestions"] ?? []) as any[];
    return {
      items: suggestions
        .map((s) => s?.placePrediction)
        .filter(Boolean)
        .map((p: any) => ({
          placeId: String(p.placeId),
          main: String(p.structuredFormat?.mainText?.text ?? p.text?.text ?? ""),
          secondary: String(p.structuredFormat?.secondaryText?.text ?? ""),
        }))
        .filter((p) => p.main),
    };
  });

/** Exact coordinates for a chosen suggestion. */
export const resolvePlace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ placeId: z.string().trim().min(3).max(200), sessionToken: z.string().max(64) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const json = await gateway(
      `/places/v1/places/${encodeURIComponent(data.placeId)}?sessionToken=${encodeURIComponent(data.sessionToken)}&languageCode=bn`,
      { method: "GET", fieldMask: "id,displayName,formattedAddress,location" },
    );
    const loc = json["location"];
    if (!loc) throw new Error("এই জায়গার অবস্থান পাওয়া যায়নি।");
    return {
      name: String(json["displayName"]?.text ?? json["formattedAddress"] ?? "নির্বাচিত জায়গা").slice(0, 120),
      address: String(json["formattedAddress"] ?? ""),
      lat: Number(loc.latitude),
      lng: Number(loc.longitude),
    };
  });

/** Turn a map tap into a readable address. */
export const reverseGeocode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { lovableKey, mapsKey } = creds();
    const url = `${GATEWAY}/maps/api/geocode/json?latlng=${data.lat},${data.lng}&language=bn`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": mapsKey },
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`google geocode [${res.status}]: ${text}`);
      return { name: "মানচিত্রে বেছে নেওয়া জায়গা" };
    }
    const json = (await res.json()) as { results?: Array<{ formatted_address?: string }> };
    const first = json.results?.[0]?.formatted_address;
    return { name: (first ?? "মানচিত্রে বেছে নেওয়া জায়গা").slice(0, 120) };
  });
