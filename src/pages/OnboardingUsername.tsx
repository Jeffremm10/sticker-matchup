import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Trophy, Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const schema = z.string().trim().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, _ only");

export default function OnboardingUsername() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!name) return setStatus("idle");
    const parsed = schema.safeParse(name);
    if (!parsed.success) return setStatus("invalid");
    setStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.from("profiles").select("id").ilike("username", name).maybeSingle();
      if (data && data.id !== user?.id) setStatus("taken");
      else setStatus("ok");
    }, 350);
    return () => clearTimeout(t);
  }, [name, user?.id]);

  const submit = async () => {
    if (status !== "ok" || !user) return;
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ username: name, display_name: name }).eq("id", user.id);
    if (error) {
      setBusy(false);
      if (error.code === "23505") return toast.error("Username already taken");
      return toast.error(error.message);
    }
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    await qc.refetchQueries({ queryKey: ["profile", user.id] });
    setBusy(false);
    nav("/onboarding/location", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-background">
      <Card className="w-full max-w-md p-6 shadow-2xl">
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center">
            <Trophy className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-black">Choose your Collector Name</h1>
          <p className="text-xs text-muted-foreground text-center">This is how other collectors will find you.</p>
        </div>
        <div className="space-y-3">
          <div>
            <Label>Username</Label>
            <div className="relative">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="messi_fan_99" autoFocus />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {status === "checking" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {status === "ok" && <Check className="w-4 h-4 text-primary" />}
                {(status === "taken" || status === "invalid") && <X className="w-4 h-4 text-destructive" />}
              </div>
            </div>
            <p className="text-xs mt-1 h-4">
              {status === "invalid" && <span className="text-destructive">3–20 chars · letters, numbers, _</span>}
              {status === "taken" && <span className="text-destructive">Username already taken</span>}
              {status === "ok" && <span className="text-primary">Available</span>}
            </p>
          </div>
          <Button className="w-full" disabled={status !== "ok" || busy} onClick={submit}>
            Enter the Album
          </Button>
        </div>
      </Card>
    </div>
  );
}
