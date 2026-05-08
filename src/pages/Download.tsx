import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Smartphone, Apple, Download, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APK_URL = "https://github.com/Jeffremm10/sticker-matchup/releases/latest/download/swapstrat.apk";

async function downloadWithNotification() {
  // Trigger the download
  const a = document.createElement("a");
  a.href = APK_URL;
  a.download = "swapstrat.apk";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  if (!("Notification" in window)) return;

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  if (permission !== "granted") return;

  // Fire immediately so they see it in the notification bar
  new Notification("SwapStrat is downloading…", {
    body: "When the download finishes, tap this notification to install.",
    icon: "/favicon.ico",
    tag: "swapstrat-download",
  });

  // Fire again after ~8s when download is likely done
  setTimeout(() => {
    const n = new Notification("SwapStrat — ready to install", {
      body: 'Open Files → Downloads → tap swapstrat.apk → Install',
      icon: "/favicon.ico",
      tag: "swapstrat-install",
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  }, 8000);
}

function InstallGuide({ onClose }: { onClose: () => void }) {
  const steps = [
    { n: "1", title: 'Tap "Download anyway"', body: 'Chrome will warn the file might be harmful — this is shown for every APK outside the Play Store. Tap Download anyway.' },
    { n: "2", title: "Allow Chrome to install apps", body: 'If Chrome says your phone isn\'t allowed to install unknown apps, tap Settings → turn on "Install unknown apps" for Chrome → go back.' },
    { n: "3", title: "Open the downloaded file", body: "Look for a download bar at the bottom of Chrome — tap Open. Or open your Files app → Downloads → tap swapstrat.apk." },
    { n: "4", title: "Tap Install", body: "Android will show an install screen. Tap Install and wait a few seconds. Done." },
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card border border-border rounded-t-2xl md:rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-black text-base">How to install</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                {s.n}
              </span>
              <div>
                <p className="font-bold text-sm mb-0.5">{s.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-6 pb-6">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
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
    const { error } = await (supabase as any)
      .from("ios_waitlist")
      .insert({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error?.code === "23505") { toast.info("You're already on the list."); setDone(true); return; }
    if (error) { toast.error("Something went wrong — try again."); return; }
    setDone(true);
    toast.success("You're on the list!");
  };

  if (done) {
    return (
      <div className="flex items-center gap-3 w-full py-3.5 px-4 rounded-xl bg-primary/10 border border-primary/20">
        <Check className="w-5 h-5 text-primary shrink-0" />
        <span className="text-sm font-semibold text-primary">You're on the waitlist — we'll email you when iOS launches.</span>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 w-full">
      <input
        type="email"
        required
        placeholder="your@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm focus:outline-none focus:border-primary transition-colors placeholder:text-muted-foreground"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm disabled:opacity-50"
      >
        {busy ? "Joining…" : "Join iOS waitlist"}
      </button>
    </form>
  );
}

export default function DownloadPage() {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {showGuide && <InstallGuide onClose={() => setShowGuide(false)} />}

      {/* Nav */}
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
            <div className="p-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-1">Android</h2>
              <p className="text-muted-foreground text-sm mb-6">Available now · Android 8.0+</p>

              <button
                onClick={downloadWithNotification}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity"
              >
                <Download className="w-5 h-5" /> Download APK
              </button>

              {/* Always-visible install steps */}
              <div className="mt-5 space-y-3">
                {[
                  { title: 'Tap "Download anyway"', body: 'Chrome warns every APK is harmful. Tap Download anyway.' },
                  { title: 'Enable unknown apps for Chrome', body: 'Chrome shows "not allowed to install". Tap Settings → flip the switch to Allow → tap the back arrow to return to Chrome.' },
                  { title: 'Open Files → Downloads → swapstrat.apk', body: 'Open your Files or My Files app. Tap Downloads. Tap swapstrat.apk. The Android install screen appears.' },
                  { title: 'Tap Install', body: 'Tap Install on the Android prompt. Done.' },
                ].map((step, i) => (
                  <div key={i} className="flex gap-3 items-start">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-black flex items-center justify-center shrink-0 text-[10px] mt-0.5">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-foreground">{step.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                ))}
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
              <p className="text-muted-foreground text-sm mb-6">Coming to the App Store — join the waitlist</p>
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
