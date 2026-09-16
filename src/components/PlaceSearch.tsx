import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import type { Point } from "@/lib/domain";
import { resolvePlace, suggestPlaces } from "@/lib/places.functions";

interface Suggestion {
  placeId: string;
  main: string;
  secondary: string;
}

/** Google-backed place search with a debounced, app-owned suggestion list. */
export function PlaceSearch({
  label,
  onPick,
}: {
  label: string;
  onPick: (p: Point) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const suggest = useServerFn(suggestPlaces);
  const resolve = useServerFn(resolvePlace);

  // One session token per typing session keeps Google's billing/session rules happy.
  const token = useRef(crypto.randomUUID());
  const reqId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      suggest({ data: { query: q, sessionToken: token.current } })
        .then((r) => {
          if (id !== reqId.current) return; // stale response
          setItems(r.items);
          setOpen(true);
        })
        .catch(() => {
          if (id === reqId.current) setItems([]);
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    }, 300);
    return () => clearTimeout(t);
  }, [query, suggest]);

  async function choose(s: Suggestion) {
    setOpen(false);
    try {
      const place = await resolve({
        data: { placeId: s.placeId, sessionToken: token.current },
      });
      token.current = crypto.randomUUID();
      onPick({ name: place.name || s.main, lat: place.lat, lng: place.lng });
      setQuery("");
      setItems([]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          placeholder={`${label} খুঁজুন — বাজার, স্কুল, হোটেল…`}
          aria-label={`${label} খুঁজুন`}
          className="ps-9"
        />
        {loading && (
          <Loader2
            className="absolute end-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
      </div>

      {open && items.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border bg-popover p-1 shadow-lg">
          {items.map((s) => (
            <li key={s.placeId}>
              <button
                type="button"
                onClick={() => void choose(s)}
                className="w-full rounded-lg px-3 py-2 text-start text-sm hover:bg-secondary"
              >
                <span className="block font-medium">{s.main}</span>
                {s.secondary && (
                  <span className="block text-xs text-muted-foreground">{s.secondary}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= 2 && items.length === 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          কিছু পাওয়া যায়নি — অন্য নামে খুঁজুন বা মানচিত্রে ট্যাপ করুন।
        </p>
      )}
    </div>
  );
}
