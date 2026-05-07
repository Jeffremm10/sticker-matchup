import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { MessageCircle, Zap, Heart, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

export default function Matches() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();

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

  const { data: superSwaps = [] } = useQuery({
    enabled: !!user,
    queryKey: ["super-swaps", user?.id],
    queryFn: async () => {
      const { data: msgs } = await supabase
        .from("super_swap_messages" as any)
        .select("*")
        .eq("receiver_id", user!.id)
        .order("created_at", { ascending: false });
      if (!msgs?.length) return [];

      // Exclude senders already matched
      const { data: matches } = await supabase.from("matches").select("user_a,user_b")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`);
      const matchedIds = new Set((matches ?? []).map((m: any) => m.user_a === user!.id ? m.user_b : m.user_a));
      const filtered = msgs.filter((m: any) => !matchedIds.has(m.sender_id));

      if (!filtered.length) return [];
      const senderIds = Array.from(new Set(filtered.map((m: any) => m.sender_id)));
      const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", senderIds);
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return filtered.map((m: any) => ({ ...m, sender: pmap.get(m.sender_id) }));
    },
  });

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4">
      <header className="py-4"><h1 className="text-xl font-black">Matches</h1></header>
      <Tabs defaultValue="matches" className="">
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="matches">Matches</TabsTrigger>
          <TabsTrigger value="direct" className="relative">
            <Zap className="w-3 h-3 mr-1 text-blue-500" /> Direct
            {superSwaps.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white rounded-full text-[10px] w-4 h-4 flex items-center justify-center">
                {superSwaps.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matches" className="divide-y divide-border -mx-4 mt-2">
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
        </TabsContent>

        <TabsContent value="direct" className="space-y-2 mt-2">
          {superSwaps.length === 0 && (
            <div className="p-12 text-center text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No Super Swap messages yet.</p>
            </div>
          )}
          {superSwaps.map((m: any) => (
            <div key={m.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{m.sender?.display_name ?? "Collector"}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>

              <p className="text-sm bg-muted rounded-xl px-3 py-2">{m.body}</p>

              <div className="flex gap-2">
                <Button
                  size="sm" variant="outline"
                  className="flex-1 border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600"
                  onClick={async () => {
                    await supabase.rpc("record_swipe", { _receiver: m.sender_id, _direction: "dislike" });
                    qc.setQueryData(["super-swaps", user?.id], (old: any[]) => old.filter(s => s.id !== m.id));
                    toast.info("Passed");
                  }}>
                  <X className="w-4 h-4 mr-1" /> Pass
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-gradient-to-r from-primary to-primary/80"
                  onClick={async () => {
                    const { data, error } = await supabase.rpc("record_swipe", { _receiver: m.sender_id, _direction: "like" });
                    if (error) { toast.error(error.message); return; }
                    const r = (data as any)?.[0];
                    qc.setQueryData(["super-swaps", user?.id], (old: any[]) => old.filter(s => s.id !== m.id));
                    if (r?.matched) {
                      toast.success(`Matched with ${m.sender?.display_name}!`);
                      qc.invalidateQueries({ queryKey: ["matches", user?.id] });
                      nav(`/chat/${r.match_id}`);
                    } else {
                      toast.success("Liked! You'll match if they like you back.");
                    }
                  }}>
                  <Heart className="w-4 h-4 mr-1" /> Like back
                </Button>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>
      </div>
    </AppShell>
  );
}