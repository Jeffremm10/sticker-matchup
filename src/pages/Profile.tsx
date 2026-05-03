import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LogOut, MapPin, Trophy } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    enabled: !!user, queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [pro, setPro] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? "");
      setBio(profile.bio ?? "");
      setLat(profile.lat?.toString() ?? "");
      setLng(profile.lng?.toString() ?? "");
      setPro(!!profile.is_pro);
    }
  }, [profile]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({
      display_name: name, bio,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      is_pro: pro,
    }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Saved");
    qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  const geolocate = () => {
    navigator.geolocation.getCurrentPosition(
      (p) => { setLat(p.coords.latitude.toFixed(5)); setLng(p.coords.longitude.toFixed(5)); },
      () => toast.error("Location denied")
    );
  };

  return (
    <AppShell>
      <header className="p-4 flex items-center justify-between">
        <h1 className="text-xl font-black">Profile</h1>
        <Button variant="ghost" size="sm" onClick={()=>supabase.auth.signOut()}>
          <LogOut className="w-4 h-4 mr-1"/>Sign out
        </Button>
      </header>
      <div className="p-4 space-y-4">
        <div><Label>Display name</Label><Input value={name} onChange={e=>setName(e.target.value)}/></div>
        <div><Label>Bio</Label><Textarea value={bio} onChange={e=>setBio(e.target.value)} rows={2}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Latitude</Label><Input value={lat} onChange={e=>setLat(e.target.value)}/></div>
          <div><Label>Longitude</Label><Input value={lng} onChange={e=>setLng(e.target.value)}/></div>
        </div>
        <Button variant="outline" className="w-full" onClick={geolocate}><MapPin className="w-4 h-4 mr-2"/>Use my location</Button>
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-accent"/>
            <div>
              <div className="font-bold text-sm">Pro mode (dev)</div>
              <div className="text-xs text-muted-foreground">Unlimited swipes, unblurred lists</div>
            </div>
          </div>
          <Switch checked={pro} onCheckedChange={setPro}/>
        </div>
        <Button className="w-full" onClick={save}>Save</Button>
      </div>
    </AppShell>
  );
}