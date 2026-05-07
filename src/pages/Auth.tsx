import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy } from "lucide-react";

async function isNativeIOS(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch { return false; }
}

const TEST_USERS = [
  { email: "alex@swap26.test",   label: "Alex (Toronto)" },
  { email: "maya@swap26.test",   label: "Maya (CDMX)" },
  { email: "jordan@swap26.test", label: "Jordan (NYC)" },
  { email: "sam@swap26.test",    label: "Sam (London)" },
  { email: "ines@swap26.test",   label: "Ines (Madrid)" },
  { email: "kenji@swap26.test",  label: "Kenji (Tokyo)" },
  // Swiss users
  { email: "anna@swap26.test",   label: "Anna (Zürich)" },
  { email: "marco@swap26.test",  label: "Marco (Geneva)" },
  { email: "lisa@swap26.test",   label: "Lisa (Bern)" },
  { email: "thomas@swap26.test", label: "Thomas (Basel)" },
  { email: "maria@swap26.test",  label: "Maria (Lugano)" },
  { email: "stefan@swap26.test", label: "Stefan (Lucerne)" },
  { email: "sophia@swap26.test", label: "Sophia (Lausanne)" },
  { email: "daniel@swap26.test", label: "Daniel (Winterthur)" },
  { email: "nina@swap26.test",   label: "Nina (St. Gallen)" },
  { email: "boris@swap26.test",  label: "Boris (Neuchâtel)" },
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
      const native = await isNativeIOS();

      if (native) {
        // Use SFSafariViewController + custom scheme deep link
        const { Browser } = await import("@capacitor/browser");
        const { App } = await import("@capacitor/app");

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: "io.swapstrat.app://login-callback",
            skipBrowserRedirect: true,
          },
        });
        if (error || !data?.url) throw new Error("Could not get OAuth URL");

        await Browser.open({ url: data.url });

        const listener = await App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("io.swapstrat.app://")) return;
          await listener.remove();
          await Browser.close();
          const fragment = url.split("#")[1] ?? "";
          const params = new URLSearchParams(fragment);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            nav("/", { replace: true });
          } else {
            toast.error("Sign-in failed — try again");
          }
          setBusy(false);
        });
        return; // wait for deep link callback
      }

      // Web: Lovable managed OAuth
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) { toast.error("Google sign-in failed"); setBusy(false); return; }
      if (r.redirected) return;
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
    const { data, error } = await supabase.functions.invoke("seed-test-users", {
      body: { action: "login", email },
    });
    if (error || !data?.token_hash) {
      toast.error("Test user not found. Click 'Create / refresh test users' first.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "magiclink",
    });
    if (vErr) {
      toast.error(vErr.message);
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

        {import.meta.env.DEV && (
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
          </div>
        )}
      </Card>
    </div>
  );
}