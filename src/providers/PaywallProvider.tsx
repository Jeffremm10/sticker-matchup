import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sparkles, Smartphone, Crown, Zap, Compass, Trophy } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { configureIAP, getOfferings, purchase, restorePurchases, isNative } from "@/lib/iap";

export type ProductId =
  | "lifetime_pass_1499"
  | "nudge_299"
  | "super_swap_3pk_299"
  | "final_10_499";

const COPY: Record<ProductId, { title: string; subtitle: string; bullets: string[]; price: string; icon: any; color: string }> = {
  lifetime_pass_1499: {
    title: "SwapStrat Lifetime Pass",
    subtitle: "One payment. Forever.",
    bullets: ["Unlimited swipes", "See who likes you", "Priority placement (3× boost)", "PRO badge"],
    price: "$14.99",
    icon: Crown,
    color: "from-amber-500 to-orange-500",
  },
  super_swap_3pk_299: {
    title: "Super Swaps · 3-pack",
    subtitle: "Skip the swipe queue",
    bullets: ["Send a direct message — no match needed", "3 Super Swaps", "Stand out from the crowd"],
    price: "$2.99",
    icon: Zap,
    color: "from-blue-500 to-cyan-500",
  },
  nudge_299: {
    title: "Nudge · Find a top match",
    subtitle: "Algorithm picks one for you",
    bullets: ["Reveal a hand-picked collector nearby", "Filtered for ≥5 stickers you need", "1 use"],
    price: "$2.99",
    icon: Compass,
    color: "from-violet-500 to-fuchsia-500",
  },
  final_10_499: {
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
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<ProductId | null>(null);
  const [native, setNative] = useState(false);
  const [livePrice, setLivePrice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Configure SDK on login
  useEffect(() => {
    if (!user) return;
    (async () => {
      const ok = await configureIAP(user.id);
      setNative(ok);
    })();
  }, [user]);

  const showPaywall = useCallback((p: ProductId) => {
    setProduct(p);
    setLivePrice(null);
    setOpen(true);
    isNative().then(async (n) => {
      setNative(n);
      if (n) {
        const offerings = await getOfferings();
        if (offerings[p]?.price) setLivePrice(offerings[p].price);
      }
    });
  }, []);

  const closePaywall = useCallback(() => setOpen(false), []);

  const buy = async () => {
    if (!product || !user) return;
    setBusy(true);
    try {
      const r = await purchase(product);
      if (r.ok) {
        // Belt-and-suspenders: verify with server so unlock is instant
        await supabase.functions.invoke("verify-purchase", { body: { product_id: product } });
        toast.success("Purchase complete 🎉");
        qc.invalidateQueries({ queryKey: ["profile", user.id] });
        setOpen(false);
      } else if (r.cancelled) {
        // user cancelled, no toast
      } else if (r.webBlocked) {
        toast.error("Purchases happen in the SwapStrat mobile app");
      } else {
        toast.error(r.error ?? "Purchase failed");
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    const r = await restorePurchases();
    setBusy(false);
    if (r.ok) {
      await supabase.functions.invoke("verify-purchase", { body: { product_id: "lifetime_pass_1499" } });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast.success("Restored");
    } else if (r.webBlocked) {
      toast.error("Restore happens in the mobile app");
    } else {
      toast.error(r.error ?? "Nothing to restore");
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
              {!native && (
                <div className="bg-secondary border border-border rounded-xl p-4 text-sm flex items-start gap-3 mb-3">
                  <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold mb-1">Available in the mobile app</div>
                    <p className="text-xs text-muted-foreground">
                      Purchases run through Apple App Store and Google Play. Install SwapStrat on your phone to unlock.
                    </p>
                  </div>
                </div>
              )}
              <Button
                size="lg"
                disabled={!native || busy}
                className="w-full font-black text-base"
                onClick={buy}
              >
                {busy ? "Processing…" : `Unlock — ${livePrice ?? c.price}`}
              </Button>
              <Button variant="ghost" size="sm" className="w-full mt-2" onClick={restore} disabled={busy}>
                Restore purchases
              </Button>
              <p className="text-[10px] text-muted-foreground text-center mt-3">
                Billed via Apple/Google. Cancel anytime in your store account (subscriptions only — Lifetime is one-time).
              </p>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PaywallCtx.Provider>
  );
}