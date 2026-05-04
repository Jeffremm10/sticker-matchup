import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, ArrowLeftRight } from "lucide-react";
import { StickerPicker } from "@/components/trade/StickerPicker";
import { TradeProposalCard } from "@/components/trade/TradeProposalCard";
import { MeetupSelector, MeetupSlotCard } from "@/components/trade/MeetupCard";
import { SwapDashboard } from "@/components/trade/SwapDashboard";
import { toast } from "sonner";

type Msg = { id: string; sender_id: string; body: string; created_at: string; msg_type: string; meta: any };

export default function Chat() {
  const { id: matchId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { data: myProfile } = useProfile();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // ── match + other user ──────────────────────────────────────────────────
  const { data: match } = useQuery({
    enabled: !!matchId && !!user,
    queryKey: ["match", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("matches").select("*").eq("id", matchId!).single();
      return data;
    },
  });

  const otherId = match ? (match.user_a === user?.id ? match.user_b : match.user_a) : null;

  const { data: otherProfile } = useQuery({
    enabled: !!otherId,
    queryKey: ["profile", otherId],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", otherId!).maybeSingle()).data,
  });

  // ── stickers ─────────────────────────────────────────────────────────────
  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers-lite"],
    queryFn: async () => (await supabase.from("stickers").select("id,code,nation").limit(1100)).data ?? [],
  });
  const stickerMap = new Map(stickers.map((s: any) => [s.id, s]));

  // ── my duplicates (what I can give) ──────────────────────────────────────
  const { data: myDupes = [] } = useQuery({
    enabled: !!user,
    queryKey: ["my_dupes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_inventory")
        .select("sticker_id").eq("user_id", user!.id).eq("status", "duplicate");
      return (data ?? []).map((r: any) => r.sticker_id as number);
    },
  });

  // what the other person can give (their dupes that I don't own)
  const { data: otherDupes = [] } = useQuery({
    enabled: !!otherId,
    queryKey: ["other_dupes", otherId],
    queryFn: async () => {
      const { data } = await supabase.from("user_inventory")
        .select("sticker_id").eq("user_id", otherId!).eq("status", "duplicate");
      return (data ?? []).map((r: any) => r.sticker_id as number);
    },
  });

  // ── messages ──────────────────────────────────────────────────────────────
  const { data: messages = [] } = useQuery({
    enabled: !!matchId,
    queryKey: ["messages", matchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages")
        .select("id,sender_id,body,created_at,msg_type,meta").eq("match_id", matchId!).order("created_at");
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

  // ── trade proposal ────────────────────────────────────────────────────────
  const { data: tradeProposals = [] } = useQuery({
    enabled: !!matchId,
    queryKey: ["trade_proposals", matchId],
    queryFn: async () => {
      const { data } = await supabase.from("trade_proposals")
        .select("*").eq("match_id", matchId!).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!matchId) return;
    const ch = supabase.channel(`trades:${matchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_proposals", filter: `match_id=eq.${matchId}` },
        () => qc.invalidateQueries({ queryKey: ["trade_proposals", matchId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [matchId, qc]);

  const activeProposal = tradeProposals[0] ?? null;
  const tradeIsLocked = activeProposal?.status === "locked";

  // ── meetup slot ───────────────────────────────────────────────────────────
  const { data: meetupSlot } = useQuery({
    enabled: !!activeProposal?.id,
    queryKey: ["meetup_slot", activeProposal?.id],
    queryFn: async () => {
      const { data } = await supabase.from("meetup_slots")
        .select("*").eq("trade_id", activeProposal!.id)
        .neq("status", "cancelled").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!activeProposal?.id) return;
    const ch = supabase.channel(`meetup:${activeProposal.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "meetup_slots", filter: `trade_id=eq.${activeProposal.id}` },
        () => {
          qc.invalidateQueries({ queryKey: ["meetup_slot", activeProposal.id] });
          qc.invalidateQueries({ queryKey: ["swap_session", activeProposal.id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeProposal?.id, qc]);

  // ── swap session ──────────────────────────────────────────────────────────
  const { data: swapSession } = useQuery({
    enabled: !!activeProposal?.id && meetupSlot?.status === "confirmed",
    queryKey: ["swap_session", activeProposal?.id],
    queryFn: async () => {
      const { data } = await supabase.from("swap_sessions")
        .select("*").eq("trade_id", activeProposal!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!activeProposal?.id) return;
    const ch = supabase.channel(`session:${activeProposal.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "swap_sessions", filter: `trade_id=eq.${activeProposal.id}` },
        () => qc.invalidateQueries({ queryKey: ["swap_session", activeProposal.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeProposal?.id, qc]);

  // ── nearby venues for meetup ──────────────────────────────────────────────
  const { data: nearbyVenues = [] } = useQuery({
    enabled: tradeIsLocked,
    queryKey: ["venues"],
    queryFn: async () => (await supabase.from("venues").select("*")).data ?? [],
  });

  // ── actions ───────────────────────────────────────────────────────────────
  const send = async () => {
    if (!text.trim() || !user || !matchId) return;
    const body = text.trim();
    setText("");
    await supabase.from("messages").insert({ match_id: matchId, sender_id: user.id, body });
  };

  const proposeSwap = async (giveIds: number[]) => {
    if (!user || !matchId) return;
    // receive = other's dupes that I don't have
    const myOwned = new Set(myDupes);
    const receiveIds = otherDupes.filter((id) => !myOwned.has(id)).slice(0, 20);
    const { data, error } = await supabase.from("trade_proposals")
      .insert({ match_id: matchId, proposer_id: user.id, give_ids: giveIds, receive_ids: receiveIds, status: "pending" })
      .select("id").single();
    if (error) { toast.error(error.message); return; }
    // send system message into chat
    await supabase.from("messages").insert({
      match_id: matchId, sender_id: user.id,
      body: `💱 Trade proposal — ${giveIds.length} sticker${giveIds.length !== 1 ? "s" : ""} offered`,
      msg_type: "trade_proposal", meta: { proposal_id: data.id },
    });
    qc.invalidateQueries({ queryKey: ["trade_proposals", matchId] });
    toast.success("Trade proposal sent!");
  };

  const myDupeStickers = stickers.filter((s: any) => myDupes.includes(s.id));
  const isUserA = match ? match.user_a === user?.id : false;
  const canPropose = !activeProposal || activeProposal.status === "declined";

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-background">
      {/* header */}
      <header className="flex items-center justify-between gap-2 p-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => nav("/matches")}><ArrowLeft/></Button>
          <div>
            <h1 className="font-bold leading-none">{otherProfile?.display_name ?? "Trade Chat"}</h1>
            {activeProposal && (
              <p className="text-[10px] text-muted-foreground capitalize">
                Trade: {activeProposal.status}
              </p>
            )}
          </div>
        </div>
        {canPropose && (
          <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1"/> Propose Swap
          </Button>
        )}
      </header>

      {/* messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {/* pinned trade proposal card */}
        {activeProposal && (
          <TradeProposalCard
            proposal={activeProposal}
            isProposer={activeProposal.proposer_id === user?.id}
            stickerMap={stickerMap}
            matchId={matchId!}
          />
        )}

        {/* meetup selector — unlocked after trade locked */}
        {tradeIsLocked && !meetupSlot && activeProposal.proposer_id === user?.id && (
          <MeetupSelector
            tradeId={activeProposal.id}
            matchId={matchId!}
            myId={user!.id}
            otherProfile={otherProfile}
            myProfile={myProfile}
            nearbyVenues={nearbyVenues}
          />
        )}
        {tradeIsLocked && !meetupSlot && activeProposal.proposer_id !== user?.id && (
          <div className="text-center text-xs text-muted-foreground py-2">
            Waiting for {otherProfile?.display_name} to suggest a meetup…
          </div>
        )}

        {/* meetup slot card */}
        {meetupSlot && (
          <MeetupSlotCard
            slot={meetupSlot}
            myId={user!.id}
            tradeId={activeProposal!.id}
            matchId={matchId!}
          />
        )}

        {/* live swap dashboard */}
        {swapSession && meetupSlot?.status === "confirmed" && (
          <SwapDashboard
            session={swapSession}
            tradeId={activeProposal!.id}
            matchId={matchId!}
            myId={user!.id}
            isUserA={isUserA}
            otherName={otherProfile?.display_name ?? "them"}
          />
        )}

        {/* chat messages */}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          if (m.msg_type === "trade_proposal") return null; // shown as pinned card above
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

      {/* input */}
      <div className="p-3 border-t border-border bg-card flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message…"/>
        <Button onClick={send}><Send className="w-4 h-4"/></Button>
      </div>

      {/* sticker picker */}
      <StickerPicker
        open={pickerOpen} onOpenChange={setPickerOpen}
        title="Pick stickers to offer"
        stickers={myDupeStickers}
        selected={[]}
        onConfirm={proposeSwap}
      />
    </div>
  );
}
