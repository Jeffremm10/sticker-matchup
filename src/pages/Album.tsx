import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { AlbumBook } from "@/components/album/AlbumBook";
import { AlbumGrid } from "@/components/album/AlbumGrid";
import { QuickEntryKeypad } from "@/components/album/QuickEntryKeypad";
import { Progress } from "@/components/ui/progress";
import { useInventory } from "@/hooks/useInventory";
import { LayoutGrid, BookOpen, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/useProfile";

type Sticker = { id: number; code: string; nation: string };

export default function Album() {
  const [view, setView] = useState<"book" | "grid">("book");
  const { data: profile } = useProfile();
  const { inventory, cycle, set } = useInventory();

  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers", "v3-tournament-980"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stickers").select("id,code,nation,seq").order("seq").limit(1100);
      if (error) throw error;
      return data as Sticker[];
    },
  });

  const stats = useMemo(() => {
    let owned = 0, dup = 0;
    inventory.forEach((s) => { if (s === "owned") owned++; else dup++; });
    return { owned, dup, total: stickers.length };
  }, [inventory, stickers.length]);

  return (
    <AppShell>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-black">The 26 Album</h1>
            <p className="text-xs text-muted-foreground">
              Hi {profile?.username ?? "collector"} · {stats.owned}/{stats.total} owned · {stats.dup} dup
            </p>
          </div>
          <div className="flex items-center gap-1 bg-secondary rounded-full p-1">
            <button onClick={() => setView("book")}
              className={`p-2 rounded-full ${view === "book" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <BookOpen className="w-4 h-4" />
            </button>
            <button onClick={() => setView("grid")}
              className={`p-2 rounded-full ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <Button variant="ghost" size="icon" onClick={() => supabase.auth.signOut()}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <Progress value={(stats.owned / Math.max(stats.total, 1)) * 100} className="h-1.5" />
      </header>

      <div className="p-3">
        {view === "book"
          ? <AlbumBook stickers={stickers} inventory={inventory} onTap={cycle} />
          : <AlbumGrid stickers={stickers} inventory={inventory} onTap={cycle} />}
      </div>

      <QuickEntryKeypad stickers={stickers} inventory={inventory} onSet={set} max={stickers.length || 650} />
    </AppShell>
  );
}
