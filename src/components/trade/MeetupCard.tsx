import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Clock, Check, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Venue = { id: string; name: string; type: string; lat: number; lng: number; address: string | null };

type MeetupSlot = {
  id: string; trade_id: string; venue_name: string; venue_address: string | null;
  venue_lat: number | null; venue_lng: number | null; scheduled_at: string;
  suggested_by: string; confirmed_by: string | null;
  status: "pending" | "confirmed" | "cancelled";
};

type Props = {
  tradeId: string;
  matchId: string;
  myId: string;
  otherProfile: { display_name: string; lat: number | null; lng: number | null } | null;
  myProfile: { lat: number | null; lng: number | null } | null;
  nearbyVenues: Venue[];
};

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function MeetupSelector({ tradeId, matchId, myId, otherProfile, myProfile, nearbyVenues }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState("");
  const [customVenueName, setCustomVenueName] = useState("");
  const [busy, setBusy] = useState(false);

  // compute midpoint
  const midpoint: [number, number] | null =
    myProfile?.lat && myProfile?.lng && otherProfile?.lat && otherProfile?.lng
      ? [(myProfile.lat + otherProfile.lat) / 2, (myProfile.lng + otherProfile.lng) / 2]
      : null;

  // sort venues by distance from midpoint, take top 3
  const suggestions = midpoint
    ? [...nearbyVenues]
        .sort((a, b) => haversineKm(midpoint, [a.lat, a.lng]) - haversineKm(midpoint, [b.lat, b.lng]))
        .slice(0, 3)
    : nearbyVenues.slice(0, 3);

  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const propose = async () => {
    if ((!selectedVenue && !customVenueName.trim()) || !time) return;
    setBusy(true);
    const venueName = selectedVenue?.name ?? customVenueName.trim();
    const { error } = await supabase.from("meetup_slots").insert({
      trade_id: tradeId,
      venue_name: venueName,
      venue_address: selectedVenue?.address ?? null,
      venue_lat: selectedVenue?.lat ?? null,
      venue_lng: selectedVenue?.lng ?? null,
      scheduled_at: new Date(time).toISOString(),
      suggested_by: myId,
      status: "pending",
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["meetup_slot", tradeId] });
    setOpen(false);
    setBusy(false);
    toast.success("Meetup proposed! Waiting for confirmation.");
  };

  return (
    <>
      <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <MapPin className="w-3.5 h-3.5 mr-1"/> Suggest a Meetup Spot
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Choose a Meeting Spot</SheetTitle>
            {midpoint && (
              <p className="text-xs text-muted-foreground text-left">
                Spots near the midpoint between you and {otherProfile?.display_name}
              </p>
            )}
          </SheetHeader>

          <div className="mt-4 space-y-3">
            {suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((v) => {
                  const dist = midpoint ? Math.round(haversineKm(midpoint, [v.lat, v.lng]) * 10) / 10 : null;
                  const sel = selectedVenue?.id === v.id;
                  return (
                    <button key={v.id} onClick={() => setSelectedVenue(sel ? null : v)}
                      className={`w-full text-left rounded-xl border p-3 transition-all ${sel ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-primary shrink-0"/>
                          <div>
                            <div className="font-bold text-sm">{v.name}</div>
                            {v.address && <div className="text-[11px] text-muted-foreground">{v.address}</div>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {dist !== null && <span className="text-xs text-muted-foreground">{dist} km</span>}
                          {sel && <Check className="w-4 h-4 text-primary"/>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {!selectedVenue && (
              <div>
                <Label className="text-xs">Or enter a custom location</Label>
                <Input placeholder="e.g. Central Station main entrance"
                  value={customVenueName} onChange={(e) => setCustomVenueName(e.target.value)} className="mt-1"/>
              </div>
            )}

            <div>
              <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3"/> Date & time</Label>
              <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1"/>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200">
              <strong>Safety reminder:</strong> Meet in a public place. Bring a friend if you can. Your location will be shared with your emergency contact when the swap starts.
            </div>

            <Button className="w-full" onClick={propose}
              disabled={busy || ((!selectedVenue && !customVenueName.trim()) || !time)}>
              Send Meetup Proposal
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

export function MeetupSlotCard({
  slot, myId, tradeId, matchId,
}: {
  slot: MeetupSlot; myId: string; tradeId: string; matchId: string;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const isMe = slot.suggested_by === myId;
  const confirmed = slot.status === "confirmed";

  const confirm = async () => {
    setBusy(true);
    const { error } = await supabase.from("meetup_slots")
      .update({ status: "confirmed", confirmed_by: myId }).eq("id", slot.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    // create swap session if not exists
    await supabase.from("swap_sessions")
      .upsert({ trade_id: tradeId, pin: String(Math.floor(100000 + Math.random() * 900000)) }, { onConflict: "trade_id" });
    qc.invalidateQueries({ queryKey: ["meetup_slot", tradeId] });
    qc.invalidateQueries({ queryKey: ["swap_session", tradeId] });
    setBusy(false);
    toast.success("Meetup confirmed! See you there.");
  };

  return (
    <div className={`rounded-2xl border p-3 space-y-2 my-1 ${confirmed ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <MapPin className="w-4 h-4 text-primary"/>
        {confirmed ? "Meetup Confirmed" : "Meetup Proposed"}
      </div>
      <div className="space-y-1">
        <p className="font-bold">{slot.venue_name}</p>
        {slot.venue_address && <p className="text-xs text-muted-foreground">{slot.venue_address}</p>}
        <p className="text-xs flex items-center gap-1 text-muted-foreground">
          <Clock className="w-3 h-3"/>
          {format(new Date(slot.scheduled_at), "EEE d MMM · HH:mm")}
        </p>
      </div>
      {!isMe && !confirmed && (
        <Button size="sm" className="w-full" onClick={confirm} disabled={busy}>
          <Check className="w-3.5 h-3.5 mr-1"/> Confirm this Meetup
        </Button>
      )}
      {isMe && !confirmed && (
        <p className="text-xs text-muted-foreground text-center">Waiting for confirmation…</p>
      )}
    </div>
  );
}
