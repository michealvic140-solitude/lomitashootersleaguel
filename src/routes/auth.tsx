import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Swords } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — GangBet" }] }),
});

function AuthPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    router.navigate({ to: "/" });
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      options: {
        emailRedirectTo: window.location.origin,
        data: { username: String(fd.get("username")) },
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — 1,000 coins added");
    router.navigate({ to: "/" });
  };

  return (
    <div className="container mx-auto flex min-h-[80vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-[var(--shadow-card)]">
        <div className="mb-6 flex flex-col items-center text-center">
          <Swords className="mb-2 size-8 text-primary" />
          <h1 className="text-2xl font-black uppercase">Enter the Hub</h1>
          <p className="text-sm text-muted-foreground">Get 1,000 starter coins on signup</p>
        </div>

        <Tabs defaultValue="signin">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <form onSubmit={handleSignIn} className="space-y-3">
              <Field label="Email" name="email" type="email" required />
              <Field label="Password" name="password" type="password" required />
              <Button type="submit" disabled={loading} className="w-full font-bold uppercase">
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <form onSubmit={handleSignUp} className="space-y-3">
              <Field label="Username" name="username" required minLength={3} />
              <Field label="Email" name="email" type="email" required />
              <Field label="Password" name="password" type="password" required minLength={6} />
              <Button type="submit" disabled={loading} className="w-full font-bold uppercase">
                {loading ? "Creating…" : "Create account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} {...props} />
    </div>
  );
}