import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Navigation, MapPin, Handshake, BookOpen, Star, Clock, Check } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

type RatingDialogProps = {
  open: boolean;
  onClose: () => void;
  matchId: string;
  myId: string;
  otherName: string;
  onAlbum: () => void;
};

function RatingDialog({ open, onClose, matchId, myId, otherName, onAlbum }: RatingDialogProps) {
  const [score, setScore] = useState(5);
  const [onTime, setOnTime] = useState(true);
  const [hadStickers, setHadStickers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setBusy(true);
    const otherRes = await supabase.from("matches").select("user_a,user_b").eq("id", matchId).single();
    const otherId = otherRes.data?.user_a === myId ? otherRes.data?.user_b : otherRes.data?.user_a;
    if (!otherId) { setBusy(false); return; }
    await supabase.from("user_ratings").insert({
      match_id: matchId, rater_id: myId, rated_id: otherId,
      score, on_time: onTime, had_stickers: hadStickers,
    });
    setDone(true);
    setBusy(false);
  };

  if (done) return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Thanks for rating!</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Your feedback helps build trust in the community.</p>
        <div className="flex gap-2 mt-2">
          <Button className="flex-1" onClick={() => { onClose(); onAlbum(); }}>
            <BookOpen className="w-4 h-4 mr-1"/> Update my album
          </Button>
          <Button variant="outline" className="flex-1" onClick={onClose}>Later</Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How was the trade with {otherName}?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-1">
          {/* Stars */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Overall</p>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} onClick={() => setScore(n)}>
                  <Star className={`w-8 h-8 transition-colors ${n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}/>
                </button>
              ))}
            </div>
          </div>

          {/* Quick tags */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setOnTime(!onTime)}
              className={`rounded-xl border p-3 text-sm text-left transition-all ${onTime ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <span>⏰ On time</span>
                {onTime && <Check className="w-4 h-4 text-primary"/>}
              </div>
            </button>
            <button onClick={() => setHadStickers(!hadStickers)}
              className={`rounded-xl border p-3 text-sm text-left transition-all ${hadStickers ? "border-primary bg-primary/10" : "border-border"}`}>
              <div className="flex items-center justify-between">
                <span>🃏 Had stickers</span>
                {hadStickers && <Check className="w-4 h-4 text-primary"/>}
              </div>
            </button>
          </div>

          <Button className="w-full" onClick={submit} disabled={busy}>Submit Rating</Button>
          <button className="w-full text-xs text-muted-foreground" onClick={onClose}>Skip</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Session = {
  id: string; match_id: string;
  heading_a?: boolean; heading_b?: boolean;
  arrived_a?: boolean; arrived_b?: boolean;
  complete_a?: boolean; complete_b?: boolean;
  completed?: boolean;
};

type MeetupSlot = {
  venue_name: string; venue_address: string | null; scheduled_at: string;
};

type Props = {
  session: Session | null;
  meetup: MeetupSlot;
  matchId: string;
  myId: string;
  isUserA: boolean;
  otherName: string;
};

export function SwapDashboard({ session, meetup, matchId, myId, isUserA, otherName }: Props) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const myHeading   = isUserA ? !!session?.heading_a  : !!session?.heading_b;
  const myArrived   = isUserA ? !!session?.arrived_a  : !!session?.arrived_b;
  const myComplete  = isUserA ? !!session?.complete_a : !!session?.complete_b;
  const theyHeading = isUserA ? !!session?.heading_b  : !!session?.heading_a;
  const theyArrived = isUserA ? !!session?.arrived_b  : !!session?.arrived_a;
  const theyComplete = isUserA ? !!session?.complete_b : !!session?.complete_a;
  const done = !!session?.completed;

  // Live clock — re-render every minute to update time-gated buttons
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  const meetupTime = new Date(meetup.scheduled_at);
  const minsUntil = (meetupTime.getTime() - Date.now()) / 60_000;
  const canHead   = minsUntil <= 120;  // unlock 2h before
  const canArrive = minsUntil <= 30;   // unlock 30 min before

  const setFlag = async (field: string) => {
    setBusy(true);
    if (!session) {
      // Session not yet created — insert with the flag already set
      await supabase.from("swap_sessions")
        .insert({ match_id: matchId, pin: "", [field]: true } as any);
    } else {
      await supabase.from("swap_sessions")
        .update({ [field]: true } as any).eq("match_id", matchId);
    }
    qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
    setBusy(false);
  };

  const confirmSwap = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("confirm_swap", { _match_id: matchId, _is_user_a: isUserA });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
      if ((data as any)?.completed) {
        toast.success("Swap done! +10 trust score each.");
      } else {
        toast.success("Marked! Waiting for the other person.");
      }
    } catch {
      await supabase.from("swap_sessions")
        .update({ [isUserA ? "complete_a" : "complete_b"]: true } as any)
        .eq("match_id", matchId);
      qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
    }
    setRatingOpen(true);
    setBusy(false);
  };

  // Completed state
  if (done) {
    return (
      <div className="rounded-2xl border border-primary bg-primary/5 p-4 text-center space-y-2">
        <Handshake className="w-8 h-8 text-primary mx-auto"/>
        <p className="font-black text-lg">Trade done!</p>
        <p className="text-xs text-muted-foreground">Both of you got +10 reputation.</p>
        <Button size="sm" className="w-full mt-1" onClick={() => nav("/album")}>
          <BookOpen className="w-3.5 h-3.5 mr-1"/> Update my album
        </Button>
      </div>
    );
  }

  // Step indicator
  const step = !myHeading ? 1 : !myArrived ? 2 : !myComplete ? 3 : 4;

  return (
    <>
      <div className="rounded-2xl border border-primary/40 bg-card p-4 space-y-4">

        {/* Venue + time header */}
        <div className="flex items-start gap-3 pb-3 border-b border-border">
          <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0"/>
          <div>
            <p className="font-bold text-sm">{meetup.venue_name}</p>
            {meetup.venue_address && <p className="text-xs text-muted-foreground">{meetup.venue_address}</p>}
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3"/>
              {format(new Date(meetup.scheduled_at), "EEE d MMM · HH:mm")}
            </p>
          </div>
        </div>

        {/* Step 1: Heading there */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className={myHeading ? "text-primary font-bold" : ""}>You {myHeading ? "🚶 On the way" : "—"}</span>
            <span className={theyHeading ? "text-primary font-bold" : ""}>{otherName} {theyHeading ? "🚶 On the way" : "—"}</span>
          </div>
          {!myHeading && (
            canHead ? (
              <Button className="w-full" onClick={() => setFlag(isUserA ? "heading_a" : "heading_b")} disabled={busy}>
                <Navigation className="w-4 h-4 mr-2"/> I'm Heading There
              </Button>
            ) : (
              <p className="text-xs text-center text-muted-foreground py-1">
                Available 2 hours before — {formatDistanceToNow(meetupTime, { addSuffix: true })}
              </p>
            )
          )}
        </div>

        {/* Step 2: Arrived */}
        {myHeading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={myArrived ? "text-green-600 font-bold" : ""}>You {myArrived ? "📍 Arrived" : "—"}</span>
              <span className={theyArrived ? "text-green-600 font-bold" : ""}>{otherName} {theyArrived ? "📍 Arrived" : "—"}</span>
            </div>
            {!myArrived && (
              canArrive ? (
                <Button variant="outline" className="w-full" onClick={() => setFlag(isUserA ? "arrived_a" : "arrived_b")} disabled={busy}>
                  <MapPin className="w-4 h-4 mr-2"/> I've Arrived
                </Button>
              ) : (
                <p className="text-xs text-center text-muted-foreground py-1">
                  Available 30 min before — {formatDistanceToNow(meetupTime, { addSuffix: true })}
                </p>
              )
            )}
          </div>
        )}

        {/* Step 3: Swap complete */}
        {myArrived && (
          <div className="space-y-2">
            {theyArrived && !myComplete && (
              <p className="text-xs text-center text-muted-foreground">
                {otherName} is here too — do your swap, then tap below!
              </p>
            )}
            {!theyArrived && (
              <p className="text-xs text-center text-muted-foreground">
                Waiting for {otherName} to arrive…
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className={myComplete ? "text-amber-600 font-bold" : ""}>You {myComplete ? "🤝 Done" : "—"}</span>
              <span className={theyComplete ? "text-amber-600 font-bold" : ""}>{otherName} {theyComplete ? "🤝 Done" : "—"}</span>
            </div>
            {!myComplete ? (
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={confirmSwap} disabled={busy}>
                <Handshake className="w-4 h-4 mr-2"/> Swap Complete
              </Button>
            ) : (
              <p className="text-xs text-center text-muted-foreground py-1">
                Waiting for {otherName} to confirm…
              </p>
            )}
          </div>
        )}
      </div>

      <RatingDialog
        open={ratingOpen}
        onClose={() => setRatingOpen(false)}
        matchId={matchId}
        myId={myId}
        otherName={otherName}
        onAlbum={() => nav("/album")}
      />
    </>
  );
}
