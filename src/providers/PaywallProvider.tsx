import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Crown, Zap, Compass, Trophy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

export type ProductId = "lifetime_pass" | "nudge" | "super_swipe" | "final_10";

const COPY: Record<ProductId, { title: string; subtitle: string; bullets: string[]; price: string; icon: any; color: string }> = {
  lifetime_pass: {
    title: "SwapStrat Lifetime Pass",
    subtitle: "One payment. Forever.",
    bullets: ["Unlimited swipes", "Unlimited nudges", "Unlimited super swipes", "PRO badge"],
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
  const [busy, setBusy] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  // After Stripe redirects back, verify payment and unlock
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment_success") !== "1") return;
    const productId = params.get("product") ?? "lifetime_pass";
    const sessionId = params.get("session_id");
    window.history.replaceState({}, "", window.location.pathname);
    toast.info("Verifying payment…");
    supabase.functions.invoke("verify-stripe-session", { body: { product_id: productId, session_id: sessionId } })
      .then(({ data }) => {
        if (data?.ok) {
          toast.success(productId === "lifetime_pass" ? "Lifetime Pass unlocked! 🎉" : "Purchase complete!");
          qc.invalidateQueries({ queryKey: ["profile", user?.id] });
        } else {
          toast.error("Could not verify payment — contact support.");
        }
      });
  }, []); // eslint-disable-line

  const fetchCheckoutUrl = useCallback(async (p: ProductId) => {
    const { data, error } = await supabase.functions.invoke("create-checkout-session", {
      body: { product_id: p, app_url: window.location.origin },
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
    setOpen(true);
    fetchCheckoutUrl(p);
  }, [profile?.is_pro, fetchCheckoutUrl]);

  const closePaywall = useCallback(() => setOpen(false), []);

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

              {checkoutUrl ? (
                <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="w-full"
                  onClick={() => setOpen(false)}>
                  <Button size="lg" className="w-full font-black text-base">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Pay now — {c.price}
                  </Button>
                </a>
              ) : (
                <Button size="lg" disabled className="w-full font-black text-base">
                  Loading…
                </Button>
              )}

              <p className="text-[10px] text-muted-foreground text-center mt-2">
                Secure payment via Stripe. Opens in a new tab.
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallCtx.Provider>
  );
}
