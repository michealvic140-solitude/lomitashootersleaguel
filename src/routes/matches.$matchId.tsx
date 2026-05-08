import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Coins, MessageSquare, Send, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/matches/$matchId")({
  component: MatchDetail,
});

function MatchDetail() {
  const { matchId } = Route.useParams();
  const qc = useQueryClient();
  const { user, profile, refreshProfile } = useAuth();
  const [stake, setStake] = useState("100");
  const [pickGang, setPickGang] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const { data: match } = useQuery({
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("matches")
        .select("*, gang_a:gangs!matches_gang_a_id_fkey(*), gang_b:gangs!matches_gang_b_id_fkey(*)")
        .eq("id", matchId)
        .single();
      return data;
    },
  });

  const { data: bets } = useQuery({
    queryKey: ["match-bets", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bets")
        .select("*, profiles(username, avatar_url)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const { data: comments } = useQuery({
    queryKey: ["match-comments", matchId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("*, profiles(username, avatar_url)")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Realtime updates
  useEffect(() => {
    const ch = supabase
      .channel(`match-${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["match", matchId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "bets", filter: `match_id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["match-bets", matchId] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `match_id=eq.${matchId}` }, () => qc.invalidateQueries({ queryKey: ["match-comments", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  const placeBet = async () => {
    if (!user) return toast.error("Sign in first");
    if (!pickGang) return toast.error("Pick a gang");
    const amount = parseInt(stake, 10);
    if (!amount || amount <= 0) return toast.error("Enter a valid stake");
    if (profile && amount > profile.coins) return toast.error("Not enough coins");

    const { error } = await supabase.rpc("place_bet", { _match_id: matchId, _gang_id: pickGang, _amount: amount });
    if (error) return toast.error(error.message);
    toast.success(`${amount} coins staked`);
    refreshProfile();
    qc.invalidateQueries({ queryKey: ["match", matchId] });
    qc.invalidateQueries({ queryKey: ["match-bets", matchId] });
  };

  const postComment = async () => {
    if (!user) return toast.error("Sign in first");
    if (!comment.trim()) return;
    const { error } = await supabase.from("comments").insert({ match_id: matchId, user_id: user.id, body: comment.trim() });
    if (error) return toast.error(error.message);
    setComment("");
  };

  if (!match) return <div className="container mx-auto p-10 text-center text-muted-foreground">Loading…</div>;

  const total = match.pool_a + match.pool_b;
  const oddsA = total > 0 ? total / Math.max(match.pool_a, 1) : 2;
  const oddsB = total > 0 ? total / Math.max(match.pool_b, 1) : 2;
  const isOpen = match.status === "open" || match.status === "live";

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <Link to="/matches" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">← Back to matches</Link>

      <div className="rounded-2xl border border-border/60 bg-card p-6 md:p-8 shadow-[var(--shadow-card)]">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <span className={`rounded-full border px-2 py-0.5 ${isOpen ? "border-success/40 bg-success/15 text-success" : "border-primary/40 bg-primary/15 text-primary"}`}>{match.status}</span>
          <span className="text-muted-foreground">{new Date(match.scheduled_at).toLocaleString()}</span>
        </div>
        <h1 className="mb-2 text-3xl font-black">{match.title}</h1>
        {match.description && <p className="mb-6 text-muted-foreground">{match.description}</p>}

        <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr]">
          <GangPick gang={match.gang_a} odds={oddsA} pool={match.pool_a} selected={pickGang === match.gang_a.id} onPick={() => setPickGang(match.gang_a.id)} disabled={!isOpen} winner={match.winner_gang_id === match.gang_a.id} />
          <div className="flex items-center justify-center text-3xl font-black text-muted-foreground">VS</div>
          <GangPick gang={match.gang_b} odds={oddsB} pool={match.pool_b} selected={pickGang === match.gang_b.id} onPick={() => setPickGang(match.gang_b.id)} disabled={!isOpen} winner={match.winner_gang_id === match.gang_b.id} />
        </div>

        <div className="mt-6 rounded-xl border border-border/60 bg-background/40 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-bold uppercase text-muted-foreground">Total Pool</span>
            <span className="flex items-center gap-1 font-black"><Coins className="size-4 text-primary" /> {total.toLocaleString()}</span>
          </div>

          {isOpen ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="mb-1 block text-xs font-bold uppercase text-muted-foreground">Your stake</label>
                <Input type="number" min={1} value={stake} onChange={(e) => setStake(e.target.value)} />
              </div>
              <div className="flex gap-1">
                {[100, 500, 1000].map((n) => (
                  <Button key={n} variant="outline" size="sm" onClick={() => setStake(String(n))}>{n}</Button>
                ))}
              </div>
              <Button onClick={placeBet} className="font-bold uppercase" disabled={!user || !pickGang}>Place stake</Button>
            </div>
          ) : match.status === "resolved" && match.winner_gang_id ? (
            <div className="flex items-center gap-2 text-success">
              <Trophy className="size-5" />
              <span className="font-bold">Winner: {match.winner_gang_id === match.gang_a.id ? match.gang_a.name : match.gang_b.name}</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Betting is closed for this match.</p>
          )}
        </div>
      </div>

      {/* Recent bets + comments */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase"><Coins className="size-4" /> Recent stakes</h2>
          <ul className="space-y-2">
            {bets?.length ? bets.map((b: any) => (
              <li key={b.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{b.profiles?.username ?? "anon"}</span>
                <span className="font-bold">{b.amount.toLocaleString()} on <span style={{ color: b.gang_id === match.gang_a.id ? match.gang_a.color : match.gang_b.color }}>{b.gang_id === match.gang_a.id ? match.gang_a.tag : match.gang_b.tag}</span></span>
              </li>
            )) : <li className="text-sm text-muted-foreground">No stakes yet — be first.</li>}
          </ul>
        </section>

        <section className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase"><MessageSquare className="size-4" /> Trash talk</h2>
          {user && (
            <div className="mb-3 flex gap-2">
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Talk your shit…" rows={2} maxLength={500} />
              <Button onClick={postComment} size="icon"><Send className="size-4" /></Button>
            </div>
          )}
          <ul className="space-y-2 max-h-72 overflow-y-auto">
            {comments?.length ? comments.map((c: any) => (
              <li key={c.id} className="rounded-md bg-background/40 p-2 text-sm">
                <div className="text-xs font-bold text-primary">{c.profiles?.username ?? "anon"}</div>
                <div>{c.body}</div>
              </li>
            )) : <li className="text-sm text-muted-foreground">No comments yet.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function GangPick({ gang, odds, pool, selected, onPick, disabled, winner }: { gang: any; odds: number; pool: number; selected: boolean; onPick: () => void; disabled?: boolean; winner?: boolean }) {
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className={`group rounded-xl border-2 p-5 text-left transition-all ${selected ? "border-primary bg-primary/10 shadow-[var(--shadow-glow)]" : "border-border/60 bg-background/40 hover:border-primary/40"} ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      style={selected ? undefined : { borderLeftColor: gang.color, borderLeftWidth: 4 }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="size-3 rounded-full" style={{ backgroundColor: gang.color }} />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{gang.tag}</span>
        {winner && <Trophy className="size-4 text-success" />}
      </div>
      <div className="text-xl font-black">{gang.name}</div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-3xl font-black text-primary">{odds.toFixed(2)}x</div>
          <div className="text-[10px] uppercase text-muted-foreground">Payout multiplier</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold">{pool.toLocaleString()}</div>
          <div className="text-[10px] uppercase text-muted-foreground">Staked</div>
        </div>
      </div>
    </button>
  );
}