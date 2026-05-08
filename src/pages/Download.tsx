import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Smartphone, Apple, Download, Check, X, ArrowDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APK_URL = "https://github.com/Jeffremm10/sticker-matchup/releases/latest/download/swapstrat.apk";

function InstallGuide({ onClose }: { onClose: () => void }) {
  const steps = [
    { icon: "📥", title: "Download started", body: 'If Chrome asked about "harmful file", tap Download anyway.' },
    { icon: "⚙️", title: "Allow installation", body: 'If Chrome says "not allowed to install unknown apps", tap Settings → enable Install unknown apps → go back and tap the file again.' },
    { icon: "📂", title: "Open the file", body: "Pull down your notification bar and tap the SwapStrat download. Or open your Files / Downloads app and tap swapstrat.apk." },
    { icon: "✅", title: "Tap Install", body: "Follow the Android install prompt and tap Install. Takes a few seconds." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="font-black text-base">Installing SwapStrat</span>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {steps.map((s, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">{s.icon}</div>
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
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
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
    if (error?.code === "23505") {
      toast.info("You're already on the list.");
      setDone(true);
      return;
    }
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
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
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

        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-black mb-4">Get the App</h1>
          <p className="text-muted-foreground text-lg max-w-md mx-auto">
            Trade stickers on the go. Scan, match, and swap — right from your pocket.
          </p>
        </div>

        {/* Platform cards */}
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
              <a
                href={APK_URL}
                onClick={() => setTimeout(() => setShowGuide(true), 800)}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity"
              >
                <Download className="w-5 h-5" /> Download APK
              </a>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Free · No account required to browse
              </p>
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

        {/* Install instructions */}
        <div className="bg-card border border-border rounded-2xl p-8">
          <h3 className="font-black text-lg mb-2">How to install the Android APK</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Android will warn that the file "might be harmful" — this is a standard system message shown for every APK downloaded outside the Play Store. Tap <strong className="text-foreground">Download anyway</strong> to continue.
          </p>
          <ol className="space-y-4">
            {[
              'Tap Download APK. When Chrome warns "File might be harmful", tap Download anyway.',
              'If Chrome says your phone isn\'t allowed to install unknown apps, tap Settings and enable "Install unknown apps" for Chrome, then go back.',
              "Open your Downloads folder and tap swapstrat.apk.",
              "Follow the installation prompt and tap Install.",
              "Open SwapStrat and sign in with Google.",
            ].map((step, i) => (
              <li key={i} className="flex gap-4 items-start">
                <span className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-muted-foreground leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </main>

      {/* Footer */}
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
