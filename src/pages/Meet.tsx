import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MapPin, Coffee, ShoppingBag, Train, Store, CheckCircle, Shield, Clock, Users, Plus } from "lucide-react";
import { toast } from "sonner";
import "leaflet/dist/leaflet.css";

// ── types ──────────────────────────────────────────────────────────────────
type VenueType = "coffee_shop" | "mall" | "transit_hub" | "kiosk";

type Venue = {
  id: string; name: string; type: VenueType;
  lat: number; lng: number; address: string | null;
  nominations: number; swap_count: number; is_verified: boolean;
};

type ActiveCheckin = {
  id: string; user_id: string; venue_id: string;
  started_at: string; status: string;
  profiles: { display_name: string; username: string | null } | null;
};

// ── constants ──────────────────────────────────────────────────────────────
const VENUE_META: Record<VenueType, { label: string; color: string; icon: any; overpassTag: string }> = {
  coffee_shop:  { label: "Coffee Shop",    color: "#b45309", icon: Coffee,      overpassTag: 'amenity~"cafe|fast_food"' },
  mall:         { label: "Shopping Mall",  color: "#7c3aed", icon: ShoppingBag, overpassTag: 'shop~"mall|department_store"' },
  transit_hub:  { label: "Transit Hub",    color: "#0369a1", icon: Train,       overpassTag: 'public_transport~"station|stop_area"' },
  kiosk:        { label: "Kiosk / Newsstand", color: "#16a34a", icon: Store,   overpassTag: 'shop~"newsagent|kiosk"' },
};

const CHAIN_NAMES = [
  "starbucks","mccafé","costa","caffè nero","pret","greggs",
  "mcdonalds","mcdonald","burger king","kfc","subway",
];

const SAFETY_MINUTES = 30;

// ── Overpass fetch ─────────────────────────────────────────────────────────
async function fetchOverpass(lat: number, lng: number, type: VenueType, radiusM = 2000) {
  const tag = VENUE_META[type].overpassTag;
  const query = `[out:json][timeout:20];(node[${tag}](around:${radiusM},${lat},${lng});way[${tag}](around:${radiusM},${lat},${lng}););out center 40;`;
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST", body: "data=" + encodeURIComponent(query),
  });
  const json = await res.json();
  return (json.elements ?? []) as any[];
}

// ── colour SVG pin ─────────────────────────────────────────────────────────
function svgPin(color: string, verified: boolean) {
  const ring = verified ? `<circle cx="12" cy="12" r="10" fill="none" stroke="#fbbf24" stroke-width="2"/>` : "";
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22S28 23.63 28 14C28 6.27 21.73 0 14 0z" fill="${encodeURIComponent(color)}"/>${ring}<circle cx="14" cy="14" r="5" fill="white"/></svg>`;
}

