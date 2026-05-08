import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatchCard, type MatchWithGangs } from "@/components/MatchCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/matches")({
  component: MatchesPage,
  head: () => ({ meta: [{ title: "All Matches — GangBet" }] }),
});

function MatchesPage() {
  const [filter, setFilter] = useState<"all" | "open" | "live" | "resolved">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["matches", filter],
    queryFn: async () => {
      let q = supabase
        .from("matches")
        .select("*, gang_a:gangs!matches_gang_a_id_fkey(*), gang_b:gangs!matches_gang_b_id_fkey(*)")
        .order("scheduled_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return (data ?? []) as MatchWithGangs[];
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase">All Matches</h1>
          <p className="text-sm text-muted-foreground">Pick your fight, place your stake</p>
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="open">Open</TabsTrigger>
            <TabsTrigger value="live">Live</TabsTrigger>
            <TabsTrigger value="resolved">Resolved</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-border/60 bg-card/50" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((m) => <MatchCard key={m.id} match={m} />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
          No matches found.
        </div>
      )}
    </div>
  );
}