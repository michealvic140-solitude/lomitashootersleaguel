import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/leaderboard")({
  component: Leaderboard,
  head: () => ({ meta: [{ title: "Leaderboard — GangBet" }] }),
});

function Leaderboard() {
  const { data } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("total_won", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <Trophy className="mx-auto mb-2 size-10 text-primary" />
        <h1 className="text-3xl font-black uppercase">Top Bettors</h1>
        <p className="text-sm text-muted-foreground">All-time coin earnings</p>
      </div>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
        <table className="w-full text-sm">
          <thead className="bg-background/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <tr><th className="p-3 text-left">#</th><th className="p-3 text-left">Player</th><th className="p-3 text-right">Won</th><th className="p-3 text-right">W/L</th><th className="p-3 text-right">Coins</th></tr>
          </thead>
          <tbody>
            {data?.map((p, i) => (
              <tr key={p.id} className="border-t border-border/60">
                <td className="p-3 font-black">{i < 3 ? <Crown className={`size-4 ${i === 0 ? "text-primary" : i === 1 ? "text-muted-foreground" : "text-accent"}`} /> : i + 1}</td>
                <td className="p-3 font-bold">{p.username}</td>
                <td className="p-3 text-right font-bold text-success">+{p.total_won.toLocaleString()}</td>
                <td className="p-3 text-right text-muted-foreground">{p.bets_won}/{p.bets_lost}</td>
                <td className="p-3 text-right font-bold text-primary">{p.coins.toLocaleString()}</td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No players yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}