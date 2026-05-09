import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MapPin, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function OnboardingLocation() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [status, setStatus] = useState<"idle" | "requesting" | "success" | "denied">("idle");

  const requestLocation = () => {
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!user) return;
        const { error } = await supabase.from("profiles").update({ lat, lng }).eq("id", user.id);
        if (error) { toast.error("Failed to save location"); setStatus("denied"); return; }
        await qc.invalidateQueries({ queryKey: ["profile", user.id] });
        setStatus("success");
        setTimeout(() => nav("/album", { replace: true }), 500);
      },
      () => {
        setStatus("denied");
        toast.error("Location permission denied");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const skip = () => nav("/album", { replace: true });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-background">
      <Card className="w-full max-w-md p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
            <MapPin className="text-primary-foreground w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black">Share Your Location</h1>
          <p className="text-xs text-muted-foreground text-center">
            Help other collectors find you and discover trading partners nearby.
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={status !== "idle" && status !== "denied"}
            onClick={requestLocation}
          >
            {status === "requesting" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {status === "success"    && <Check className="w-4 h-4 mr-2" />}
            {status === "denied"     && <X className="w-4 h-4 mr-2" />}
            {status === "idle"       ? "Allow Location" :
             status === "requesting" ? "Requesting..." :
             status === "success"    ? "Location Saved!" : "Try Again"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {status === "denied"
              ? "Tap Settings → Apps → SwapStrat → Permissions → Location → Allow."
              : "Used to show nearby collectors. Never shared with third parties."}
          </p>

          <Button variant="outline" className="w-full" onClick={skip} disabled={status === "requesting"}>
            Skip for now
          </Button>
        </div>
      </Card>
    </div>
  );
}
