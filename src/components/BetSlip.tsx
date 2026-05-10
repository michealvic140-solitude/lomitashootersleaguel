import { useEffect, useState } from "react";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useConfirm } from "@/components/ConfirmDialog";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ticket, X, ChevronUp, ChevronDown, Trash2, Coins, CheckCircle2, Copy, Share2, ExternalLink, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function BetSlipFab() {
  const { selections, open, setOpen } = useBetSlip();
  const { user } = useAuth();
  if (!user || selections.length === 0) return (
    <FabShell onClick={() => setOpen(true)} count={selections.length} />
  );
  return (
    <>
      <FabShell onClick={() => setOpen(true)} count={selections.length} />
      <BetSlipDrawer open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function FabShell({ onClick, count }: { onClick: () => void; count: number }) {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 md:bottom-6 right-4 z-40 h-14 px-5 rounded-full bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.6)] flex items-center gap-2 font-bold backdrop-blur-xl border border-primary/40 hover:scale-105 active:scale-95 transition animate-in fade-in slide-in-from-bottom-2"
      aria-label={`Open bet slip with ${count} selection${count === 1 ? "" : "s"}`}
    >
      <Ticket className="h-5 w-5" />
      <span className="hidden sm:inline">Bet Slip</span>
      <span className="bg-background/30 text-xs rounded-full h-6 min-w-6 px-2 grid place-items-center font-mono">{count}</span>
    </button>
  );
}

function BetSlipDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selections, remove, clear, reorder, totalOdds, stake, setStake, add } = useBetSlip();
  const { user, profile, refresh } = useAuth();
  const [minStake, setMinStake] = useState(2_000_000);
  const [submitting, setSubmitting] = useState(false);
  const [placed, setPlaced] = useState<any>(null);
  const [codeInput, setCodeInput] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const confirm = useConfirm();
  const nav = useNavigate();

  useEffect(() => {
    supabase.from("app_settings").select("min_stake").eq("id", 1).maybeSingle()
      .then(({ data }) => { if (data?.min_stake) setMinStake(Number(data.min_stake)); });
  }, [open]);

  const payout = Math.floor(stake * totalOdds);

  async function place() {
    if (!user || !profile) { nav({ to: "/login" }); return; }
    if (selections.length === 0) return;
    if (profile.is_restricted) { toast.error("Your account is restricted from betting."); return; }
    if (stake < minStake) { toast.error(`Minimum stake is ${minStake.toLocaleString()} tokens`); return; }
    if (stake > (profile.token_balance ?? 0)) { toast.error("Insufficient balance"); return; }

    const ok = await confirm({
      title: "Confirm bet placement",
      description: `Stake ${stake.toLocaleString()} on ${selections.length} selection(s) at total odds ${totalOdds.toFixed(2)}. Potential payout: ${payout.toLocaleString()} tokens. Tokens will be deducted immediately.`,
      confirmText: "Place Bet",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const { data: bet, error: be } = await supabase.from("bets").insert({
        user_id: user.id, stake, total_odds: totalOdds, potential_payout: payout, status: "open",
      }).select().single();
      if (be) throw be;
      const rows = selections.map((s) => ({
        bet_id: bet.id, match_id: s.match_id, market_id: s.market_id, odd_id: s.odd_id,
        locked_odds: s.odds, selection_label: s.selection_label,
      }));
      const { error: se } = await supabase.from("bet_selections").insert(rows);
      if (se) {
        // rollback bet so we don't leave an orphan
        await supabase.from("bets").delete().eq("id", bet.id);
        throw se;
      }
      // deduct tokens
      await supabase.from("profiles").update({ token_balance: (profile.token_balance ?? 0) - stake }).eq("id", user.id);
      await supabase.from("notifications").insert({ user_id: user.id, title: "Bet placed", body: `Ticket ${bet.tracking_id} · ${stake.toLocaleString()} tokens staked.`, link: `/ticket/${bet.id}` });
      toast.success(`Bet placed! Ticket ${bet.tracking_id}`);
      const snapshot = { ...bet, _selections: selections, _payout: payout };
      clear(); refresh();
      setPlaced(snapshot);
    } catch (e: any) {
      toast.error(e.message || "Failed to place bet");
    } finally { setSubmitting(false); }
  }

  function closeAll() { setPlaced(null); onClose(); }

  async function loadByBookingCode() {
    const code = codeInput.trim().toUpperCase();
    if (!code) return;
    setLoadingCode(true);
    try {
      const { data: bet, error } = await supabase
        .from("bets")
        .select("id, booking_code")
        .eq("booking_code", code)
        .maybeSingle();
      if (error || !bet) { toast.error("Booking code not found"); return; }
      const { data: sels, error: se } = await supabase
        .from("bet_selections")
        .select("match_id, market_id, odd_id, locked_odds, selection_label, markets(name, matches(name))")
        .eq("bet_id", bet.id);
      if (se || !sels?.length) { toast.error("No selections on this code"); return; }
      clear();
      sels.forEach((s: any) => {
        add({
          match_id: s.match_id,
          match_name: s.markets?.matches?.name ?? "Match",
          market_id: s.market_id,
          market_name: s.markets?.name ?? "Market",
          odd_id: s.odd_id,
          selection_label: s.selection_label,
          odds: Number(s.locked_odds),
        });
      });
      setCodeInput("");
      toast.success(`Loaded ${sels.length} selection${sels.length === 1 ? "" : "s"} from ${code}`);
    } finally { setLoadingCode(false); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && closeAll()}>
      <SheetContent side="right" className="flex h-dvh max-h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-md backdrop-blur-2xl bg-card/80 border-l-primary/30">
        <SheetHeader className="shrink-0 px-4 pb-2 pt-5 sm:px-6">
          <SheetTitle className="flex items-center gap-2">
            {placed ? <><CheckCircle2 className="h-5 w-5 text-emerald-400" />Ticket Placed</> : <><Ticket className="h-5 w-5 text-primary" />Bet Slip</>}
          </SheetTitle>
        </SheetHeader>

        {placed ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6">
            <PlacedPreview bet={placed} onView={() => { closeAll(); nav({ to: "/ticket/$id", params: { id: placed.id } }); }} onClose={closeAll} />
          </div>
        ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 sm:px-6">
        <div className="mt-4 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-3">
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Load a booking code
          </label>
          <div className="flex gap-2 mt-1.5">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. A1B2C3D4"
              className="font-mono uppercase tracking-wider h-9"
              onKeyDown={(e) => { if (e.key === "Enter") loadByBookingCode(); }}
            />
            <Button size="sm" variant="outline" disabled={loadingCode || !codeInput.trim()} onClick={loadByBookingCode}>
              <Search className="h-3.5 w-3.5 mr-1" />{loadingCode ? "…" : "Load"}
            </Button>
          </div>
        </div>
        <div className="mt-4 space-y-3 max-h-[38svh] overflow-y-auto pr-1 sm:max-h-[55vh]">
          {selections.length === 0 && <p className="text-sm text-muted-foreground">No selections yet. Tap odds on a match to add.</p>}
          {selections.map((s, i) => (
            <Card key={s.odd_id} className="glass p-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-0.5">
                  <button disabled={i===0} onClick={() => reorder(i, i-1)} className="text-muted-foreground disabled:opacity-30"><ChevronUp className="h-3 w-3" /></button>
                  <button disabled={i===selections.length-1} onClick={() => reorder(i, i+1)} className="text-muted-foreground disabled:opacity-30"><ChevronDown className="h-3 w-3" /></button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{s.match_name}</div>
                  <div className="text-xs text-muted-foreground truncate">{s.market_name} · {s.selection_label}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-bold text-primary">{s.odds.toFixed(2)}</div>
                  <button onClick={() => remove(s.odd_id)} className="text-destructive"><X className="h-4 w-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {selections.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total odds</span>
              <span className="font-bold text-primary">{totalOdds.toFixed(2)}</span>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Stake (min {minStake.toLocaleString()})</label>
              <Input type="number" min={minStake} step={100000} value={stake} onChange={(e) => setStake(Number(e.target.value))} />
              <div className="flex flex-wrap gap-1 mt-1">
                {[minStake, minStake*2, minStake*5, profile?.token_balance ?? 0].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map((v) => (
                  <button key={v} onClick={() => setStake(v)} className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-primary/20">{v === (profile?.token_balance ?? 0) ? "MAX" : v.toLocaleString()}</button>
                ))}
              </div>
            </div>
            <Card className="glass p-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Potential payout</span>
              <span className="font-bold text-accent flex items-center gap-1"><Coins className="h-3 w-3" />{payout.toLocaleString()}</span>
            </Card>
            <div className="flex gap-2">
              <Button variant="outline" onClick={clear} className="flex-1"><Trash2 className="h-4 w-4 mr-1" />Clear</Button>
              <Button className="btn-luxury flex-1" disabled={submitting} onClick={place}>{submitting ? "Placing…" : "Place Bet"}</Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Tokens are deducted on placement. Cash-out available only after the match ends and your bet wins.</p>
          </div>
        )}
        </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function PlacedPreview({ bet, onView, onClose }: { bet: any; onView: () => void; onClose: () => void }) {
  const sels = bet._selections ?? [];
  function copy(t: string) { navigator.clipboard.writeText(t); toast.success("Copied"); }
  async function share() {
    const url = `${window.location.origin}/?code=${bet.booking_code}`;
    if (navigator.share) { try { await navigator.share({ title: `LSL Booking ${bet.booking_code}`, url }); return; } catch {/*ignore*/} }
    navigator.clipboard.writeText(url); toast.success("Share link copied");
  }
  return (
    <div className="mt-4 space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 p-5 text-center bg-gradient-to-br from-primary/20 via-accent/10 to-emerald-500/10 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.25),transparent_60%)] pointer-events-none" />
        <div className="absolute -top-px left-8 right-8 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="relative">
          <div className="mx-auto h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 grid place-items-center shadow-lg shadow-emerald-500/30 mb-3">
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Ticket Booked</div>
          <div className="font-extrabold text-xl gradient-gold-text mt-1 tracking-wider">{bet.tracking_id}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => copy(bet.booking_code)} className="group rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 p-3 text-left hover:border-primary/50 transition">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Booking Code</div>
          <div className="font-mono font-extrabold text-base inline-flex items-center gap-1 mt-0.5">{bet.booking_code}<Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" /></div>
        </button>
        <div className="rounded-xl bg-gradient-to-br from-muted/60 to-muted/20 border border-border/50 p-3">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Stake</div>
          <div className="font-bold mt-0.5">{Number(bet.stake).toLocaleString()}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-primary/15 to-transparent border border-primary/20 p-3">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Total Odds</div>
          <div className="font-bold text-primary mt-0.5">{Number(bet.total_odds).toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-500/15 via-accent/10 to-transparent border border-amber-500/30 p-3">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">Potential Payout</div>
          <div className="font-extrabold gradient-gold-text mt-0.5">{Number(bet._payout ?? bet.potential_payout).toLocaleString()}</div>
        </div>
      </div>
      <div className="space-y-2 max-h-[28vh] overflow-y-auto pr-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selections ({sels.length})</div>
        {sels.map((s: any) => (
          <div key={s.odd_id} className="rounded-lg border border-border/60 bg-gradient-to-r from-background/60 to-muted/20 p-2.5 text-xs">
            <div className="font-bold truncate">{s.match_name}</div>
            <div className="text-muted-foreground truncate flex items-center justify-between gap-2 mt-0.5">
              <span className="truncate">{s.market_name} · {s.selection_label}</span>
              <span className="text-primary font-mono font-bold shrink-0">{Number(s.odds).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={share}><Share2 className="h-4 w-4 mr-1" />Share</Button>
        <Button className="btn-luxury" onClick={onView}><ExternalLink className="h-4 w-4 mr-1" />View Ticket</Button>
      </div>
      <Button variant="ghost" className="w-full" onClick={onClose}>Close</Button>
    </div>
  );
}
