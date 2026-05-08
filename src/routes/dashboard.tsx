import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — LSL" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user, profile } = useAuth();
  const [bets, setBets] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    supabase.from("bets").select("*, bet_selections(*)").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setBets(data ?? []));
  }, [user?.id]);

  if (!user) return <Layout><div className="container mx-auto px-4 py-16 text-center"><p>Please <Link to="/login" className="text-primary underline">sign in</Link>.</p></div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold text-primary mb-6">Your Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-5"><div className="text-xs text-muted-foreground">Token Balance</div><div className="text-3xl font-bold text-primary">{profile?.token_balance.toLocaleString() ?? 0}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Active Bets</div><div className="text-3xl font-bold">{bets.filter(b => b.status === 'open').length}</div></Card>
          <Card className="p-5"><div className="text-xs text-muted-foreground">Total Bets</div><div className="text-3xl font-bold">{bets.length}</div></Card>
        </div>
        <h2 className="text-xl font-bold mb-4">Bet History</h2>
        <div className="space-y-3">
          {bets.length === 0 && <p className="text-muted-foreground text-sm">No bets yet.</p>}
          {bets.map((b) => (
            <Link key={b.id} to="/ticket/$id" params={{ id: b.id }}>
              <Card className="p-4 hover:border-primary/50 transition">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="font-mono text-xs text-muted-foreground">{b.tracking_id}</div>
                    <div className="font-bold">{b.bet_selections?.length ?? 0} selections · stake {b.stake.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{b.status}</Badge>
                    <div className="text-xs text-muted-foreground mt-1">Payout {b.potential_payout.toLocaleString()}</div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
