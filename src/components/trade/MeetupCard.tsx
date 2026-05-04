import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MapPin, Clock, Check, Calendar, Loader2, Coffee, Train, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const TYPE_ICON: Record<string, any> = {
  coffee_shop: Coffee,
  mall: ShoppingBag,
  transit_hub: Train,
};

type Venue = { id?: string; name: string; type: string; lat: number; lng: number; address: string | null; label?: string };

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

async function overpassGET(lat: number, lng: number, radiusM = 2000): Promise<Venue[]> {
  // GET avoids CORS preflight; node-only means direct lat/lng (no out center needed)
  const q = `[out:json][timeout:12];(node["amenity"~"cafe|fast_food|restaurant"]["name"](around:${radiusM},${lat},${lng});node["railway"="station"]["name"](around:${radiusM},${lat},${lng});node["shop"="mall"]["name"](around:${radiusM},${lat},${lng}););out 20;`;
  const encoded = encodeURIComponent(q);

  for (const base of [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ]) {
    try {
      const res = await fetch(`${base}?data=${encoded}`);
      if (!res.ok) continue;
      const json = await res.json();
      const results: Venue[] = json.elements
        .filter((el: any) => el.tags?.name && el.lat && el.lon)
        .map((el: any) => ({
          name: el.tags.name as string,
          lat: el.lat as number,
          lng: el.lon as number,
          type: (el.tags.railway ? "transit_hub" : el.tags.shop ? "mall" : "coffee_shop") as Venue["type"],
          address: [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null,
          label: "Nearby",
        }))
        .slice(0, 6);
      if (results.length) return results;
    } catch { /* try next mirror */ }
  }
  return [];
}

async function fetchSuggestionsNear(
  lat: number, lng: number,
  lat2?: number | null, lng2?: number | null,
): Promise<Venue[]> {
  const userDistKm = lat2 && lng2 ? haversineKm([lat, lng], [lat2, lng2]) : 0;

  if (userDistKm > 80) {
    // Far apart — search near each user, show best from both
    const [nearMe, nearThem] = await Promise.all([
      overpassGET(lat, lng, 2000),
      lat2 && lng2 ? overpassGET(lat2, lng2, 2000) : Promise.resolve([]),
    ]);
    const all = [
      ...nearMe.slice(0, 3).map((v) => ({ ...v, label: "Near you" })),
      ...nearThem.slice(0, 3).map((v) => ({ ...v, label: "Near them" })),
    ];
    if (all.length) return all;
  } else {
    // Close — search around midpoint
    const midLat = lat2 ? (lat + lat2) / 2 : lat;
    const midLng = lng2 ? (lng + lng2) / 2 : lng;
    const radius = Math.max(2000, userDistKm * 400);
    const venues = await overpassGET(midLat, midLng, radius);
    if (venues.length) return venues;
    // Midpoint too rural — fall back to near each user
    const [nearMe, nearThem] = await Promise.all([
      overpassGET(lat, lng, 2000),
      lat2 && lng2 ? overpassGET(lat2, lng2, 2000) : Promise.resolve([]),
    ]);
    const all = [
      ...nearMe.slice(0, 3).map((v) => ({ ...v, label: "Near you" })),
      ...nearThem.slice(0, 3).map((v) => ({ ...v, label: "Near them" })),
    ];
    if (all.length) return all;
  }

  throw new Error("No venues found nearby — type your spot below.");
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

  // Fetch via edge function when sheet opens (or when midpoint becomes available)
  useEffect(() => {
    if (!open || !midpoint) return;
    setLoadingSuggestions(true);
    setLiveSuggestions([]);
    fetchSuggestionsNear(midpoint[0], midpoint[1], otherProfile?.lat, otherProfile?.lng)
      .then(setLiveSuggestions)
      .catch((e: Error) => toast.info(e.message ?? "Type your meeting spot below."))
      .finally(() => setLoadingSuggestions(false));
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
    if (!customName.trim() || !time) return;
    setBusy(true);
    const isTemplate = selectedVenue && !selectedVenue.lat;
    const { error } = await supabase.from("meetup_slots").insert({
      match_id: matchId,
      venue_name: customName.trim(),
      venue_address: isTemplate ? null : (selectedVenue?.address ?? null),
      venue_lat: isTemplate ? null : (selectedVenue?.lat ?? null),
      venue_lng: isTemplate ? null : (selectedVenue?.lng ?? null),
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
          {/* Custom input — always visible so it works even if API fails */}
          <div>
            <Label className="text-xs font-bold">Where do you want to meet?</Label>
            <Input
              placeholder="e.g. Starbucks on Bahnhofstrasse, Zürich"
              value={customName}
              onChange={(e) => { setCustomName(e.target.value); setSelectedVenue(null); }}
              className="mt-1"
              autoFocus
            />
          </div>

          {/* Suggestions */}
          {loadingSuggestions && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin"/> Finding spots nearby…
            </div>
          )}

          {!loadingSuggestions && suggestions.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">
                {suggestions[0]?.lat ? "Suggestions near you" : "Common meeting spots"}
              </p>
              <div className="space-y-1.5">
                {suggestions.map((v) => {
                  const isTemplate = !v.lat;
                  const dist = !isTemplate && midpoint ? Math.round(haversineKm(midpoint, [v.lat, v.lng]) * 10) / 10 : null;
                  const key = `${v.name}-${v.lat}-${v.lng}`;
                  const sel = selectedVenue ? `${selectedVenue.name}-${selectedVenue.lat}-${selectedVenue.lng}` === key : false;
                  const Icon = TYPE_ICON[v.type] ?? MapPin;
                  return (
                    <button key={key}
                      onClick={() => {
                        if (sel) { setSelectedVenue(null); setCustomName(""); }
                        else { setSelectedVenue(v); setCustomName(v.name); }
                      }}
                      className={`w-full text-left rounded-xl border px-3 py-2 transition-all flex items-center justify-between ${sel ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-primary shrink-0"/>
                        <div>
                          <div className="font-bold text-sm">{v.name}</div>
                          {v.address && !isTemplate && (
                            <div className="text-[11px] text-muted-foreground">{v.address}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {dist !== null && <span className="text-xs text-muted-foreground">{dist} km</span>}
                        {v.label && <span className="text-[10px] bg-secondary rounded px-1">{v.label}</span>}
                        {sel && <Check className="w-4 h-4 text-primary"/>}
                      </div>
                    </button>
                  );
                })}
              </div>
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
