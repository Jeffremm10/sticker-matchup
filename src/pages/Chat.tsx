import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, Layers, MapPin } from "lucide-react";
import { DupesShareCard } from "@/components/trade/DupesShareCard";
import { MeetupSelector, MeetupSlotCard } from "@/components/trade/MeetupCard";
import { SwapDashboard } from "@/components/trade/SwapDashboard";
import type { MeetupSlot } from "@/components/trade/MeetupCard";
import { toast } from "sonner";

type Msg = { id: string; sender_id: string; body: string; created_at: string; msg_type: string; meta: any };

export default function Chat() {
  const { id: matchId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: myProfile } = useProfile();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [meetupOpen, setMeetupOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // ── match ─────────────────────────────────────────────────────────────
  const { data: match } = useQuery({
    enabled: !!matchId && !!user,
    queryKey: ["match", matchId],
    queryFn: async () => (await supabase.from("matches").select("*").eq("id", matchId!).single()).data,
  });

  const isUserA = match ? match.user_a === user?.id : false;
  const otherId = match ? (isUserA ? match.user_b : match.user_a) : null;

  const { data: otherProfile } = useQuery({
    enabled: !!otherId,
    queryKey: ["profile", otherId],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", otherId!).maybeSingle()).data,
  });

  // ── compatibility score ───────────────────────────────────────────────
  const { data: compat } = useQuery({
    enabled: !!matchId && !!user,
    queryKey: ["compat", matchId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_match_compatibility", { _match_id: matchId! });
      return data?.[0] as { give_count: number; receive_count: number } | undefined;
    },
  });

  // ── stickers ──────────────────────────────────────────────────────────
  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers-lite"],
    queryFn: async () => (await supabase.from("stickers").select("id,code,nation").limit(1100)).data ?? [],
  });
  const stickerMap = new Map(stickers.map((s: any) => [s.id, s]));

  const { data: myDupeIds = [] } = useQuery({
    enabled: !!user,
    queryKey: ["my_dupes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_inventory")
        .select("sticker_id").eq("user_id", user!.id).eq("status", "duplicate");
      return (data ?? []).map((r: any) => r.sticker_id as number);
    },
  });

  // ── messages ──────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    enabled: !!matchId,
    queryKey: ["messages", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages")
        .select("id,sender_id,body,created_at,msg_type,meta")
        .eq("match_id", matchId!).order("created_at");
      if (error) throw error;
      return data as Msg[];
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`messages:${matchId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (payload) => qc.setQueryData(["messages", matchId], (old: Msg[] = []) => [...old, payload.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  // ── meetup slot ───────────────────────────────────────────────────────
  const { data: meetupSlot } = useQuery<MeetupSlot | null>({
    enabled: !!matchId,
    queryKey: ["meetup_slot", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("meetup_slots")
        .select("*").eq("match_id", matchId!).neq("status", "cancelled")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data as MeetupSlot | null;
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`meetup:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_slots", filter: `match_id=eq.${matchId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["meetup_slot", matchId] });
          qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  // ── swap session ──────────────────────────────────────────────────────
  const { data: swapSession } = useQuery({
    enabled: !!matchId && meetupSlot?.status === "confirmed",
    queryKey: ["swap_session", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("swap_sessions")
        .select("*").eq("match_id", matchId!).maybeSingle();
      if (!data) {
        // create session on first load after meetup confirmed
        const { data: created } = await supabase.from("swap_sessions")
          .insert({ match_id: matchId, pin: "" })
          .select().single();
        return created;
      }
      return data;
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`session:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "swap_sessions", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: ["swap_session", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  // ── actions ───────────────────────────────────────────────────────────
  const send = async () => {
    if (!text.trim() || !user || !matchId) return;
    const body = text.trim();
    setText("");
    await supabase.from("messages").insert({ match_id: matchId, sender_id: user.id, body });
  };

  const shareDupes = async () => {
    if (!user || !matchId) return;
    if (myDupeIds.length === 0) { toast.error("You have no duplicates marked yet."); return; }
    await supabase.from("messages").insert({
      match_id: matchId, sender_id: user.id,
      body: `📦 Shared ${myDupeIds.length} duplicates`,
      msg_type: "dupes_share",
      meta: { sticker_ids: myDupeIds },
    });
  };

  const myDupeStickers = stickers.filter((s: any) => myDupeIds.includes(s.id));
  const hasMeetup = !!meetupSlot;
  const canSuggestMeetup = !hasMeetup || meetupSlot?.status === "cancelled";

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background">
      {/* header */}
      <header className="flex items-center gap-2 p-3 border-b border-border bg-card sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={() => nav("/matches")}><ArrowLeft/></Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold leading-none truncate">{otherProfile?.display_name ?? "Trade Chat"}</h1>
          {compat && (
            <p className="text-[11px] text-muted-foreground">
              <span className="text-get font-bold">+{compat.receive_count}</span> you need ·{" "}
              <span className="text-give font-bold">−{compat.give_count}</span> you can give
            </p>
          )}
        </div>
      </header>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* meetup card — pinned above chat */}
        {meetupSlot && (
          <MeetupSlotCard slot={meetupSlot} myId={user!.id} matchId={matchId!} />
        )}

        {/* live swap dashboard — once meetup confirmed */}
        {swapSession && meetupSlot?.status === "confirmed" && (
          <SwapDashboard
            session={swapSession}
            matchId={matchId!}
            myId={user!.id}
            isUserA={isUserA}
            otherName={otherProfile?.display_name ?? "them"}
          />
        )}

        {messages.map((m) => {
          const mine = m.sender_id === user?.id;

          if (m.msg_type === "dupes_share") {
            const ids: number[] = m.meta?.sticker_ids ?? [];
            const stks = ids.map((id) => stickerMap.get(id)).filter(Boolean) as any[];
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <DupesShareCard
                  stickers={stks}
                  senderName={mine ? "You" : (otherProfile?.display_name ?? "them")}
                  isMe={mine}
                />
              </div>
            );
          }

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

      {/* toolbar */}
      <div className="border-t border-border bg-card">
        <div className="flex gap-2 px-3 pt-2">
          <Button size="sm" variant="outline" onClick={shareDupes} className="text-xs gap-1">
            <Layers className="w-3.5 h-3.5"/> Share dupes
          </Button>
          {canSuggestMeetup && (
            <Button size="sm" variant="outline" onClick={() => setMeetupOpen(true)} className="text-xs gap-1">
              <MapPin className="w-3.5 h-3.5"/> Meet up
            </Button>
          )}
        </div>
        <div className="flex gap-2 p-3">
          <Input value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…"/>
          <Button onClick={send}><Send className="w-4 h-4"/></Button>
        </div>
      </div>

      {/* meetup selector sheet */}
      <MeetupSelector
        open={meetupOpen}
        onOpenChange={setMeetupOpen}
        matchId={matchId!}
        myId={user!.id}
        myProfile={myProfile}
        otherProfile={otherProfile}
        nearbyVenues={[]}
      />
    </div>
  );
}
