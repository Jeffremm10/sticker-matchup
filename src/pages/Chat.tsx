import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";

type Msg = { id: string; sender_id: string; body: string; created_at: string };

export default function Chat() {
  const { id: matchId } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    enabled: !!matchId,
    queryKey: ["messages", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("match_id", matchId!).order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`messages:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => {
          qc.setQueryData(["messages", matchId], (old: Msg[] = []) => [...old, payload.new as Msg]);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const send = async () => {
    if (!text.trim() || !user || !matchId) return;
    const body = text.trim();
    setText("");
    await supabase.from("messages").insert({ match_id: matchId, sender_id: user.id, body });
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background">
      <header className="flex items-center gap-2 p-3 border-b border-border bg-card sticky top-0">
        <Button variant="ghost" size="icon" onClick={()=>nav("/matches")}><ArrowLeft/></Button>
        <h1 className="font-bold">Trade Chat</h1>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map(m => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {m.body}
              </div>
            </div>
          );
        })}
        <div ref={endRef}/>
      </div>
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <Input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()} placeholder="Message…"/>
        <Button onClick={send}><Send className="w-4 h-4"/></Button>
      </div>
    </div>
  );
}