// ── main component ─────────────────────────────────────────────────────────
export default function Meet() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const qc = useQueryClient();

  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markersLayer = useRef<any>(null);

  const [userLatLng, setUserLatLng] = useState<[number, number] | null>(null);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [checkinSheet, setCheckinSheet] = useState(false);
  const [nominateDialog, setNominateDialog] = useState(false);
  const [nominateName, setNominateName] = useState("");
  const [nominateAddress, setNominateAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [activeCheckin, setActiveCheckin] = useState<{ id: string; venueId: string; startedAt: Date } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [busyAction, setBusyAction] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<VenueType>>(new Set(["coffee_shop", "mall", "transit_hub", "kiosk"]));

  // ── load venues from Supabase ──────────────────────────────────────────
  const { data: dbVenues = [] } = useQuery<Venue[]>({
    enabled: !!user,
    queryKey: ["venues"],
    queryFn: async () => ((await supabase.from("venues").select("*")).data ?? []) as unknown as Venue[],
  });

  // ── active check-ins at selected venue ────────────────────────────────
  const { data: colocated = [] } = useQuery<ActiveCheckin[]>({
    enabled: !!selectedVenue,
    queryKey: ["check_ins_active", selectedVenue?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("check_ins")
        .select("id,user_id,venue_id,started_at,status")
        .eq("venue_id", selectedVenue!.id)
        .eq("status", "active");
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.user_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id,display_name,username").in("id", ids)
        : { data: [] as any[] };
      const pmap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, profiles: pmap.get(r.user_id) ?? null })) as ActiveCheckin[];
    },
    refetchInterval: 15000,
  });

  // ── safety timer tick ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeCheckin) return;
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - activeCheckin.startedAt.getTime()) / 1000);
      setElapsed(secs);
      if (secs === SAFETY_MINUTES * 60) {
        toast.warning("30 minutes have passed. Tap 'End Swap' when you're done!", { duration: 10000 });
      }
    }, 1000);
    return () => clearInterval(t);
  }, [activeCheckin]);

  // ── realtime co-location ───────────────────────────────────────────────
  useEffect(() => {
    if (!selectedVenue || !user) return;
    const channel = supabase.channel(`venue_${selectedVenue.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "check_ins", filter: `venue_id=eq.${selectedVenue.id}` },
        (payload) => {
          if (payload.new.user_id !== user.id) {
            toast.info("Someone just checked in here! Open the venue to see who.");
          }
          qc.invalidateQueries({ queryKey: ["check_ins_active", selectedVenue.id] });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedVenue, user, qc]);

  // ── init Leaflet ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, { zoomControl: false }).setView([48.8566, 2.3522], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors", maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "topright" }).addTo(map);
      markersLayer.current = L.layerGroup().addTo(map);
      mapObj.current = map;

      // locate user
      map.locate({ setView: true, maxZoom: 15 });
      map.on("locationfound", (e: any) => {
        setUserLatLng([e.latlng.lat, e.latlng.lng]);
        L.circleMarker(e.latlng, { radius: 8, color: "#6d28d9", fillColor: "#7c3aed", fillOpacity: 0.9, weight: 2 })
          .addTo(map).bindPopup("You are here");
        fetchNearby(e.latlng.lat, e.latlng.lng);
      });
      map.on("locationerror", () => {
        if (profile?.lat && profile?.lng) {
          setUserLatLng([profile.lat, profile.lng]);
          map.setView([profile.lat, profile.lng], 14);
          fetchNearby(profile.lat, profile.lng);
        }
      });
    });
  }, []);  // eslint-disable-line

  // ── draw markers whenever dbVenues changes ────────────────────────────
  useEffect(() => {
    if (!mapObj.current) return;
    import("leaflet").then((L) => {
      markersLayer.current?.clearLayers();
      dbVenues.filter((v) => activeTypes.has(v.type)).forEach((v) => {
        const meta = VENUE_META[v.type];
        const icon = L.icon({
          iconUrl: svgPin(meta.color, v.is_verified),
          iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36],
        });
        L.marker([v.lat, v.lng], { icon })
          .addTo(markersLayer.current)
          .on("click", () => setSelectedVenue(v));
      });
    });
  }, [dbVenues, activeTypes]);

  // ── fetch OSM venues and upsert into Supabase ─────────────────────────
  const fetchNearby = useCallback(async (lat: number, lng: number) => {
    const types: VenueType[] = ["coffee_shop", "mall", "transit_hub", "kiosk"];
    for (const type of types) {
      try {
        const elements = await fetchOverpass(lat, lng, type);
        for (const el of elements) {
          const name: string = el.tags?.name ?? "";
          if (!name) continue;
          // for coffee_shop, only keep known chains
          if (type === "coffee_shop") {
            const lname = name.toLowerCase();
            if (!CHAIN_NAMES.some((c) => lname.includes(c))) continue;
          }
          const elLat = el.lat ?? el.center?.lat;
          const elLng = el.lon ?? el.center?.lon;
          if (!elLat || !elLng) continue;
          const osmId = `${el.type}/${el.id}`;
          const address = [el.tags?.["addr:street"], el.tags?.["addr:housenumber"]].filter(Boolean).join(" ") || null;
          await supabase.rpc("upsert_osm_venue", {
            _name: name, _type: type, _lat: elLat, _lng: elLng, _address: address, _osm_id: osmId,
          });
        }
        qc.invalidateQueries({ queryKey: ["venues"] });
      } catch { /* overpass timeout — skip */ }
    }
  }, [qc]);

  // ── check in ──────────────────────────────────────────────────────────
  const doCheckin = async () => {
    if (!selectedVenue || !user) return;
    setBusyAction(true);
    const ec = emergencyContact.trim() || null;
    const { data, error } = await supabase.from("check_ins")
      .insert({ user_id: user.id, venue_id: selectedVenue.id, emergency_contact: ec, status: "active" })
      .select("id").single();
    if (error) { toast.error(error.message); setBusyAction(false); return; }
    setActiveCheckin({ id: data.id, venueId: selectedVenue.id, startedAt: new Date() });
    setElapsed(0);
    setCheckinSheet(false);
    toast.success(`Checked in at ${selectedVenue.name}!`);
    qc.invalidateQueries({ queryKey: ["check_ins_active", selectedVenue.id] });
    setBusyAction(false);
  };

  // ── end swap ──────────────────────────────────────────────────────────
  const endSwap = async (status: "completed" | "reported") => {
    if (!activeCheckin) return;
    setBusyAction(true);
    await supabase.from("check_ins").update({ status, ended_at: new Date().toISOString() }).eq("id", activeCheckin.id);
    setActiveCheckin(null);
    setElapsed(0);
    toast.success(status === "completed" ? "Swap complete! Great trade." : "Reported. Stay safe.");
    qc.invalidateQueries({ queryKey: ["venues"] });
    setBusyAction(false);
  };

  // ── nominate kiosk ────────────────────────────────────────────────────
  const submitNomination = async () => {
    if (!nominateName.trim() || !userLatLng) return;
    setBusyAction(true);
    const { data: venue, error: vErr } = await supabase.from("venues")
      .insert({ name: nominateName.trim(), type: "kiosk", lat: userLatLng[0], lng: userLatLng[1], address: nominateAddress.trim() || null })
      .select("id").single();
    if (vErr) { toast.error(vErr.message); setBusyAction(false); return; }
    const { error: nErr } = await supabase.from("venue_nominations")
      .insert({ user_id: user!.id, venue_id: venue.id });
    if (nErr) toast.error(nErr.message);
    else toast.success("Kiosk nominated! 4 more votes to appear on the map.");
    qc.invalidateQueries({ queryKey: ["venues"] });
    setNominateDialog(false);
    setNominateName(""); setNominateAddress("");
    setBusyAction(false);
  };

  // ── nominate existing kiosk ───────────────────────────────────────────
  const voteForVenue = async (venue: Venue) => {
    if (!user) return;
    const { error } = await supabase.from("venue_nominations")
      .insert({ user_id: user.id, venue_id: venue.id });
    if (error?.code === "23505") { toast.error("You already voted for this spot."); return; }
    if (error) { toast.error(error.message); return; }
    toast.success("Vote added!");
    qc.invalidateQueries({ queryKey: ["venues"] });
  };

  const meta = selectedVenue ? VENUE_META[selectedVenue.type] : null;
  const Icon = meta?.icon ?? MapPin;
  const otherCheckins = colocated.filter((c) => c.user_id !== user?.id);
  const myCheckinHere = activeCheckin?.venueId === selectedVenue?.id;

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const timerColor = elapsed >= SAFETY_MINUTES * 60 ? "text-destructive" : elapsed >= 20 * 60 ? "text-amber-500" : "text-primary";

  return (
    <AppShell>
      <header className="p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">Meet & Swap</h1>
          <p className="text-xs text-muted-foreground">Find safe spots to trade nearby</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setNominateDialog(true)}>
          <Plus className="w-4 h-4 mr-1"/> Nominate Kiosk
        </Button>
      </header>

      {/* type filter pills */}
      <div className="px-4 flex gap-2 flex-wrap mb-3">
        {(Object.entries(VENUE_META) as [VenueType, typeof VENUE_META[VenueType]][]).map(([type, m]) => {
          const active = activeTypes.has(type);
          return (
            <button key={type} onClick={() => {
              setActiveTypes((prev) => {
                const next = new Set(prev);
                active ? next.delete(type) : next.add(type);
                return next;
              });
            }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                active ? "text-white border-transparent" : "bg-background text-muted-foreground border-border"
              }`}
              style={active ? { backgroundColor: m.color } : {}}>
              <m.icon className="w-3 h-3"/> {m.label}
            </button>
          );
        })}
      </div>

      {/* active swap timer banner */}
      {activeCheckin && (
        <div className="mx-4 mb-3 p-3 rounded-xl bg-card border border-primary flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary"/>
            <div>
              <div className="text-xs font-bold">Swap in progress</div>
              <div className={`text-lg font-black tabular-nums ${timerColor}`}>{fmt(elapsed)}</div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="text-destructive border-destructive" onClick={() => endSwap("reported")} disabled={busyAction}>
              Report
            </Button>
            <Button size="sm" onClick={() => endSwap("completed")} disabled={busyAction}>
              End Swap
            </Button>
          </div>
        </div>
      )}

      {/* map */}
      <div ref={mapRef} className="mx-4 rounded-2xl overflow-hidden border border-border" style={{ height: 340 }} />

      {/* venue bottom sheet */}
      <Sheet open={!!selectedVenue && !checkinSheet} onOpenChange={(o) => { if (!o) setSelectedVenue(null); }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
          {selectedVenue && meta && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 text-left">
                  <Icon className="w-5 h-5" style={{ color: meta.color }}/>
                  <span>{selectedVenue.name}</span>
                  {selectedVenue.is_verified && (
                    <Badge className="bg-amber-500 text-white text-[10px] px-1.5">
                      <Shield className="w-3 h-3 mr-0.5"/> Safe Zone
                    </Badge>
                  )}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-3 space-y-3">
                {selectedVenue.address && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3"/> {selectedVenue.address}
                  </p>
                )}

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-secondary rounded-lg p-2">
                    <div className="font-black text-lg">{selectedVenue.swap_count}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Swaps</div>
                  </div>
                  <div className="bg-secondary rounded-lg p-2">
                    <div className="font-black text-lg">{selectedVenue.nominations}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Votes</div>
                  </div>
                  <div className="bg-secondary rounded-lg p-2">
                    <div className="font-black text-lg">{otherCheckins.length}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">Here now</div>
                  </div>
                </div>

                {otherCheckins.length > 0 && (
                  <div className="bg-primary/10 rounded-xl p-3">
                    <p className="text-xs font-bold text-primary flex items-center gap-1 mb-1.5">
                      <Users className="w-3.5 h-3.5"/> Collectors here right now
                    </p>
                    {otherCheckins.map((c) => (
                      <p key={c.id} className="text-sm font-medium">
                        {c.profiles?.display_name ?? "A collector"}
                      </p>
                    ))}
                  </div>
                )}

                {selectedVenue.type === "kiosk" && !selectedVenue.is_verified && (
                  <Button variant="outline" className="w-full" onClick={() => voteForVenue(selectedVenue)}>
                    <CheckCircle className="w-4 h-4 mr-2"/> Vouch for this spot ({selectedVenue.nominations}/5 votes)
                  </Button>
                )}

                {myCheckinHere ? (
                  <div className="text-center text-sm text-primary font-bold py-2">You're checked in here</div>
                ) : (
                  <Button className="w-full" onClick={() => setCheckinSheet(true)} disabled={!!activeCheckin}>
                    <MapPin className="w-4 h-4 mr-2"/>
                    {activeCheckin ? "End current swap first" : "Start a Swap Here"}
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* check-in sheet */}
      <Sheet open={checkinSheet} onOpenChange={setCheckinSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Start Swap at {selectedVenue?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-200">
              <strong>Safety timer:</strong> if you don't tap "End Swap" within {SAFETY_MINUTES} min, we'll remind you to check in.
            </div>
            <div>
              <Label className="text-xs">Emergency contact (optional)</Label>
              <Input placeholder="+1 555 000 0000 or email"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                className="mt-1"/>
              <p className="text-[10px] text-muted-foreground mt-1">Stored on your profile. Only used if you report a problem.</p>
            </div>
            <Button className="w-full" onClick={doCheckin} disabled={busyAction}>
              <CheckCircle className="w-4 h-4 mr-2"/> I'm here — Start Swap
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* nominate kiosk dialog */}
      <Dialog open={nominateDialog} onOpenChange={setNominateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nominate a Kiosk / Newsstand</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground">5 nominations from different users will add it to the map for everyone.</p>
            <div>
              <Label>Name</Label>
              <Input placeholder="e.g. Edicola Piazza Roma" value={nominateName} onChange={(e) => setNominateName(e.target.value)}/>
            </div>
            <div>
              <Label>Address (optional)</Label>
              <Input placeholder="Street address" value={nominateAddress} onChange={(e) => setNominateAddress(e.target.value)}/>
            </div>
            {!userLatLng && (
              <p className="text-xs text-destructive">Enable location to pin the kiosk to your current position.</p>
            )}
            <Button className="w-full" onClick={submitNomination} disabled={busyAction || !nominateName.trim() || !userLatLng}>
              Submit Nomination
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
