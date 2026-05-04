import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

const TEST_USERS = [
  { email: "alex@swap26.test",   label: "Alex (Toronto)" },
  { email: "maya@swap26.test",   label: "Maya (CDMX)" },
  { email: "jordan@swap26.test", label: "Jordan (NYC)" },
  { email: "sam@swap26.test",    label: "Sam (London)" },
  { email: "ines@swap26.test",   label: "Ines (Madrid)" },
  { email: "kenji@swap26.test",  label: "Kenji (Tokyo)" },
];
const TEST_PASSWORD = "Test1234!";

export default function Auth() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav("/", { replace: true });
  }, [user, loading, nav]);

  const google = async () => {
    setBusy(true);
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) { toast.error("Google sign-in failed"); setBusy(false); return; }
      if (r.redirected) return; // browser will redirect
      // tokens received inline — go to app
      nav("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Sign-in error");
      setBusy(false);
    }
  };

  const seed = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("seed-test-users");
      if (error) throw error;
      toast.success("Test users created. Pick one below to log in.");
    } catch (e: any) {
      toast.error(e?.message ?? "Seeding failed");
    } finally {
      setBusy(false);
    }
  };

  const loginAs = async (email: string) => {
    setBusy(true);
    await supabase.auth.signOut();
    const { error } = await supabase.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    if (error) {
      toast.error("Test user not found. Click 'Create test users' first.");
      setBusy(false);
      return;
    }
    nav("/", { replace: true });
  };

  if (!loading && user) return <Navigate to="/" replace />;

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

        <div className="mt-6 pt-4 border-t border-border text-left">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
            Dev: Test the swiping
          </p>
          <Button variant="outline" size="sm" className="w-full mb-2" onClick={seed} disabled={busy}>
            Create / refresh test users
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {TEST_USERS.map((t) => (
              <Button key={t.email} variant="secondary" size="sm" onClick={() => loginAs(t.email)} disabled={busy}>
                {t.label}
              </Button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Open multiple browsers/incognito windows and log in as different test users to swipe and match between them.
          </p>
        </div>
      </Card>
    </div>
  );
}