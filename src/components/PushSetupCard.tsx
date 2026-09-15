import { useServerFn } from "@tanstack/react-start";
import { Bell, BellOff, BellRing, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { registerDeviceToken } from "@/lib/notifications.functions";
import {
  enableWebPush,
  inEmbeddedFrame,
  webPushConfigured,
  webPushGranted,
} from "@/lib/push-web";

type State = "idle" | "on" | "busy" | "blocked" | "frame" | "missing";

export function PushSetupCard() {
  const registerFn = useServerFn(registerDeviceToken);
  const [state, setState] = useState<State>("idle");

  useEffect(() => {
    if (!webPushConfigured()) return setState("missing");
    if (inEmbeddedFrame()) return setState("frame");
    if (webPushGranted()) {
      setState("on");
      void enableWebPush().then((r) => {
        if (r.status === "registered" && r.token) {
          void registerFn({ data: { token: r.token, platform: "web" } }).catch(() => {});
        }
      });
    }
  }, [registerFn]);

  async function turnOn() {
    setState("busy");
    const result = await enableWebPush();
    if (result.status === "registered" && result.token) {
      try {
        await registerFn({ data: { token: result.token, platform: "web" } });
        setState("on");
        toast.success("নোটিফিকেশন চালু হয়েছে");
      } catch {
        setState("idle");
        toast.error("নিবন্ধন করা যায়নি — আবার চেষ্টা করুন");
      }
      return;
    }
    if (result.status === "open-in-new-tab") return setState("frame");
    if (result.status === "not-configured") return setState("missing");
    if (result.status === "denied") return setState("blocked");
    setState("idle");
    toast.error("এই ব্রাউজারে নোটিফিকেশন সমর্থিত নয়");
  }

  if (state === "on") {
    return (
      <Card className="border-primary/40">
        <CardContent className="flex items-center gap-3 pt-6 text-sm">
          <BellRing className="size-5 text-primary" aria-hidden />
          <span>নোটিফিকেশন চালু আছে — নতুন রাইডের অনুরোধ এলেই জানানো হবে।</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent/50">
      <CardContent className="flex flex-wrap items-center gap-3 pt-6 text-sm">
        {state === "blocked" ? (
          <>
            <BellOff className="size-5 text-destructive" aria-hidden />
            <span>
              ব্রাউজারে নোটিফিকেশন বন্ধ করা আছে। অ্যাড্রেস বারের পাশে সাইট সেটিংস থেকে অনুমতি দিন।
            </span>
          </>
        ) : state === "frame" ? (
          <>
            <ExternalLink className="size-5 text-accent" aria-hidden />
            <span>
              নোটিফিকেশন চালু করতে অ্যাপটি নতুন ট্যাবে (অথবা মোবাইলে সরাসরি) খুলুন — প্রিভিউ উইন্ডোতে
              ব্রাউজার অনুমতি চাইতে দেয় না।
            </span>
          </>
        ) : state === "missing" ? (
          <>
            <BellOff className="size-5 text-muted-foreground" aria-hidden />
            <span>নোটিফিকেশন সেটআপ এখনও সম্পূর্ণ নয়।</span>
          </>
        ) : (
          <>
            <Bell className="size-5 text-accent" aria-hidden />
            <span className="flex-1">নতুন রাইডের অনুরোধ এলে ফোনে জানান পেতে নোটিফিকেশন চালু করুন।</span>
            <Button size="sm" onClick={turnOn} disabled={state === "busy"}>
              নোটিফিকেশন চালু করুন
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
