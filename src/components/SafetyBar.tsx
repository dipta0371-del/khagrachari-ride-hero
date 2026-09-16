import { Copy, PhoneCall, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EMERGENCY_NUMBER } from "@/lib/domain";

/** Share the live trip with family and reach emergency services in one tap. */
export function SafetyBar({ shareToken }: { shareToken: string | null }) {
  const url = shareToken ? `${typeof window === "undefined" ? "" : window.location.origin}/trip/${shareToken}` : null;

  async function share() {
    if (!url) return;
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    try {
      if (typeof nav.share === "function") {
        await nav.share({ title: "আমার যাত্রা — CHT GARI", text: "আমি এখন এই রাইডে আছি। লাইভ দেখুন:", url });
        return;
      }
      await nav.clipboard.writeText(url);
      toast.success("লিংক কপি হয়েছে — পরিবারকে পাঠিয়ে দিন");
    } catch {
      /* user dismissed the share sheet */
    }
  }


  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("লিংক কপি হয়েছে");
    } catch {
      toast.error("লিংক কপি করা যায়নি।");
    }
  }

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-dashed p-3">
      <Button type="button" variant="secondary" className="flex-1" onClick={share} disabled={!url}>
        <Share2 className="size-4" aria-hidden /> যাত্রা শেয়ার করুন
      </Button>
      <Button type="button" variant="outline" onClick={copy} disabled={!url} aria-label="লিংক কপি করুন">
        <Copy className="size-4" aria-hidden />
      </Button>
      <Button asChild variant="destructive" className="flex-1">
        <a href={`tel:${EMERGENCY_NUMBER}`}>
          <PhoneCall className="size-4" aria-hidden /> জরুরি ৯৯৯
        </a>
      </Button>
    </div>
  );
}
