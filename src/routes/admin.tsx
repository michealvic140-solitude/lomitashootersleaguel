import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin — GangBet" }] }),
});

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();

  const { data: gangs } = useQuery({
    queryKey: ["admin-gangs"],
    queryFn: async () => (await supabase.from("gangs").select("*").order("name")).data ?? [],
  });
  const { data: matches } = useQuery({
    queryKey: ["admin-matches"],
    queryFn: async () => (await supabase.from("matches").select("*, gang_a:gangs!matches_gang_a_id_fkey(*), gang_b:gangs!matches_gang_b_id_fkey(*)").order("created_at", { ascending: false })).data ?? [],
  });

  if (loading) return <div className="container mx-auto p-10 text-center text-muted-foreground">Loading…</div>;
  if (!isAdmin) return (
    <div className="container mx-auto p-10 text-center">
      <p className="mb-2 font-bold">Admin access required</p>
      <Link to="/" className="text-sm text-primary hover:underline">Go home</Link>
    </div>
  );

  const createGang = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("gangs").insert({
      name: String(fd.get("name")), tag: String(fd.get("tag")), description: String(fd.get("description") || "") || null, color: String(fd.get("color") || "#ef4444"),
    });
    if (error) return toast.error(error.message);
    toast.success("Gang created");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["admin-gangs"] });
    qc.invalidateQueries({ queryKey: ["gangs"] });
  };

  const createMatch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const a = String(fd.get("gang_a")); const b = String(fd.get("gang_b"));
    if (a === b) return toast.error("Pick two different gangs");
    const { error } = await supabase.from("matches").insert({
      title: String(fd.get("title")), description: String(fd.get("description") || "") || null,
      gang_a_id: a, gang_b_id: b,
      scheduled_at: String(fd.get("scheduled_at") || new Date().toISOString()),
    });
    if (error) return toast.error(error.message);
    toast.success("Match created");
    (e.target as HTMLFormElement).reset();
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
    qc.invalidateQueries({ queryKey: ["featured-matches"] });
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("matches").update({ status: status as any }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
  };
  const resolve = async (id: string, winner: string) => {
    const { error } = await supabase.rpc("resolve_match", { _match_id: id, _winner_gang_id: winner });
    if (error) return toast.error(error.message);
    toast.success("Match resolved & payouts sent");
    qc.invalidateQueries({ queryKey: ["admin-matches"] });
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-black uppercase">Admin Dashboard</h1>
      <Tabs defaultValue="matches">
        <TabsList><TabsTrigger value="matches">Matches</TabsTrigger><TabsTrigger value="gangs">Gangs</TabsTrigger></TabsList>

        <TabsContent value="matches" className="mt-4 space-y-6">
          <form onSubmit={createMatch} className="rounded-xl border border-border/60 bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase"><Plus className="size-4" /> New match</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" name="title" required />
              <Field label="Scheduled at" name="scheduled_at" type="datetime-local" />
              <div>
                <Label>Gang A</Label>
                <select name="gang_a" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {gangs?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Gang B</Label>
                <select name="gang_b" required className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {gangs?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2"><Label>Description</Label><Textarea name="description" rows={2} /></div>
            </div>
            <Button type="submit" className="mt-3 font-bold uppercase">Create match</Button>
          </form>

          <div className="rounded-xl border border-border/60 bg-card">
            <div className="border-b border-border/60 p-4 text-sm font-black uppercase">All matches</div>
            <ul className="divide-y divide-border/60">
              {matches?.map((m: any) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{m.title}</div>
                    <div className="text-xs text-muted-foreground">{m.gang_a?.name} vs {m.gang_b?.name} · pool {(m.pool_a + m.pool_b).toLocaleString()}</div>
                  </div>
                  <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-bold uppercase">{m.status}</span>
                  <div className="flex gap-2">
                    {m.status !== "resolved" && (
                      <Select onValueChange={(v) => setStatus(m.id, v)}>
                        <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="live">Live</SelectItem>
                          <SelectItem value="closed">Closed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {m.status !== "resolved" && (
                      <Select onValueChange={(v) => resolve(m.id, v)}>
                        <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Set winner" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={m.gang_a_id}>🏆 {m.gang_a?.tag}</SelectItem>
                          <SelectItem value={m.gang_b_id}>🏆 {m.gang_b?.tag}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {m.status === "resolved" && <span className="flex items-center gap-1 text-xs text-success"><Trophy className="size-3" /> Done</span>}
                  </div>
                </li>
              ))}
              {!matches?.length && <li className="p-8 text-center text-sm text-muted-foreground">No matches yet.</li>}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="gangs" className="mt-4 space-y-6">
          <form onSubmit={createGang} className="rounded-xl border border-border/60 bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-black uppercase"><Plus className="size-4" /> New gang</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" name="name" required />
              <Field label="Tag (3-5 chars)" name="tag" required maxLength={5} />
              <Field label="Color (hex)" name="color" type="color" defaultValue="#ef4444" />
              <div className="sm:col-span-2"><Label>Description</Label><Textarea name="description" rows={2} /></div>
            </div>
            <Button type="submit" className="mt-3 font-bold uppercase">Create gang</Button>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            {gangs?.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                <span className="size-8 rounded-full" style={{ backgroundColor: g.color }} />
                <div className="flex-1"><div className="font-bold">{g.name}</div><div className="text-xs text-muted-foreground">{g.tag} · {g.wins}W / {g.losses}L</div></div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (<div><Label htmlFor={props.name}>{label}</Label><Input id={props.name} {...props} className="mt-1" /></div>);
}