import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Navigation, MapPin, Handshake, BookOpen, Star } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string; match_id: string;
  heading_a: boolean; heading_b: boolean;
  arrived_a: boolean; arrived_b: boolean;
  complete_a: boolean; complete_b: boolean;
  completed: boolean;
};

export function SwapDashboard({
  session, matchId, myId, isUserA, otherName,
}: {
  session: Session; matchId: string; myId: string; isUserA: boolean; otherName: string;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [albumPrompt, setAlbumPrompt] = useState(false);
  const [busy, setBusy] = useState(false);

  const myHeading   = isUserA ? session.heading_a  : session.heading_b;
  const myArrived   = isUserA ? session.arrived_a  : session.arrived_b;
  const myComplete  = isUserA ? session.complete_a : session.complete_b;
  const theyHeading = isUserA ? session.heading_b  : session.heading_a;
  const theyArrived = isUserA ? session.arrived_b  : session.arrived_a;
  const theyComplete = isUserA ? session.complete_b : session.complete_a;

  const setFlag = async (field: string) => {
    setBusy(true);
    await supabase.from("swap_sessions").update({ [field]: true }).eq("match_id", matchId);
    qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
    setBusy(false);
  };

  const confirmSwap = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("confirm_swap", { _match_id: matchId, _is_user_a: isUserA });
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
    if ((data as any)?.completed) {
      toast.success("Swap complete! +10 reputation for both of you.");
      setAlbumPrompt(true);
    } else {
      toast.success("Marked! Waiting for the other person to confirm.");
    }
    setBusy(false);
  };

  if (session.completed) {
    return (
      <div className="rounded-2xl border border-primary bg-primary/5 p-4 text-center space-y-1">
        <Handshake className="w-6 h-6 text-primary mx-auto"/>
        <p className="font-bold">Swap done — great trade!</p>
        <p className="text-xs text-muted-foreground">Both of you got +10 reputation.</p>
        <Button size="sm" variant="outline" className="mt-2" onClick={() => nav("/album")}>
          <BookOpen className="w-3.5 h-3.5 mr-1"/> Update my album
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-primary bg-primary/5 p-3 space-y-3">
        <p className="font-bold text-sm flex items-center gap-1.5">
          <Navigation className="w-4 h-4 text-primary"/> On the way
        </p>

        {/* Heading there */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs">
          <div className={`rounded-lg p-2 ${myHeading ? "bg-primary/20 text-primary font-bold" : "bg-muted text-muted-foreground"}`}>
            You {myHeading ? "🚶 On the way" : "—"}
          </div>
          <div className={`rounded-lg p-2 ${theyHeading ? "bg-primary/20 text-primary font-bold" : "bg-muted text-muted-foreground"}`}>
            {otherName} {theyHeading ? "🚶 On the way" : "—"}
          </div>
        </div>
        {!myHeading && (
          <Button size="sm" className="w-full" onClick={() => setFlag(isUserA ? "heading_a" : "heading_b")} disabled={busy}>
            <Navigation className="w-3.5 h-3.5 mr-1"/> I'm Heading There
          </Button>
        )}

        {/* Arrived */}
        {myHeading && (
          <>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className={`rounded-lg p-2 ${myArrived ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-bold" : "bg-muted text-muted-foreground"}`}>
                You {myArrived ? "📍 Here" : "—"}
              </div>
              <div className={`rounded-lg p-2 ${theyArrived ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 font-bold" : "bg-muted text-muted-foreground"}`}>
                {otherName} {theyArrived ? "📍 Here" : "—"}
              </div>
            </div>
            {!myArrived && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => setFlag(isUserA ? "arrived_a" : "arrived_b")} disabled={busy}>
                <MapPin className="w-3.5 h-3.5 mr-1"/> I've Arrived
              </Button>
            )}
          </>
        )}

        {/* Swap complete */}
        {myArrived && (
          <>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className={`rounded-lg p-2 ${myComplete ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold" : "bg-muted text-muted-foreground"}`}>
                You {myComplete ? "🤝 Done" : "—"}
              </div>
              <div className={`rounded-lg p-2 ${theyComplete ? "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 font-bold" : "bg-muted text-muted-foreground"}`}>
                {otherName} {theyComplete ? "🤝 Done" : "—"}
              </div>
            </div>
            {!myComplete && (
              <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={confirmSwap} disabled={busy}>
                <Handshake className="w-3.5 h-3.5 mr-1"/> Swap Complete
              </Button>
            )}
            {myComplete && !session.completed && (
              <p className="text-xs text-center text-muted-foreground">Waiting for {otherName} to confirm…</p>
            )}
          </>
        )}
      </div>

      {/* Album update prompt */}
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
            <Button variant="outline" className="flex-1" onClick={() => setAlbumPrompt(false)}>
              Later
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
