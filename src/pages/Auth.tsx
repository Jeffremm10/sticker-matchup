import { useEffect, useState } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MapPin, Zap, Trophy, Shield, ArrowRight } from "lucide-react";

async function isNativeIOS(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch { return false; }
}

async function isNativeAndroid(): Promise<boolean> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
  } catch { return false; }
}

const DEEP_LINK_CALLBACK = "io.swapstrat.app://login-callback";

const TEST_USERS = [
  { email: "alex@swapstrat.test",   label: "Alex (Toronto)" },
  { email: "maya@swapstrat.test",   label: "Maya (CDMX)" },
  { email: "jordan@swapstrat.test", label: "Jordan (NYC)" },
  { email: "sam@swapstrat.test",    label: "Sam (London)" },
  { email: "ines@swapstrat.test",   label: "Ines (Madrid)" },
  { email: "kenji@swapstrat.test",  label: "Kenji (Tokyo)" },
  { email: "anna@swapstrat.test",   label: "Anna (Zürich)" },
  { email: "marco@swapstrat.test",  label: "Marco (Geneva)" },
  { email: "lisa@swapstrat.test",   label: "Lisa (Bern)" },
  { email: "thomas@swapstrat.test", label: "Thomas (Basel)" },
  { email: "maria@swapstrat.test",  label: "Maria (Lugano)" },
  { email: "stefan@swapstrat.test", label: "Stefan (Lucerne)" },
  { email: "sophia@swapstrat.test", label: "Sophia (Lausanne)" },
  { email: "daniel@swapstrat.test", label: "Daniel (Winterthur)" },
  { email: "nina@swapstrat.test",   label: "Nina (St. Gallen)" },
  { email: "boris@swapstrat.test",  label: "Boris (Neuchâtel)" },
];
const TEST_PASSWORD = "Test1234!";

const FEATURES = [
  { icon: MapPin,  label: "Match with nearby collectors" },
  { icon: Zap,     label: "Swap duplicates instantly" },
  { icon: Trophy,  label: "Track your album progress" },
  { icon: Shield,  label: "Verified trades & ratings" },
];

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
      if (await isNativeIOS() || await isNativeAndroid()) {
        const { Browser } = await import("@capacitor/browser");
        const { App } = await import("@capacitor/app");

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: DEEP_LINK_CALLBACK, skipBrowserRedirect: true },
        });
        if (error || !data?.url) throw new Error(error?.message ?? "Could not get OAuth URL");

        await Browser.open({ url: data.url });

        const listener = await App.addListener("appUrlOpen", async ({ url }) => {
          if (!url.startsWith("io.swapstrat.app://")) return;
          await listener.remove();
          await Browser.close();
          const fragment = url.split("#")[1] ?? url.split("?")[1] ?? "";
          const p = new URLSearchParams(fragment);
          const access_token = p.get("access_token");
          const refresh_token = p.get("refresh_token");
          if (access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
            nav("/", { replace: true });
          } else {
            toast.error("Sign-in failed — try again");
          }
          setBusy(false);
        });
        return;
      }

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
      toast.success("Test users created.");
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
      toast.error("Test user not found. Click 'Refresh test users' first.");
      setBusy(false);
      return;
    }
    const { error: vErr } = await supabase.auth.verifyOtp({
      token_hash: data.token_hash,
      type: "magiclink",
    });
    if (vErr) { toast.error(vErr.message); setBusy(false); return; }
    nav("/", { replace: true });
  };

  if (!loading && user) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen bg-background flex">

      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex flex-col w-[480px] shrink-0 bg-card border-r border-border p-10 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <Link to="/" className="text-2xl font-black text-primary mb-12 relative">SwapStrat</Link>

        <div className="relative flex-1">
          <h1 className="text-4xl font-black leading-tight mb-4">
            Your collection<br />is waiting.
          </h1>
          <p className="text-muted-foreground text-base mb-10 leading-relaxed">
            Match with nearby collectors and complete the FIFA World Cup 2026 album — one swap at a time.
          </p>

          <div className="space-y-4 mb-10">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div className="bg-background border border-border rounded-xl p-5">
            <p className="text-sm text-foreground leading-relaxed mb-3">
              "Found 6 missing stickers in one afternoon. This app is genuinely useful."
            </p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">— Marco T., Geneva</span>
              <span className="text-xs text-primary font-bold tracking-wide">★★★★★</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <Link to="/" className="block text-xl font-black text-primary mb-8 lg:hidden">SwapStrat</Link>

          <h2 className="text-2xl font-black mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">Sign in to continue trading</p>

          {/* Google */}
          <button
            onClick={google}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-3.5 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-card/80 transition-all text-sm font-semibold disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <p className="text-[11px] text-muted-foreground text-center mt-5">
            By continuing you agree to our Terms & Privacy Policy.
          </p>

          <div className="mt-6 pt-5 border-t border-border text-center">
            <p className="text-sm text-muted-foreground">
              Don't have the app?{" "}
              <Link to="/download" className="text-primary font-semibold hover:underline">
                Download it <ArrowRight className="w-3 h-3 inline" />
              </Link>
            </p>
          </div>

          {/* Dev test users */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-5 border-t border-border">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                Dev — test accounts
              </p>
              <Button variant="outline" size="sm" className="w-full mb-3" onClick={seed} disabled={busy}>
                Refresh test users
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
        </div>
      </div>
    </div>
  );
}
