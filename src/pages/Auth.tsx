import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

export default function Auth() {
  const [busy, setBusy] = useState(false);

  const google = async () => {
    setBusy(true);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Google sign-in failed"); setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-background">
      <Card className="w-full max-w-md p-8 shadow-2xl text-center">
        <div className="flex flex-col items-center gap-3 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center shadow-[0_0_30px_hsl(var(--primary)/0.5)]">
            <Trophy className="text-primary-foreground w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black">Swap26</h1>
          <p className="text-sm text-muted-foreground">The 26 Collection · Trade smarter</p>
        </div>
        <Button className="w-full h-12 bg-primary text-primary-foreground" onClick={google} disabled={busy}>
          Continue with Google
        </Button>
        <p className="text-[11px] text-muted-foreground mt-4">
          A collection manager with social discovery.
        </p>
      </Card>
    </div>
  );
}