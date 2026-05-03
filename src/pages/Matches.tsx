import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { MessageCircle } from "lucide-react";

export default function Matches() {
  const { user } = useAuth();

  const { data = [] } = useQuery({
    enabled: !!user,
    queryKey: ["matches", user?.id],
    queryFn: async () => {
      const { data: matches } = await supabase.from("matches").select("*")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`).order("created_at", { ascending: false });
      if (!matches?.length) return [];
      const otherIds = matches.map(m => m.user_a === user!.id ? m.user_b : m.user_a);
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", otherIds);
      const pmap = new Map((profs ?? []).map((p:any) => [p.id, p]));
      return matches.map(m => ({
        id: m.id,
        other: pmap.get(m.user_a === user!.id ? m.user_b : m.user_a),
        created_at: m.created_at,
      }));
    },
  });

  return (
    <AppShell>
      <header className="p-4"><h1 className="text-xl font-black">Matches</h1></header>
      <div className="divide-y divide-border">
        {data.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50"/>
            <p>No matches yet. Keep swiping!</p>
          </div>
        )}
        {data.map((m: any) => (
          <Link key={m.id} to={`/chat/${m.id}`} className="flex items-center gap-3 p-4 hover:bg-muted">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary text-primary-foreground flex items-center justify-center font-black">
              {m.other?.display_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex-1">
              <div className="font-bold">{m.other?.display_name ?? "Collector"}</div>
              <div className="text-xs text-muted-foreground">Tap to chat</div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}