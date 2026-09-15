import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { BrandMark } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { BRAND } from "@/lib/domain";

const searchSchema = z.object({
  mode: z.enum(["rider", "driver"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "সাইন ইন — CHT GARI" },
      {
        name: "description",
        content: "CHT GARI-তে ইমেইল দিয়ে অ্যাকাউন্ট খুলুন বা সাইন ইন করুন — যাত্রী ও চালক দুজনেই।",
      },
      { property: "og:title", content: "সাইন ইন — CHT GARI" },
      {
        property: "og:description",
        content: "খাগড়াছড়ির রাইড সেবায় যোগ দিন — যাত্রী বা চালক হিসেবে।",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(mode === "driver" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/book", replace: true });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signup") {
        if (name.trim().length < 2) throw new Error("আপনার নাম লিখুন।");
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${mode === "driver" ? "/profile" : "/book"}`,
            data: { full_name: name.trim() },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
        toast.success("অ্যাকাউন্ট তৈরি হয়েছে");
        navigate({ to: mode === "driver" ? "/profile" : "/book", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        toast.success("স্বাগতম");
        navigate({ to: "/book", replace: true });
      }
    } catch (err) {
      const msg = (err as Error).message;
      toast.error(
        msg.includes("Invalid login")
          ? "ইমেইল বা পাসওয়ার্ড মিলছে না।"
          : msg.includes("already registered")
            ? "এই ইমেইলে অ্যাকাউন্ট আছে — সাইন ইন করুন।"
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto flex h-16 w-full max-w-5xl items-center px-4">
        <Link to="/">
          <BrandMark />
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 items-start justify-center px-4 py-8">
        <Card className="w-full shadow-ridge">
          <CardHeader>
            <CardTitle className="font-display text-2xl">{BRAND}-এ স্বাগতম</CardTitle>
            <CardDescription>
              {mode === "driver"
                ? "চালক হিসেবে যুক্ত হতে প্রথমে অ্যাকাউন্ট খুলুন, পরের ধাপে গাড়ির তথ্য দেবেন।"
                : "ইমেইল আর পাসওয়ার্ড দিয়েই শুরু। মোবাইল নম্বর প্রোফাইলে যোগ করতে পারবেন।"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3 text-center">
                <p className="font-semibold">ইমেইল দেখুন</p>
                <p className="text-sm text-muted-foreground">
                  {email} ঠিকানায় একটি নিশ্চিতকরণ লিংক পাঠানো হয়েছে। লিংকে ক্লিক করলেই অ্যাকাউন্ট
                  চালু হবে।
                </p>
                <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
                  ফিরে যান
                </Button>
              </div>
            ) : (
              <>
                <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">সাইন ইন</TabsTrigger>
                    <TabsTrigger value="signup">নতুন অ্যাকাউন্ট</TabsTrigger>
                  </TabsList>
                </Tabs>

                <form onSubmit={submit} className="mt-5 space-y-4">
                  {tab === "signup" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="name">পুরো নাম</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        required
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email">ইমেইল</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      dir="ltr"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">পাসওয়ার্ড</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={tab === "signup" ? "new-password" : "current-password"}
                      minLength={6}
                      dir="ltr"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>
                    {busy ? "অপেক্ষা করুন…" : tab === "signup" ? "অ্যাকাউন্ট খুলুন" : "সাইন ইন"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
