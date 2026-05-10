import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmDialog";
import { Search, Ban, Pause, Play, RotateCcw, Trash2, Hash, User2, Coins, TrendingUp, Loader2, Radio, RefreshCw, ListChecks } from "lucide-react";

type Selection = {
  id: string;
  selection_label: string;
  locked_odds: number;
  result: string | null;
  match_id: string | null;
};

type Bet = {
  id: string;
  user_id: string;
  tracking_id: string;
  bet_tracker?: string | null;
  booking_code: string;
  stake: number;
  total_odds: number;
  potential_payout: number;
  status: string;
  created_at: string;
  settled_at: string | null;
  bet_selections: Selection[];
  profiles?: { full_name: string | null; email: string | null } | null;
};

const BET_SELECT = "id,user_id,tracking_id,bet_tracker,booking_code,stake,total_odds,potential_payout,status,created_at,settled_at, bet_selections(id,selection_label,locked_odds,result,match_id, markets:market_id(name), matches:match_id(name,status,home_score,away_score))";

const fmt = (n: number) => new Intl.NumberFormat().format(n);

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    suspended: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    won: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    lost: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    cashed_out: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return <Badge variant="outline" className={map[status] ?? ""}>{status}</Badge>;
}

export function TicketTrackerPanel() {
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bet, setBet] = useState<Bet | null>(null);
  const [recent, setRecent] = useState<Bet[]>([]);
  const [reason, setReason] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [feedSearch, setFeedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadRecent() {
    setRefreshing(true);
    const { data } = await supabase
      .from("bets")
      .select(BET_SELECT)
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) {
      const userIds = [...new Set(data.map((b: any) => b.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", userIds);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p]));
      setRecent(data.map((b: any) => ({ ...b, profiles: map.get(b.user_id) ?? null })));
    }
    setRefreshing(false);
  }

  useEffect(() => {
    loadRecent();
    const ch = supabase
      .channel("admin-tracker-bets")
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => loadRecent())
      .on("postgres_changes", { event: "*", schema: "public", table: "bet_selections" }, () => { loadRecent(); if (bet) refresh(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [bet?.id]);

  const filteredRecent = useMemo(() => {
    const q = feedSearch.trim().toLowerCase();
    return recent.filter((b) => {
      const statusOk = statusFilter === "all" || b.status === statusFilter;
      const textOk = !q || [b.tracking_id, b.bet_tracker, b.booking_code, b.profiles?.full_name, b.profiles?.email]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
      return statusOk && textOk;
    });
  }, [recent, feedSearch, statusFilter]);

  async function lookup(idOrCode?: string) {
    const term = (idOrCode ?? query).trim();
    if (!term) return;
    setLoading(true);
    setBet(null);
    try {
      const { data, error } = await supabase
        .from("bets")
        .select("id,user_id,tracking_id,booking_code,stake,total_odds,potential_payout,status,created_at,settled_at, bet_selections(id,selection_label,locked_odds,result,match_id)")
        .or(`tracking_id.eq.${term},booking_code.eq.${term},id.eq.${term.replace(/[^0-9a-f-]/gi, "") || "00000000-0000-0000-0000-000000000000"}`)
        .maybeSingle();
      if (error || !data) { toast.error("Ticket not found"); return; }
      const { data: prof } = await supabase.from("profiles").select("full_name,email").eq("id", data.user_id).maybeSingle();
      setBet({ ...(data as any), profiles: prof });
    } finally {
      setLoading(false);
    }
  }

  async function refresh() { if (bet) await lookup(bet.tracking_id); }

  async function voidSelection(sel: Selection) {
    const ok = await confirm({
      title: "Void this selection?",
      description: `This marks "${sel.selection_label}" as void and recalculates odds. The user will be notified.`,
      confirmText: "Void selection",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("admin_void_selection", { _selection_id: sel.id, _reason: reason || undefined });
    if (error) return toast.error(error.message);
    toast.success("Selection voided");
    await refresh();
  }

  async function suspend() {
    if (!bet) return;
    const ok = await confirm({ title: "Suspend ticket?", description: "User won't be paid out until you unsuspend.", confirmText: "Suspend" });
    if (!ok) return;
    const { error } = await supabase.rpc("admin_suspend_bet", { _bet_id: bet.id, _reason: reason || undefined });
    if (error) return toast.error(error.message);
    toast.success("Ticket suspended"); await refresh();
  }

  async function unsuspend() {
    if (!bet) return;
    const { error } = await supabase.rpc("admin_unsuspend_bet", { _bet_id: bet.id });
    if (error) return toast.error(error.message);
    toast.success("Ticket re-opened"); await refresh();
  }

  async function refund() {
    if (!bet) return;
    const ok = await confirm({
      title: "Refund ticket?",
      description: `Stake of ${fmt(bet.stake)} tokens will be credited back to the user. Ticket will be closed.`,
      confirmText: "Refund",
      tone: "danger",
    });
    if (!ok) return;
    const { error } = await supabase.rpc("admin_refund_bet", { _bet_id: bet.id, _reason: reason || undefined });
    if (error) return toast.error(error.message);
    toast.success("Ticket refunded"); await refresh();
  }

  async function del() {
    if (!bet) return;
    const ok = await confirm({
      title: "Delete ticket?",
      description: "This permanently removes the ticket. Optionally refund the user's stake.",
      confirmText: "Delete",
      tone: "danger",
    });
    if (!ok) return;
    const refundOk = await confirm({ title: "Refund stake?", description: "Credit the user's stake back?", confirmText: "Yes, refund", cancelText: "No, just delete" });
    const { error } = await supabase.rpc("admin_delete_bet", { _bet_id: bet.id, _refund: refundOk, _reason: reason || undefined });
    if (error) return toast.error(error.message);
    toast.success("Ticket deleted"); setBet(null); await loadRecent();
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3 bg-gradient-to-br from-card to-card/60 border-accent/20">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-accent" />
          <h3 className="font-semibold">Ticket Tracker</h3>
          <Badge variant="outline" className="ml-auto text-[10px]">Live</Badge>
        </div>
        <p className="text-xs text-muted-foreground">Paste a tracking ID (e.g. <code>LSL-XXXXXXXXXX</code>), booking code, or bet UUID.</p>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="LSL-XXXXXXXXXX or booking code"
            onKeyDown={(e) => e.key === "Enter" && lookup()}
            className="font-mono"
          />
          <Button onClick={() => lookup()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      {bet && (
        <Card className="p-5 space-y-4 bg-gradient-to-br from-card via-card to-accent/5 border-accent/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span className="font-mono">{bet.tracking_id}</span>
                <span className="opacity-50">·</span>
                <span className="font-mono">{bet.booking_code}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{bet.profiles?.full_name ?? "Unknown"}</span>
                <span className="text-xs text-muted-foreground">{bet.profiles?.email ?? ''}</span>
              </div>
            </div>
            <StatusBadge status={bet.status} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg border border-border/50 bg-background/40 p-2">
              <div className="text-muted-foreground flex items-center justify-center gap-1"><Coins className="h-3 w-3" />Stake</div>
              <div className="font-bold mt-0.5">{fmt(bet.stake)}</div>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/40 p-2">
              <div className="text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-3 w-3" />Odds</div>
              <div className="font-bold mt-0.5">{Number(bet.total_odds).toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2">
              <div className="text-muted-foreground">Payout</div>
              <div className="font-bold mt-0.5 text-amber-300">{fmt(bet.potential_payout)}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selections</div>
            {bet.bet_selections.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border/40 bg-background/30 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{s.selection_label}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                    <span>@ {Number(s.locked_odds).toFixed(2)}</span>
                    {s.result && <Badge variant="outline" className="text-[9px] py-0">{s.result}</Badge>}
                  </div>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => voidSelection(s)} disabled={s.result === "void"}>
                  <Ban className="h-3 w-3 mr-1" />Void
                </Button>
              </div>
            ))}
          </div>

          <Textarea
            placeholder="Reason (sent to user as notification)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="text-sm"
          />

          <div className="flex flex-wrap gap-2">
            {bet.status === "suspended" ? (
              <Button size="sm" variant="outline" onClick={unsuspend}><Play className="h-3.5 w-3.5 mr-1" />Unsuspend</Button>
            ) : (
              <Button size="sm" variant="outline" onClick={suspend} disabled={bet.status !== "open"}><Pause className="h-3.5 w-3.5 mr-1" />Suspend</Button>
            )}
            <Button size="sm" variant="outline" onClick={refund} disabled={!["open","suspended"].includes(bet.status)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />Refund
            </Button>
            <Button size="sm" variant="destructive" onClick={del}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">Live feed</h3>
          <Badge variant="outline" className="text-[10px]">Last 20</Badge>
        </div>
        <div className="space-y-1.5 max-h-[420px] overflow-auto">
          {recent.map((b) => (
            <button
              key={b.id}
              onClick={() => { setQuery(b.tracking_id); lookup(b.tracking_id); }}
              className="w-full text-left flex items-center gap-2 rounded-md border border-border/40 bg-background/30 px-3 py-2 text-xs hover:bg-accent/5 transition"
            >
              <span className="font-mono text-[10px] text-muted-foreground">{b.tracking_id}</span>
              <span className="truncate flex-1">{b.profiles?.full_name ?? "—"}</span>
              <span className="font-semibold">{fmt(b.stake)}</span>
              <StatusBadge status={b.status} />
            </button>
          ))}
          {recent.length === 0 && <p className="text-xs text-muted-foreground">No bets yet.</p>}
        </div>
      </Card>
    </div>
  );
}