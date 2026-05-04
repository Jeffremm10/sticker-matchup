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

async function searchPlacesByName(query: string, lat: number, lng: number): Promise<Venue[]> {
  if (query.length < 2) return [];
  const { data, error } = await supabase.functions.invoke("find-venues", {
    body: { lat, lng, query },
  });
  if (error) throw new Error(error.message);
  return (data?.venues ?? []) as Venue[];
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  // Get real device location when sheet opens
  useEffect(() => {
    if (!open) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoLat(pos.coords.latitude); setGeoLng(pos.coords.longitude); },
      () => { /* denied — fall back to profile */ }
    );
  }, [open]);

  // Best available location: GPS > profile > hardcoded Zürich
  const searchLat = geoLat ?? myProfile?.lat ?? 47.3769;
  const searchLng = geoLng ?? myProfile?.lng ?? 8.5472;

  // Debounced search
  useEffect(() => {
    if (!open) return;
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      searchPlacesByName(searchQuery, searchLat, searchLng)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 400);
    return () => clearTimeout(t);
  }, [searchQuery, open, searchLat, searchLng]); // eslint-disable-line

  // Reset on close
  useEffect(() => {
    if (!open) { setSearchQuery(""); setSearchResults([]); setSelectedVenue(null); }
  }, [open]);

  const displayName = selectedVenue?.name ?? searchQuery;

  const submit = async () => {
    if (!displayName.trim() || !time) return;
    setBusy(true);
    const { error } = await supabase.from("meetup_slots").insert({
      match_id: matchId,
      venue_name: displayName.trim(),
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
          {otherProfile && (
            <p className="text-xs text-muted-foreground text-left">
              Search for a spot convenient for you and {otherProfile.display_name}
            </p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {/* Live search input */}
          <div>
            <Label className="text-xs font-bold">Search for a meeting spot</Label>
            <div className="relative mt-1">
              <Input
                placeholder="e.g. Starbucks, McDonald's, Zürich HB…"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setSelectedVenue(null); }}
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground"/>
              )}
            </div>
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {searchResults.map((v) => {
                const key = `${v.lat},${v.lng}`;
                const sel = selectedVenue ? `${selectedVenue.lat},${selectedVenue.lng}` === key : false;
                const Icon = TYPE_ICON[v.type] ?? MapPin;
                return (
                  <button key={key}
                    onClick={() => { setSelectedVenue(v); setSearchQuery(v.name); setSearchResults([]); }}
                    className={`w-full text-left rounded-xl border px-3 py-2 transition-all flex items-center gap-2 ${sel ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                    <Icon className="w-4 h-4 text-primary shrink-0"/>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{v.name}</div>
                      {v.address && <div className="text-[11px] text-muted-foreground truncate">{v.address}</div>}
                    </div>
                    {sel && <Check className="w-4 h-4 text-primary ml-auto shrink-0"/>}
                  </button>
                );
              })}
            </div>
          )}

          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No results — try a different name or just continue with what you typed.</p>
          )}

          <div>
            <Label className="text-xs flex items-center gap-1"><Calendar className="w-3 h-3"/> Date & time</Label>
            <Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} className="mt-1"/>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-800 dark:text-amber-200">
            <strong>Safety tip:</strong> Always meet in a public place. A busy coffee shop or mall food court is ideal.
          </div>

          <Button className="w-full" onClick={submit}
            disabled={busy || !displayName.trim() || !time}>
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
