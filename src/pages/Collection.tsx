import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { StickerCard } from "@/components/StickerCard";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { NATIONS } from "@/lib/nations";
import { toast } from "sonner";

type Sticker = { id: number; code: string; nation: string; slot_type: string };
type Status = "none" | "need" | "duplicate";

export default function Collection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");
  const [activeNation, setActiveNation] = useState<string | null>(null);

  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stickers").select("*").order("id").limit(1100);
      if (error) throw error;
      return data as Sticker[];
    },
  });

  const { data: mine = [] } = useQuery({
    enabled: !!user,
    queryKey: ["my-stickers", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_stickers").select("sticker_id,status").eq("user_id", user!.id).limit(1100);
      if (error) throw error;
      return data as { sticker_id: number; status: "need" | "duplicate" }[];
    },
  });

  const statusMap = useMemo(() => {
    const m = new Map<number, Status>();
    mine.forEach((r) => m.set(r.sticker_id, r.status));
    return m;
  }, [mine]);

  const filtered = useMemo(() => {
    return stickers.filter((s) => {
      if (activeNation && s.nation !== activeNation) return false;
      if (filter && !s.code.toLowerCase().includes(filter.toLowerCase())) return false;
      return true;
    });
  }, [stickers, filter, activeNation]);

  const grouped = useMemo(() => {
    const g: Record<string, Sticker[]> = {};
    filtered.forEach((s) => { (g[s.nation] ||= []).push(s); });
    return g;
  }, [filtered]);

  const cycle = async (s: Sticker) => {
    if (!user) return;
    const cur = statusMap.get(s.id) ?? "none";
    const next: Status = cur === "none" ? "need" : cur === "need" ? "duplicate" : "none";
    if (next === "none") {
      await supabase.from("user_stickers").delete().eq("user_id", user.id).eq("sticker_id", s.id);
    } else {
      await supabase.from("user_stickers").upsert({ user_id: user.id, sticker_id: s.id, status: next });
    }
    qc.invalidateQueries({ queryKey: ["my-stickers", user.id] });
  };

  const total = stickers.length;
  const marked = mine.length;
  const needs = mine.filter(m => m.status === "need").length;
  const dups = mine.filter(m => m.status === "duplicate").length;

  useEffect(() => { if (user && stickers.length && !mine.length) toast.info("Tap a card: Need → Duplicate → clear"); }, [user, stickers.length]);

  return (
    <AppShell>
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b border-border p-3 space-y-2">
        <div>
          <h1 className="text-lg font-black">My Collection</h1>
          <p className="text-xs text-muted-foreground">{marked}/{total} marked · {needs} need · {dups} dup</p>
        </div>
        <Progress value={(marked / Math.max(total,1)) * 100} className="h-1.5" />
        <Input placeholder="Search e.g. ARG 10" value={filter} onChange={(e)=>setFilter(e.target.value)} />
        <div className="flex gap-1 overflow-x-auto -mx-3 px-3 pb-1 scrollbar-none">
          <button onClick={()=>setActiveNation(null)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full ${!activeNation ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>All</button>
          {NATIONS.map(n => (
            <button key={n.code} onClick={()=>setActiveNation(n.code)}
              className={`shrink-0 text-xs px-3 py-1 rounded-full ${activeNation===n.code ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
              {n.flag} {n.code}
            </button>
          ))}
        </div>
      </header>
      <div className="p-3 space-y-4">
        {Object.entries(grouped).map(([nation, list]) => (
          <section key={nation}>
            <h2 className="text-sm font-bold mb-2">{nation} <span className="text-muted-foreground font-normal">· {list.length}</span></h2>
            <div className="grid grid-cols-4 gap-2">
              {list.map(s => (
                <StickerCard key={s.id} code={s.code} nation={s.nation}
                  status={statusMap.get(s.id) ?? "none"} size="sm" onClick={()=>cycle(s)} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}