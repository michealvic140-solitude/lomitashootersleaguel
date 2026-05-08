import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: "My Profile — GangBet" }] }),
});

function ProfilePage() {
  const { user, profile, loading } = useAuth();

  const { data: bets } = useQuery({
    queryKey: ["my-bets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("bets")
        .select("*, matches(title, status, winner_gang_id), gang:gangs(name, tag, color)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  if (loading) return <div className="container mx-auto p-10 text-center text-muted-foreground">Loading…</div>;
  if (!user) return (
    <div className="container mx-auto p-10 text-center">
      <p className="mb-4 text-muted-foreground">Sign in to see your profile</p>
      <Link to="/auth" className="font-bold uppercase text-primary hover:underline">Sign in</Link>
    </div>
  );
  if (!profile) return null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Player</div>
          <h1 className="text-3xl font-black">{profile.username}</h1>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-lg font-black text-primary">
          <Coins className="size-5" /> {profile.coins.toLocaleString()}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total won" value={profile.total_won.toLocaleString()} />
        <Stat label="Total wagered" value={profile.total_wagered.toLocaleString()} />
        <Stat label="Bets won" value={profile.bets_won} icon={<Trophy className="size-4 text-success" />} />
        <Stat label="Bets lost" value={profile.bets_lost} icon={<X className="size-4 text-destructive" />} />
      </div>

      <h2 className="mb-3 text-sm font-black uppercase">My bets</h2>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3 text-left">Match</th><th className="p-3 text-left">Pick</th><th className="p-3 text-right">Stake</th><th className="p-3 text-right">Status</th><th className="p-3 text-right">Payout</th></tr>
          </thead>
          <tbody>
            {bets?.map((b: any) => (
              <tr key={b.id} className="border-t border-border/60">
                <td className="p-3 font-bold">{b.matches?.title}</td>
                <td className="p-3"><span style={{ color: b.gang?.color }}>{b.gang?.tag}</span></td>
                <td className="p-3 text-right">{b.amount.toLocaleString()}</td>
                <td className="p-3 text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${b.status === "won" ? "bg-success/15 text-success" : b.status === "lost" ? "bg-destructive/15 text-destructive" : b.status === "refunded" ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"}`}>{b.status}</span>
                </td>
                <td className="p-3 text-right font-bold text-success">{b.payout > 0 ? `+${b.payout.toLocaleString()}` : "—"}</td>
              </tr>
            ))}
            {!bets?.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">You haven't bet yet. <Link to="/matches" className="text-primary hover:underline">Find a match →</Link></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-black">{value}</div>
    </div>
  );
}