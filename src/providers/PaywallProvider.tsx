import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Smartphone, Crown, Zap, Compass, Trophy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { configureIAP, getOfferings, purchase, restorePurchases, isNative } from "@/lib/iap";

const STRIPE_ENABLED = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export type ProductId =
  | "lifetime_pass"
  | "nudge"
  | "super_swipe"
  | "final_10";

const COPY: Record<ProductId, { title: string; subtitle: string; bullets: string[]; price: string; icon: any; color: string }> = {
  lifetime_pass: {
    title: "SwapStrat Lifetime Pass",
    subtitle: "One payment. Forever.",
    bullets: ["Unlimited swipes", "See who likes you", "Priority placement (3× boost)", "PRO badge"],
    price: "$14.99",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
  },
  super_swipe: {
    title: "Super Swaps · 3-pack",
    subtitle: "Skip the swipe queue",
    bullets: ["Send a direct message — no match needed", "3 Super Swaps", "Stand out from the crowd"],
    price: "$2.99",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
  },
  nudge: {
    title: "Nudge · Find a top match",
    subtitle: "Algorithm picks one for you",
    bullets: ["Reveal a hand-picked collector nearby", "Filtered for ≥5 stickers you need", "1 use"],
    price: "$2.99",
    icon: Compass,
    color: "from-violet-500 to-fuchsia-500",
  },
  final_10: {
    title: "Final 10 Insurance",
    subtitle: "Finish the album",
    bullets: ["Match only with collectors who hold your last cards", "Priority distribution worldwide", "Until you complete"],
    price: "$4.99",
    icon: Trophy,
    color: "from-emerald-500 to-teal-500",
  },
};

type Ctx = { showPaywall: (p: ProductId) => void; closePaywall: () => void };
const PaywallCtx = createContext<Ctx>({ showPaywall: () => {}, closePaywall: () => {} });

export const usePaywall = () => useContext(PaywallCtx);

export function PaywallProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<ProductId | null>(null);
  const [native, setNative] = useState(false);
  const [livePrice, setLivePrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Configure SDK on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ok = await configureIAP(user.id);
      setNative(ok);
    })();
  }, [user]);

  // Detect successful Stripe return — verify with server and unlock
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") !== "1") return;
    const product = params.get("product") ?? "lifetime_pass";
    window.history.replaceState({}, "", window.location.pathname);
    toast.info("Verifying payment…");
    supabase.functions.invoke("verify-stripe-session", { body: { product_id: product } })
      .then(({ data }) => {
        if (data?.ok) {
          toast.success(product === "lifetime_pass" ? "Lifetime Pass unlocked! 🎉" : "Purchase complete!");
          qc.invalidateQueries({ queryKey: ["profile", user?.id] });
        } else {
          toast.error("Payment not confirmed yet — try again in a moment.");
        }
      });
  }, []);

  const showPaywall = useCallback((p: ProductId) => {
    if (p === "lifetime_pass" && profile?.is_pro) {
      toast.info("You already have the Lifetime Pass!");
      return;
    }
    setProduct(p);
    setLivePrice(null);
    setCheckoutUrl(null);
    setOpen(true);
    isNative().then(async (n) => {
      setNative(n);
      if (n) {
        const offerings = await getOfferings();
        if (offerings[p]?.price) setLivePrice(offerings[p].price);
      }
    });
    // Pre-fetch Stripe URL immediately so button is ready
    if (STRIPE_ENABLED && user) {
      supabase.functions.invoke("create-checkout-session", {
        body: { product_id: p, app_url: window.location.origin },
      }).then(({ data, error }) => {
        if (!error && data?.url) setCheckoutUrl(data.url);
      });
    }
  }, [user]);

  const closePaywall = useCallback(() => setOpen(false), []);

  const buy = async () => {
    if (!product || !user) return;
    if (STRIPE_ENABLED) {
      // URL already pre-fetched — if not ready yet, fetch now
      if (!checkoutUrl) {
        setBusy(true);
        const { data, error } = await supabase.functions.invoke("create-checkout-session", {
          body: { product_id: product, app_url: window.location.origin },
        });
        setBusy(false);
        if (error || !data?.url) { toast.error("Could not create checkout"); return; }
        setCheckoutUrl(data.url);
      }
      return;
    }
    setBusy(true);
    try {
      const r = await purchase(product);
      if (r.ok) {
        await supabase.functions.invoke("verify-purchase", { body: { product_id: product } });
        toast.success("Purchase complete!");
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
        setOpen(false);
      } else if ("cancelled" in r && r.cancelled) {
        // user cancelled
      } else {
        toast.error(("error" in r && r.error) || "Purchase failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (STRIPE_ENABLED) {
      toast.info("Purchases are linked to your account — just sign in to restore.");
      return;
    }
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    if (r.ok) {
      await supabase.functions.invoke("verify-purchase", { body: { product_id: "lifetime_pass" } });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Restored");
    } else {
      toast.error(("error" in r && r.error) || "Nothing to restore");
    }
  };

  const c = product ? COPY[product] : null;
  const Icon = c?.icon ?? Sparkles;

  return (
    <PaywallCtx.Provider value={{ showPaywall, closePaywall }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
          {c && (
            <>
              <div className={`-mx-6 -mt-6 px-6 pt-8 pb-6 bg-gradient-to-br ${c.color} text-white rounded-b-3xl`}>
                <div className="flex items-center gap-3">
                  <div className="bg-white/20 backdrop-blur rounded-2xl p-3">
                    <Icon className="w-7 h-7" />
                  </div>
                  <div>
                    <SheetTitle className="text-white text-2xl font-black">{c.title}</SheetTitle>
                    <SheetDescription className="text-white/90">{c.subtitle}</SheetDescription>
                  </div>
                </div>
              </div>
              <div className="py-5 space-y-3">
                {c.bullets.map((b) => (
                  <div key={b} className="flex items-start gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </div>
                ))}
              </div>
              {STRIPE_ENABLED && checkoutUrl ? (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full"
                  onClick={() => {
                    setTimeout(() => qc.invalidateQueries({ queryKey: ["profile", user?.id] }), 10000);
                    setOpen(false);
                  }}
                >
                  <Button size="lg" className="w-full font-black text-base">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Pay now — {livePrice ?? c.price}
                  </Button>
                </a>
              ) : (
                <Button
                  size="lg"
                  disabled={busy}
                  className="w-full font-black text-base"
                  onClick={buy}
                >
                  {busy ? "Loading…" : `Unlock — ${livePrice ?? c.price}`}
                </Button>
              )}
              {STRIPE_ENABLED && (
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  Secure payment via Stripe. Opens in a new tab.
                </p>
              )}
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={restore} disabled={busy}>
                Restore purchases
              </Button>
              {!STRIPE_ENABLED && (
                <p className="text-[10px] text-muted-foreground text-center mt-3">
                  Billed via Apple/Google. Cancel anytime in your store account.
                </p>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallCtx.Provider>
  );
}