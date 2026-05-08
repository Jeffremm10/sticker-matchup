import { Link } from "react-router-dom";
import { ArrowLeft, Smartphone, Apple, Download, Bell } from "lucide-react";

const APK_URL = "https://github.com/Jeffremm10/sticker-matchup/releases/latest/download/swapstrat.apk";

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <span className="text-xl font-black text-primary">SwapStrat</span>
          <Link to="/auth" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
            Sign in
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
          <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden relative">
            <div className="h-1 bg-primary" />
            <div className="p-8">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
                <Smartphone className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-2xl font-black mb-1">Android</h2>
              <p className="text-muted-foreground text-sm mb-6">Available now · Android 8.0+</p>

              <a
                href={APK_URL}
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
          <div className="bg-card border border-border rounded-2xl overflow-hidden opacity-70">
            <div className="h-1 bg-border" />
            <div className="p-8">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-5">
                <Apple className="w-6 h-6 text-muted-foreground" />
              </div>
              <h2 className="text-2xl font-black mb-1 text-muted-foreground">iPhone</h2>
              <p className="text-muted-foreground text-sm mb-6">Coming to the App Store</p>

              <button
                disabled
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-muted text-muted-foreground font-bold text-base cursor-not-allowed border border-border"
              >
                <Apple className="w-5 h-5" /> Coming Soon
              </button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Join the waitlist to be notified
              </p>
            </div>
          </div>
        </div>

        {/* iOS waitlist */}
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col md:flex-row items-center gap-6 mb-16">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-bold text-base mb-1">Get notified when iOS launches</h3>
            <p className="text-sm text-muted-foreground">We'll send you a one-time email the moment it's live on the App Store.</p>
          </div>
          <a
            href="mailto:martijeffre@gmail.com?subject=iOS%20Waitlist&body=Please%20notify%20me%20when%20SwapStrat%20launches%20on%20iOS."
            className="shrink-0 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-opacity"
          >
            Join waitlist
          </a>
        </div>

        {/* Install instructions */}
        <div className="bg-card border border-border rounded-2xl p-8">
          <h3 className="font-black text-lg mb-6">How to install the Android APK</h3>
          <ol className="space-y-4">
            {[
              "Tap Download APK above to save the file to your device.",
              'Open your Downloads folder and tap the file. If prompted, allow "Install unknown apps" for your browser.',
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
            <Link to="/auth" className="hover:text-foreground transition-colors">Sign in</Link>
            <a href="mailto:martijeffre@gmail.com" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <span>© 2026 SwapStrat</span>
        </div>
      </footer>
    </div>
  );
}
