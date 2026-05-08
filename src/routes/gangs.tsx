import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Trophy, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/gangs")({
  component: GangsPage,
  head: () => ({ meta: [{ title: "Gangs — GangBet" }] }),
});

function GangsPage() {
  const { data } = useQuery({
    queryKey: ["gangs"],
    queryFn: async () => {
      const { data } = await supabase.from("gangs").select("*").order("wins", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="container mx-auto px-4 py-10">
      <h1 className="mb-1 text-3xl font-black uppercase">The Gangs</h1>
      <p className="mb-8 text-sm text-muted-foreground">Every crew in the hub. Back the right one.</p>

      {data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((g) => (
            <div key={g.id} className="rounded-xl border border-border/60 bg-card p-5" style={{ borderTop: `3px solid ${g.color}` }}>
              <div className="mb-2 flex items-center gap-2">
                <span className="size-4 rounded-full" style={{ backgroundColor: g.color }} />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{g.tag}</span>
              </div>
              <h3 className="text-xl font-black">{g.name}</h3>
              {g.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{g.description}</p>}
              <div className="mt-4 flex gap-4 border-t border-border/60 pt-3 text-sm">
                <span className="flex items-center gap-1 text-success"><Trophy className="size-4" /> {g.wins} W</span>
                <span className="flex items-center gap-1 text-muted-foreground"><X className="size-4" /> {g.losses} L</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 p-12 text-center text-muted-foreground">
          No gangs yet. Admin can add some.
        </div>
      )}
    </div>
  );
}