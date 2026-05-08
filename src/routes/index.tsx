import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Coins, Flame, Swords, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/MatchCard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "GangBet — Stake on the Winning Gang" },
      { name: "description", content: "Live gang-vs-gang betting. Stake virtual coins, win the pool, climb the leaderboard." },
    ],
  }),
});

function Index() {
  const { data: matches } = useQuery({
    queryKey: ["featured-matches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, gang_a:gangs!matches_gang_a_id_fkey(*), gang_b:gangs!matches_gang_b_id_fkey(*)")
        .in("status", ["open", "live"])
        .order("scheduled_at", { ascending: true })
        .limit(6);
      return data ?? [];
    },
  });

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/60" style={{ backgroundImage: "var(--gradient-hero)" }}>
        <div className="container mx-auto px-4 py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
              <Flame className="size-3.5" /> Live betting now
            </div>
            <h1 className="text-4xl font-black uppercase leading-[1.05] tracking-tight md:text-7xl">
              Stake your coins.<br />
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-gold)" }}>
                Back the winning gang.
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              The underground betting hub for gang showdowns. Place your stake, ride the pool, take it all when your crew wins.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link to="/matches"><Button size="lg" className="font-bold uppercase">View matches</Button></Link>
              <Link to="/auth"><Button size="lg" variant="outline" className="font-bold uppercase">Get 1,000 starter coins</Button></Link>
            </div>

            <div className="mt-12 grid grid-cols-3 gap-4 text-center">
              <Stat icon={<Swords className="size-5" />} label="Live matches" value={matches?.length ?? 0} />
              <Stat icon={<Coins className="size-5" />} label="Starter coins" value="1,000" />
              <Stat icon={<Trophy className="size-5" />} label="Pool payout" value="100%" />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED MATCHES */}
      <section className="container mx-auto px-4 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-3xl font-black uppercase">Open Matches</h2>
            <p className="text-sm text-muted-foreground">Back a gang before the lines close</p>
          </div>
          <Link to="/matches" className="text-sm font-bold uppercase text-primary hover:underline">View all →</Link>
        </div>

        {matches && matches.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((m) => <MatchCard key={m.id} match={m as any} />)}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
            No open matches yet. {`{`}Admin can create one in the dashboard.{`}`}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="mb-1 flex justify-center text-primary">{icon}</div>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
