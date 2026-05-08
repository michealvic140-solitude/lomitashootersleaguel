import { Link } from "@tanstack/react-router";
import { Coins, Clock, CircleDot } from "lucide-react";

type Gang = { id: string; name: string; tag: string; color: string };
export type MatchWithGangs = {
  id: string;
  title: string;
  status: "open" | "live" | "closed" | "resolved" | "cancelled";
  scheduled_at: string;
  pool_a: number;
  pool_b: number;
  winner_gang_id: string | null;
  gang_a: Gang;
  gang_b: Gang;
};

export function MatchCard({ match }: { match: MatchWithGangs }) {
  const total = match.pool_a + match.pool_b;
  const oddsA = total > 0 ? total / Math.max(match.pool_a, 1) : 2;
  const oddsB = total > 0 ? total / Math.max(match.pool_b, 1) : 2;

  return (
    <Link
      to="/matches/$matchId"
      params={{ matchId: match.id }}
      className="group block rounded-xl border border-border/60 bg-card p-5 transition-all hover:border-primary/50 hover:shadow-[var(--shadow-card)]"
    >
      <div className="mb-3 flex items-center justify-between">
        <StatusBadge status={match.status} />
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="size-3" />
          {new Date(match.scheduled_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <h3 className="mb-4 line-clamp-1 font-bold">{match.title}</h3>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <GangSide gang={match.gang_a} odds={oddsA} pool={match.pool_a} winner={match.winner_gang_id === match.gang_a.id} />
        <div className="text-xs font-black uppercase text-muted-foreground">vs</div>
        <GangSide gang={match.gang_b} odds={oddsB} pool={match.pool_b} winner={match.winner_gang_id === match.gang_b.id} align="right" />
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Coins className="size-3" /> Pool</span>
        <span className="font-bold text-foreground">{total.toLocaleString()}</span>
      </div>
    </Link>
  );
}

function GangSide({ gang, odds, pool, winner, align = "left" }: { gang: Gang; odds: number; pool: number; winner?: boolean; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className={`mb-1 flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
        <span className="size-2.5 rounded-full" style={{ backgroundColor: gang.color }} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{gang.tag}</span>
        {winner && <span className="text-[10px] font-bold text-success">★</span>}
      </div>
      <div className="text-sm font-bold leading-tight">{gang.name}</div>
      <div className="mt-1 text-lg font-black text-primary">{odds.toFixed(2)}x</div>
      <div className="text-[10px] text-muted-foreground">{pool.toLocaleString()} staked</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon?: React.ReactNode }> = {
    open: { label: "Open", cls: "bg-success/15 text-success border-success/30" },
    live: { label: "Live", cls: "bg-destructive/15 text-destructive border-destructive/30 animate-pulse", icon: <CircleDot className="size-2.5" /> },
    closed: { label: "Closed", cls: "bg-muted text-muted-foreground border-border" },
    resolved: { label: "Resolved", cls: "bg-primary/15 text-primary border-primary/30" },
    cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status] ?? map.open;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}