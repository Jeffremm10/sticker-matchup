import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Navigation, MapPin, QrCode, Star, Check } from "lucide-react";
import { toast } from "sonner";

type Session = {
  id: string; trade_id: string; pin: string;
  heading_a: boolean; heading_b: boolean;
  arrived_a: boolean; arrived_b: boolean;
  completed: boolean;
};

type Props = {
  session: Session;
  tradeId: string;
  matchId: string;
  myId: string;
  isUserA: boolean;
  otherName: string;
};

export function SwapDashboard({ session, tradeId, matchId, myId, isUserA, otherName }: Props) {
  const qc = useQueryClient();
  const [pinInput, setPinInput] = useState("");
  const [ratingOpen, setRatingOpen] = useState(false);
  const [score, setScore] = useState(5);
  const [onTime, setOnTime] = useState(true);
  const [hadStickers, setHadStickers] = useState(true);
  const [busy, setBusy] = useState(false);

  const myHeading  = isUserA ? session.heading_a : session.heading_b;
  const myArrived  = isUserA ? session.arrived_a : session.arrived_b;
  const theyHeading = isUserA ? session.heading_b : session.heading_a;
  const theyArrived = isUserA ? session.arrived_b : session.arrived_a;

  const setFlag = async (field: string) => {
    setBusy(true);
    await supabase.from("swap_sessions").update({ [field]: true }).eq("id", session.id);
    qc.invalidateQueries({ queryKey: ["swap_session", tradeId] });
    setBusy(false);
  };

  const verifyPin = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("complete_swap", { _trade_id: tradeId, _pin: pinInput });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error ?? error?.message ?? "Invalid PIN");
      setBusy(false);
      return;
    }
    toast.success("Swap complete! Inventory updated automatically.");
    qc.invalidateQueries({ queryKey: ["swap_session", tradeId] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
    setRatingOpen(true);
    setBusy(false);
  };

  const submitRating = async () => {
    setBusy(true);
    const otherQuery = await supabase.from("matches").select("user_a,user_b").eq("id", matchId).single();
    const otherUserId = otherQuery.data?.user_a === myId ? otherQuery.data?.user_b : otherQuery.data?.user_a;
    await supabase.from("user_ratings").insert({
      trade_id: tradeId, rater_id: myId, rated_id: otherUserId,
      score, on_time: onTime, had_stickers: hadStickers,
    });
    setRatingOpen(false);
    toast.success("Thanks for your feedback!");
    setBusy(false);
  };

  if (session.completed) {
    return (
      <div className="rounded-2xl border border-primary bg-primary/5 p-3 my-1 text-center space-y-1">
        <Check className="w-6 h-6 text-primary mx-auto"/>
        <p className="font-bold text-sm">Swap Complete</p>
        <p className="text-xs text-muted-foreground">Stickers have been moved in both albums automatically.</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-primary bg-primary/5 p-3 my-1 space-y-3">
        <p className="font-bold text-sm flex items-center gap-1.5">
          <Navigation className="w-4 h-4 text-primary"/> Live Swap
        </p>

        {/* Step 1: Heading there */}
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

        {/* Step 2: Arrived */}
        {myHeading && (
          <div className="grid grid-cols-2 gap-2 text-center text-xs">
            <div className={`rounded-lg p-2 ${myArrived ? "bg-green-100 text-green-800 font-bold dark:bg-green-900 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>
              You {myArrived ? "📍 Arrived" : "—"}
            </div>
            <div className={`rounded-lg p-2 ${theyArrived ? "bg-green-100 text-green-800 font-bold dark:bg-green-900 dark:text-green-200" : "bg-muted text-muted-foreground"}`}>
              {otherName} {theyArrived ? "📍 Arrived" : "—"}
            </div>
          </div>
        )}

        {myHeading && !myArrived && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => setFlag(isUserA ? "arrived_a" : "arrived_b")} disabled={busy}>
            <MapPin className="w-3.5 h-3.5 mr-1"/> I've Arrived
          </Button>
        )}

        {/* Step 3: PIN verification — show once both arrived */}
        {myArrived && theyArrived && (
          <div className="space-y-2 pt-1 border-t border-border">
            <p className="text-xs font-bold flex items-center gap-1">
              <QrCode className="w-3.5 h-3.5"/> Verify the Swap
            </p>
            {isUserA ? (
              <div className="text-center py-2">
                <p className="text-xs text-muted-foreground mb-1">Show this PIN to {otherName}</p>
                <div className="text-4xl font-black tracking-[0.3em] text-primary">{session.pin}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Enter the PIN shown on {otherName}'s phone</p>
                <div className="flex gap-2">
                  <Input
                    value={pinInput} onChange={(e) => setPinInput(e.target.value)}
                    placeholder="6-digit PIN" maxLength={6}
                    className="text-center text-lg font-black tracking-widest"/>
                  <Button onClick={verifyPin} disabled={busy || pinInput.length < 6}>
                    <Check className="w-4 h-4"/>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rating dialog */}
      <Dialog open={ratingOpen} onOpenChange={setRatingOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate your swap with {otherName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-sm font-bold mb-2">Overall score</p>
              <div className="flex gap-2">
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setScore(n)}
                    className={`text-2xl transition-transform ${n <= score ? "scale-110" : "opacity-30"}`}>
                    <Star className={`w-8 h-8 ${n <= score ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`}/>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setOnTime(!onTime)}
                className={`rounded-xl border p-3 text-sm text-center font-bold transition-all ${onTime ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                ⏰ On time?<br/><span className="font-normal text-xs">{onTime ? "Yes" : "No"}</span>
              </button>
              <button onClick={() => setHadStickers(!hadStickers)}
                className={`rounded-xl border p-3 text-sm text-center font-bold transition-all ${hadStickers ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                🃏 Had stickers?<br/><span className="font-normal text-xs">{hadStickers ? "Yes" : "No"}</span>
              </button>
            </div>
            <Button className="w-full" onClick={submitRating} disabled={busy}>Submit Rating</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
