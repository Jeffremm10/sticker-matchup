import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Navigation, MapPin, Handshake, BookOpen, Star, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";

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
  isUserA: boolean;
  otherName: string;
};

export function SwapDashboard({ session, meetup, matchId, isUserA, otherName }: Props) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [albumPrompt, setAlbumPrompt] = useState(false);
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
    if (!session) return;
    setBusy(true);
    await supabase.from("swap_sessions").update({ [field]: true } as any).eq("match_id", matchId);
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
        toast.success("Swap done! +10 reputation each.");
        setAlbumPrompt(true);
      } else {
        toast.success("Marked! Waiting for the other person.");
      }
    } catch {
      // Fallback if RPC not deployed yet
      await supabase.from("swap_sessions")
        .update({ [isUserA ? "complete_a" : "complete_b"]: true } as any)
        .eq("match_id", matchId);
      qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
      toast.success("Marked as complete!");
    }
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

      <Dialog open={albumPrompt} onOpenChange={setAlbumPrompt}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-400 fill-amber-400"/> Nice trade!
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Did you pick up some new stickers? Head to your album to mark them as owned.
          </p>
          <div className="flex gap-2 mt-2">
            <Button className="flex-1" onClick={() => { setAlbumPrompt(false); nav("/album"); }}>
              <BookOpen className="w-4 h-4 mr-1"/> Update my album
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setAlbumPrompt(false)}>Later</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
