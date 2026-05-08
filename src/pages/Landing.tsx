import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { ArrowRight, MapPin, Trophy, Zap, Star, Shield } from "lucide-react";

export default function Landing() {
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user) nav("/album", { replace: true });
  }, [user, loading, nav]);

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-xl font-black text-primary">SwapStrat</span>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
            <a href="#download" className="hover:text-foreground transition-colors">Download</a>
            <Link to="/auth" className="hover:text-foreground transition-colors">Use web app</Link>
          </nav>
          <Link
            to="/auth"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Get started <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-36 pb-20 grid md:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold mb-6">
            <Star className="w-3 h-3" /> FIFA World Cup 2026
          </div>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-6">
            Trade Smarter.<br />
            <span className="text-primary">Complete the Album.</span>
          </h1>
          <p className="text-muted-foreground text-lg mb-8 leading-relaxed">
            Match with nearby collectors, swap duplicates, and finish your FIFA World Cup 2026 sticker album — faster than ever.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/download"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 transition-opacity"
            >
              Download the app <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/auth"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border text-foreground font-medium text-base hover:border-primary/50 transition-colors"
            >
              Use web app
            </Link>
          </div>
        </div>

        {/* Card mockup */}
        <div className="relative hidden md:block">
          <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full" />
          <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
            <div className="h-1 bg-primary w-full" />
            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-bold text-base">Lucas M.</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <MapPin className="w-3 h-3" /> São Paulo · 2.3 km
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-bold border border-primary/20">PRO</span>
              </div>

              <p className="text-xs text-primary font-semibold mb-2">Has 8 stickers you need</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {["BRA·12","ARG·34","FRA·07","GER·28"].map((code) => (
                  <div key={code} className="bg-muted rounded-lg p-2 text-center border border-border">
                    <div className="text-[10px] font-mono text-muted-foreground">{code}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground font-semibold mb-2">Needs 5 stickers you have</p>
              <div className="grid grid-cols-4 gap-2 mb-5">
                {["ESP·03","POR·19","ITA·22","ENG·11"].map((code) => (
                  <div key={code} className="bg-muted/50 rounded-lg p-2 text-center border border-border/50 opacity-60">
                    <div className="text-[10px] font-mono text-muted-foreground">{code}</div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2.5 rounded-lg border border-border text-muted-foreground text-sm font-semibold">Pass</button>
                <button className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold">Like</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            ["50K+", "Collectors worldwide"],
            ["94%", "Match rate"],
            ["4.9", "App rating"],
            ["140+", "Countries"],
          ].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-black text-primary mb-1">{val}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-black mb-3">How it works</h2>
        <p className="text-muted-foreground mb-12">Three steps to complete your collection</p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Trophy, title: "Log your collection", body: "Mark which stickers you have, which you need, and which are duplicates." },
            { icon: MapPin, title: "Discover nearby traders", body: "Swipe through collectors near you. Match when the overlap is worth it." },
            { icon: Zap, title: "Swap and complete", body: "Chat, arrange the exchange, and track your progress to a full album." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card border border-border rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-bold text-base mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Download CTA */}
      <section id="download" className="max-w-6xl mx-auto px-6 pb-20">
        <div className="bg-card border border-border rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          <div>
            <h2 className="text-3xl font-black mb-2">Get the app</h2>
            <p className="text-muted-foreground">Available now on Android. iOS coming soon.</p>
          </div>
          <div className="flex gap-3 relative">
            <Link
              to="/download"
              className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity"
            >
              Download for Android <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-black text-primary">SwapStrat</span>
          <div className="flex gap-6">
            <Link to="/download" className="hover:text-foreground transition-colors">Download</Link>
            <Link to="/auth" className="hover:text-foreground transition-colors">Use web app</Link>
            <a href="mailto:martijeffre@gmail.com" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <span>© 2026 SwapStrat</span>
        </div>
      </footer>
    </div>
  );
}
