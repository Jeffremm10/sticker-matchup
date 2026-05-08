import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, Zap, Compass, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { configureIAP, getOfferings, purchase, restorePurchases, isNative } from "@/lib/iap";

export type ProductId = "lifetime_pass" | "nudge" | "super_swipe" | "final_10";

const COPY: Record<ProductId, { title: string; subtitle: string; bullets: string[]; price: string; icon: any; color: string }> = {
  lifetime_pass: {
    title: "SwapStrat Lifetime Pass",
    subtitle: "One payment. Forever.",
    bullets: ["Unlimited swipes", "30 Nudges included", "30 Super Swipes included", "Final 10 Insurance included", "See who liked you", "PRO badge"],
    price: "CHF 14.99",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
  },
  super_swipe: {
    title: "Super Swaps · 3-pack",
    subtitle: "Skip the swipe queue",
    bullets: ["Send a direct message — no match needed", "3 Super Swaps", "Stand out from the crowd"],
    price: "CHF 2.99",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
  },
  nudge: {
    title: "Nudge · Find a top match",
    subtitle: "Algorithm picks one for you",
    bullets: ["Reveal a hand-picked collector nearby", "Filtered for ≥5 stickers you need", "1 use"],
    price: "CHF 2.99",
    icon: Compass,
    color: "from-violet-500 to-fuchsia-500",
  },
  final_10: {
    title: "Final 10 Insurance",
    subtitle: "Finish the album",
    bullets: ["Match only with collectors who hold your last cards", "Priority distribution worldwide", "Until you complete"],
    price: "CHF 4.99",
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
  const [onIOS, setOnIOS] = useState(false);
  const [livePrice, setLivePrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // Configure RevenueCat on login, detect iOS
  useEffect(() => {
    if (!user) return;
    (async () => {
      const native = await isNative();
      if (native) {
        await configureIAP(user.id);
        // Check if iOS specifically
        try {
          const capName = "@capacitor/core";
          // @ts-ignore
          const cap = (await import(/* @vite-ignore */ capName)).Capacitor;
          setOnIOS(cap?.getPlatform?.() === "ios");
        } catch { setOnIOS(false); }
      }
    })();
  }, [user]);

  // Verify payment from Stripe redirect (web) or deep link (native)
  const verifyPayment = useCallback(async (productId: string, sessionId: string | null) => {
    toast.info("Verifying payment…");
    const { data } = await supabase.functions.invoke("verify-stripe-session", {
      body: { product_id: productId, session_id: sessionId },
    });
    if (data?.ok) {
      toast.success(productId === "lifetime_pass" ? "Lifetime Pass unlocked! 🎉" : "Purchase complete!");
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
    } else {
      toast.error("Could not verify payment — contact support.");
    }
  }, [qc, user?.id]);

  // Web: Stripe redirects back with ?payment_success=1
  // Guard with user — on Android the success URL loads inside Chrome Custom Tab where
  // there is no session, causing a spurious "couldn't verify" toast. The native path
  // (browserFinished listener below) handles verification for Android.
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") !== "1") return;
    const productId = params.get("product") ?? "lifetime_pass";
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);
    verifyPayment(productId, sessionId);
  }, [user]); // eslint-disable-line

  // Native: Stripe redirects to io.swapstrat.app://payment-return?...
  useEffect(() => {
    let listener: any;
    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        listener = await App.addListener("appUrlOpen", ({ url }) => {
          if (!url.startsWith("io.swapstrat.app://payment-return")) return;
          const search = url.split("?")[1] ?? "";
          const p = new URLSearchParams(search);
          if (p.get("payment_success") === "1") {
            verifyPayment(p.get("product") ?? "lifetime_pass", p.get("session_id"));
          }
        });
      } catch { /* not native */ }
    })();
    return () => { listener?.remove(); };
  }, [verifyPayment]);


  const fetchStripeUrl = useCallback(async (p: ProductId) => {
    const isNative = window.location.hostname === "localhost";
    const app_url = isNative ? "https://swap-n-stack.lovable.app" : window.location.origin;
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { product_id: p, app_url, native: isNative },
    });
    if (!error && data?.url) setCheckoutUrl(data.url);
    else toast.error("Could not load checkout. Try again.");
  }, []);

  const showPaywall = useCallback((p: ProductId) => {
    if (p === "lifetime_pass" && profile?.is_pro) {
      toast.info("You already have the Lifetime Pass!");
      return;
    }
    setProduct(p);
    setCheckoutUrl(null);
    setLivePrice(null);
    setOpen(true);

    if (onIOS) {
      // iOS: load live price from RevenueCat
      getOfferings().then((offerings) => {
        if (offerings[p]?.price) setLivePrice(offerings[p].price);
      });
    } else {
      // Web / Android: pre-fetch Stripe checkout URL
      fetchStripeUrl(p);
    }
  }, [profile?.is_pro, onIOS, fetchStripeUrl]);

  const closePaywall = useCallback(() => setOpen(false), []);

  // iOS purchase via RevenueCat / Apple IAP
  const buyWithIAP = async () => {
    if (!product || !user) return;
    setBusy(true);
    try {
      const r = await purchase(product);
      if (r.ok) {
        await supabase.functions.invoke("verify-purchase", { body: { product_id: product } });
        toast.success("Purchase complete!");
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
        setOpen(false);
      } else if ("cancelled" in r && r.cancelled) {
        // user cancelled — no toast
      } else {
        toast.error(("error" in r && r.error) || "Purchase failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const restoreIAP = async () => {
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    if (r.ok) {
      await supabase.functions.invoke("verify-purchase", { body: { product_id: "lifetime_pass" } });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Restored!");
    } else {
      toast.error(("error" in r && r.error) || "Nothing to restore");
    }
  };

  const c = product ? COPY[product] : null;
  const Icon = c?.icon ?? Sparkles;
  const displayPrice = livePrice ?? c?.price;

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

              {onIOS ? (
                <>
                  <Button size="lg" disabled={busy} className="w-full font-black text-base" onClick={buyWithIAP}>
                    {busy ? "Processing…" : `Unlock — ${displayPrice}`}
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={restoreIAP} disabled={busy}>
                    Restore purchases
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Billed via Apple. Manage in your App Store account.
                  </p>
                </>
              ) : checkoutUrl ? (
                <>
                  <Button size="lg" className="w-full font-black text-base"
                    onClick={async () => {
                      setOpen(false);
                      if (window.location.hostname === "localhost") {
                        // Native: open Stripe in Chrome Custom Tab.
                        // Extract the session ID from the checkout URL upfront so we
                        // can verify payment when the browser closes — no redirect needed.
                        const m = checkoutUrl.match(/\/(cs_(?:test|live)_[^#?/]+)/);
                        const sessionId = m?.[1] ?? null;
                        const pendingProduct = product ?? "lifetime_pass";
                        const { Browser } = await import("@capacitor/browser");
                        const bl = await Browser.addListener("browserFinished", async () => {
                          await bl.remove();
                          await verifyPayment(pendingProduct, sessionId);
                        });
                        await Browser.open({ url: checkoutUrl });
                      } else {
                        window.location.href = checkoutUrl;
                      }
                    }}>
                    Pay now — {displayPrice}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center mt-2">
                    Secure payment via Stripe.
                  </p>
                </>
              ) : (
                <Button size="lg" disabled className="w-full font-black text-base">
                  Loading…
                </Button>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallCtx.Provider>
  );
}
