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
import { Ticket, X, ChevronUp, ChevronDown, Trash2, Coins } from "lucide-react";
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
    <button onClick={onClick}
      className="fixed bottom-24 md:bottom-6 right-4 z-40 h-14 px-5 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-2xl flex items-center gap-2 font-bold backdrop-blur-xl border border-primary/30 hover:scale-105 transition">
      <Ticket className="h-5 w-5" />
      <span>Bet Slip</span>
      <span className="bg-background/30 text-xs rounded-full h-6 min-w-6 px-2 grid place-items-center">{count}</span>
    </button>
  );
}

function BetSlipDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { selections, remove, clear, reorder, totalOdds, stake, setStake } = useBetSlip();
  const { user, profile, refresh } = useAuth();
  const [minStake, setMinStake] = useState(2_000_000);
  const [submitting, setSubmitting] = useState(false);
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
      if (se) throw se;
      // deduct tokens
      await supabase.from("profiles").update({ token_balance: (profile.token_balance ?? 0) - stake }).eq("id", user.id);
      await supabase.from("notifications").insert({ user_id: user.id, title: "Bet placed", body: `Ticket ${bet.tracking_id} · ${stake.toLocaleString()} tokens staked.`, link: `/ticket/${bet.id}` });
      toast.success("Bet placed!");
      clear(); refresh(); onClose();
      nav({ to: "/ticket/$id", params: { id: bet.id } });
    } catch (e: any) {
      toast.error(e.message || "Failed to place bet");
    } finally { setSubmitting(false); }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md backdrop-blur-2xl bg-card/80 border-l-primary/30">
        <SheetHeader><SheetTitle className="flex items-center gap-2"><Ticket className="h-5 w-5 text-primary" />Bet Slip</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-3 max-h-[55vh] overflow-y-auto pr-1">
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
      </SheetContent>
    </Sheet>
  );
}
