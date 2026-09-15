import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

const registerSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["android", "ios", "web"]),
});

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => registerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const db = context.supabase as any;
    const { error } = await db.from("device_tokens").upsert(
      {
        user_id: context.userId,
        token: data.token,
        platform: data.platform,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export async function notifyUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const LOVABLE_API_KEY = process.env["LOVABLE_API_KEY"];
  const FCM_API_KEY = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!LOVABLE_API_KEY || !FCM_API_KEY) {
    console.warn("[notify] FCM not configured; skipping push");
    return;
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: rows } = await admin.from("device_tokens").select("token").eq("user_id", userId);
  const tokens = ((rows ?? []) as any[]).map((r) => r.token as string);
  if (!tokens.length) return;

  for (const token of tokens) {
    try {
      const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": FCM_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            data: data ?? {},
          },
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error(`[notify] FCM send failed ${res.status}: ${text}`);
      }
    } catch (e) {
      console.error("[notify] network error", e);
    }
  }
}
