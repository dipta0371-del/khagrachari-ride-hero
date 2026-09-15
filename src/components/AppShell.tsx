import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu, Mountain } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMe } from "@/hooks/useMe";
import { usePushRegistration } from "@/hooks/usePushRegistration";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/domain";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl ridge-panel text-primary-foreground">
        <Mountain className="size-5" aria-hidden />
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-bold tracking-tight">{BRAND}</span>
        {!compact && (
          <span className="block text-[11px] text-muted-foreground">খাগড়াছড়ির রাইড সেবা</span>
        )}
      </span>
    </span>
  );
}

function navFor(roles: string[]) {
  const items = [
    { to: "/book", label: "রাইড নিন" },
    { to: "/rides", label: "আমার রাইড" },
  ];
  if (roles.includes("driver")) items.push({ to: "/driver", label: "চালক প্যানেল" });
  if (roles.includes("admin")) items.push({ to: "/admin", label: "অ্যাডমিন" });
  items.push({ to: "/profile", label: "প্রোফাইল" });
  return items;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const items = navFor(me?.roles ?? []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center gap-3 px-4">
          <Link to="/book" className="shrink-0">
            <BrandMark compact />
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {items.map((i) => (
              <Link
                key={i.to}
                to={i.to}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
              >
                {i.label}
              </Link>
            ))}
            <Button variant="ghost" size="sm" onClick={signOut} className="ml-1">
              <LogOut className="size-4" aria-hidden />
              বের হন
            </Button>
          </nav>

          <div className="ml-auto md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="মেনু">
                  <Menu className="size-5" aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetHeader>
                  <SheetTitle className="text-start">
                    <BrandMark />
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-1 px-4">
                  {items.map((i) => (
                    <Link
                      key={i.to}
                      to={i.to}
                      className="rounded-lg px-3 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground [&.active]:bg-secondary [&.active]:text-foreground"
                    >
                      {i.label}
                    </Link>
                  ))}
                  <Button variant="outline" onClick={signOut} className="mt-4">
                    <LogOut className="size-4" aria-hidden />
                    বের হন
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border/70 py-6 text-center text-xs text-muted-foreground">
        {BRAND} · খাগড়াছড়ি · ভাড়া নগদে পরিশোধযোগ্য
      </footer>
    </div>
  );
}
