import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Smartphone, Apple, Download, Check, Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APK_URL = "https://github.com/Jeffremm10/sticker-matchup/releases/latest/download/swapstrat.apk";

function NotificationButton({ onReady }: { onReady: (granted: boolean) => void }) {
  const [state, setState] = useState<"idle" | "granted" | "denied">("idle");

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") { setState("granted"); onReady(true); }
    if (Notification.permission === "denied") setState("denied");
  }, []);

  const request = async () => {
    if (!("Notification" in window)) { toast.error("Notifications not supported in this browser."); return; }
    const p = await Notification.requestPermission();
    if (p === "granted") { setState("granted"); onReady(true); toast.success("Notifications enabled!"); }
    else { setState("denied"); toast.error("Permission denied — you'll need to find the file in Downloads manually."); }
  };

  if (state === "granted") return (
    <div className="flex items-center gap-2 text-xs text-primary font-semibold">
      <Bell className="w-4 h-4" /> Notifications enabled — we'll ping you when the download is ready to install
    </div>
  );

  if (state === "denied") return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <BellOff className="w-4 h-4" /> Notifications blocked — go to browser settings to allow them
    </div>
  );

  return (
    <button
      onClick={request}
      className="flex items-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm font-semibold hover:border-primary/40 transition-colors"
    >
      <Bell className="w-4 h-4 text-primary" /> Enable install notification first
    </button>
  );
}

function IosWaitlist() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    const { error } = await (supabase as any).from("ios_waitlist").insert({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error?.code === "23505") { toast.info("You're already on the list."); setDone(true); return; }
    if (error) { toast.error("Something went wrong — try again."); return; }
    setDone(true);
    toast.success("You're on the list!");
  };

  if (done) return (
    <div className="flex items-center gap-3 w-full py-3.5 px-4 rounded-xl bg-primary/10 border border-primary/20">
      <Check className="w-5 h-5 text-primary shrink-0" />
      <span className="text-sm font-semibold text-primary">You're on the waitlist.</span>
    </div>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full">
      <input type="email" required placeholder="your@email.com" value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground" />
      <button type="submit" disabled={busy}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50">
        {busy ? "Joining…" : "Join iOS waitlist"}
      </button>
    </form>
  );
}

export default function DownloadPage() {
  const [notifGranted, setNotifGranted] = useState(false);

  const handleDownload = () => {
    if (notifGranted) {
      setTimeout(() => {
        new Notification("SwapStrat downloaded", {
          body: "Tap the download bar in your browser and tap Install.",
          icon: "/favicon.ico",
          requireInteraction: true,
        });
      }, 6000);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">

      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-xl font-black text-primary">SwapStrat</span>
          <Link to="/auth" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Use web app
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 pt-32 pb-20">

        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black mb-4">Get the App</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Trade stickers on the go. Match, swap, complete the album.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-16">

          {/* Android */}
          <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden">
            <div className="h-1 bg-primary" />
            <div className="p-8 space-y-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-black mb-1">Android</h2>
                <p className="text-muted-foreground text-sm">Available now · Android 8.0+</p>
              </div>

              {/* Step 1: enable notification */}
              <NotificationButton onReady={setNotifGranted} />

              {/* Step 2: download */}
              <a
                href={APK_URL}
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity"
              >
                <Download className="w-5 h-5" /> Download APK
              </a>

              {/* Install steps */}
              <div className="space-y-3 pt-2 border-t border-border">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">How to install</p>
                {[
                  { n: "1", t: "Enable notifications above", b: "Tap the button above and allow — we'll notify you the moment your download is ready to install." },
                  { n: "2", t: 'Tap "Download anyway"', b: "Your browser shows a safety warning for every APK downloaded outside the Play Store. This is standard — tap Download anyway." },
                  { n: "3", t: "Allow your browser to install apps", b: 'If you see "not allowed to install unknown apps", tap Settings → enable "Allow from this source" → press Back.' },
                  { n: "4", t: "Google Play Protect scans the app", b: "Android automatically scans SwapStrat before installing. This is normal and takes a few seconds — it will pass." },
                  { n: "5", t: "Tap Install", b: "The install screen appears. Tap Install and you're done." },
                ].map((s) => (
                  <div key={s.n} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{s.t}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{s.b}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Trust badge */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <span className="text-base mt-0.5">🛡</span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Safe to install.</strong> Google Play Protect scans every APK before it installs. SwapStrat contains no malware, no trackers, and no background processes.
                </p>
              </div>
            </div>
          </div>

          {/* iOS */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="h-1 bg-border" />
            <div className="p-8">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-5">
                <Apple className="w-6 h-6 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-black mb-1">iPhone</h2>
              <p className="text-muted-foreground text-sm mb-6">Coming to the App Store</p>
              <IosWaitlist />
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-black text-primary">SwapStrat</span>
          <div className="flex gap-6">
            <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Use web app</Link>
            <a href="mailto:martijeffre@gmail.com" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <span>© 2026 SwapStrat</span>
        </div>
      </footer>
    </div>
  );
}
