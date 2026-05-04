import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Clock, Check, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Venue = { id?: string; name: string; type: string; lat: number; lng: number; address: string | null };

export type MeetupSlot = {
  id: string; match_id: string; venue_name: string; venue_address: string | null;
  venue_lat: number | null; venue_lng: number | null; scheduled_at: string;
  suggested_by: string; confirmed_by: string | null;
  status: "pending" | "confirmed" | "cancelled";
};

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function fetchSuggestionsNear(lat: number, lng: number, signal: AbortSignal): Promise<Venue[]> {
  // nwr = node/way/relation; out center gives lat/lng for non-node elements
  const query = `[out:json][timeout:15];(nwr["amenity"="cafe"]["name"](around:3000,${lat},${lng});nwr["amenity"="fast_food"]["name"](around:3000,${lat},${lng});nwr["shop"="mall"]["name"](around:3000,${lat},${lng});nwr["railway"="station"]["name"](around:3000,${lat},${lng});nwr["amenity"="pub"]["name"](around:3000,${lat},${lng}););out center 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    signal,
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}`);
  const json = await res.json();
  const elements: any[] = json.elements ?? [];

  return elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      // nodes have el.lat/lon; ways/relations have el.center.lat/lon
      const elLat: number = el.lat ?? el.center?.lat;
      const elLng: number = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) return null;
      const name: string = el.tags.name;
      const dist = haversineKm([lat, lng], [elLat, elLng]);
      const type = el.tags.railway ? "transit_hub" : el.tags.shop ? "mall" : "coffee_shop";
      const address = [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
      return { name, lat: elLat, lng: elLng, type, address, dist };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.dist - b.dist)
    .slice(0, 5) as Venue[];
}

type SelectorProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  matchId: string;
  myId: string;
  myProfile: { lat: number | null; lng: number | null } | null;
  otherProfile: { display_name: string; lat: number | null; lng: number | null } | null;
  nearbyVenues: Venue[];
};

export function MeetupSelector({ open, onOpenChange, matchId, myId, myProfile, otherProfile, nearbyVenues }: SelectorProps) {
  const qc = useQueryClient();
  const [time, setTime] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveSuggestions, setLiveSuggestions] = useState<Venue[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const midpoint: [number, number] | null =
    myProfile?.lat && myProfile?.lng && otherProfile?.lat && otherProfile?.lng
      ? [(myProfile.lat + otherProfile.lat) / 2, (myProfile.lng + otherProfile.lng) / 2]
      : myProfile?.lat && myProfile?.lng
      ? [myProfile.lat, myProfile.lng]
      : null;

  // Fetch from Overpass when sheet opens (or when midpoint becomes available)
  useEffect(() => {
    if (!open || !midpoint) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    setLoadingSuggestions(true);
    setLiveSuggestions([]);
    fetchSuggestionsNear(midpoint[0], midpoint[1], ctrl.signal)
      .then(setLiveSuggestions)
      .catch((e) => {
        if (!ctrl.signal.aborted) toast.error("Couldn't load nearby spots — type a custom location below.");
      })
      .finally(() => { clearTimeout(timer); setLoadingSuggestions(false); });
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, [open, midpoint?.[0], midpoint?.[1]]); // eslint-disable-line

  // Merge: live Overpass results first, then DB cache as fallback
  const suggestions = liveSuggestions.length > 0
    ? liveSuggestions
    : midpoint
    ? [...nearbyVenues]
        .sort((a, b) => haversineKm(midpoint, [a.lat, a.lng]) - haversineKm(midpoint, [b.lat, b.lng]))
        .slice(0, 3)
    : nearbyVenues.slice(0, 3);

  const submit = async () => {
    if ((!selectedVenue && !customName.trim()) || !time) return;
    setBusy(true);
    const { error } = await supabase.from("meetup_slots").insert({
      match_id: matchId,
      venue_name: selectedVenue?.name ?? customName.trim(),
      venue_address: selectedVenue?.address ?? null,
      venue_lat: selectedVenue?.lat ?? null,
      venue_lng: selectedVenue?.lng ?? null,
      scheduled_at: new Date(time).toISOString(),
      suggested_by: myId,
      status: "pending",
    });
    if (error) { toast.error(error.message); setBusy(false); return; }
    qc.invalidateQueries({ queryKey: ["meetup_slot", matchId] });
    onOpenChange(false);
    setBusy(false);
    toast.success("Meetup proposed!");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Suggest a Meeting Spot</SheetTitle>
          {midpoint && otherProfile && (
            <p className="text-xs text-muted-foreground text-left">
              Spots near the midpoint between you and {otherProfile.display_name}
            </p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {loadingSuggestions && (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin"/> Finding spots near you…
            </div>
          )}
          {!loadingSuggestions && suggestions.length === 0 && !midpoint && (
            <p className="text-xs text-muted-foreground text-center py-2">
              Enable location in your profile to get spot suggestions.
            </p>
          )}
          {!loadingSuggestions && suggestions.map((v) => {
            const dist = midpoint ? Math.round(haversineKm(midpoint, [v.lat, v.lng]) * 10) / 10 : null;
            const key = `${v.lat},${v.lng}`;
            const sel = selectedVenue ? `${selectedVenue.lat},${selectedVenue.lng}` === key : false;
            return (
              <button key={key} onClick={() => setSelectedVenue(sel ? null : v)}
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

          {!selectedVenue && (
            <div>
              <Label className="text-xs">Or type a custom spot</Label>
              <Input placeholder="e.g. Central Station main entrance"
                value={customName} onChange={(e) => setCustomName(e.target.value)} className="mt-1"/>
            </div>
          )}

          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3"/> Date & time</Label>
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1"/>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
            <strong>Safety tip:</strong> Always meet in a public place. A busy coffee shop or mall food court is ideal.
          </div>

          <Button className="w-full" onClick={submit}
            disabled={busy || ((!selectedVenue && !customName.trim()) || !time)}>
            Send Meetup Suggestion
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function MeetupSlotCard({
  slot, myId, matchId,
}: {
  slot: MeetupSlot; myId: string; matchId: string;
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
    qc.invalidateQueries({ queryKey: ["meetup_slot", matchId] });
    qc.invalidateQueries({ queryKey: ["swap_session", matchId] });
    toast.success("Meetup confirmed! See you there.");
    setBusy(false);
  };

  return (
    <div className={`rounded-2xl border p-3 space-y-2 ${confirmed ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="flex items-center gap-1.5 text-sm font-bold">
        <MapPin className="w-4 h-4 text-primary"/>
        {confirmed ? "Meetup Confirmed ✓" : "Meetup Proposed"}
      </div>
      <p className="font-bold">{slot.venue_name}</p>
      {slot.venue_address && <p className="text-xs text-muted-foreground">{slot.venue_address}</p>}
      <p className="text-xs flex items-center gap-1 text-muted-foreground">
        <Clock className="w-3 h-3"/>
        {format(new Date(slot.scheduled_at), "EEE d MMM · HH:mm")}
      </p>
      {!isMe && !confirmed && (
        <Button size="sm" className="w-full" onClick={confirm} disabled={busy}>
          <Check className="w-3.5 h-3.5 mr-1"/> Confirm this Meetup
        </Button>
      )}
      {isMe && !confirmed && (
        <p className="text-xs text-muted-foreground text-center">Waiting for them to confirm…</p>
      )}
    </div>
  );
}
