import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Lock, Trophy, Zap, Compass, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { usePaywall } from "@/providers/PaywallProvider";

export function ProgressDashboard({ profile }: { profile: any }) {
  const { showPaywall } = usePaywall();

  const { data: counts } = useQuery({
    queryKey: ["progress-counts", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const [{ count: total }, { count: owned }] = await Promise.all([
        supabase.from("stickers").select("*", { count: "exact", head: true }),
        supabase.from("user_inventory").select("*", { count: "exact", head: true }).eq("user_id", profile.id),
      ]);
      return { total: total ?? 0, owned: owned ?? 0 };
    },
  });

  const total = counts?.total ?? 0;
  const owned = counts?.owned ?? 0;
  const threshold = Math.max(total - 10, 0);
  const reached = total > 0 && owned >= threshold;
  const active = !!(profile?.is_final_10_active || profile?.is_pro);

  return (
    <div className="space-y-3">
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-500" />
            <h3 className="font-black">Progress to Complete</h3>
          </div>
          {(profile?.is_pro || profile?.tier === "premium") && (
            <Badge className="bg-amber-500 text-white"><Crown className="w-3 h-3 mr-1" />Lifetime</Badge>
          )}
        </div>
        <Progress value={total > 0 ? (owned / total) * 100 : 0} className="h-2" />
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>{owned} / {total} owned</span>
          <span>{Math.max(total - owned, 0)} to go</span>
        </div>

        {active && reached ? (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-sm">
            <Badge className="bg-emerald-500 text-white mb-1">
              {profile?.is_pro ? "Included in Lifetime Pass" : "Active"}
            </Badge>
            <p className="text-xs text-muted-foreground">
              You're being matched with collectors who hold your last cards.
            </p>
          </div>
        ) : reached && !active ? (
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black"
            onClick={() => showPaywall("final_10")}
          >
            <Trophy className="w-4 h-4 mr-2" /> Activate Final 10 Insurance
          </Button>
        ) : (
          <Button size="lg" disabled className="w-full opacity-60 cursor-not-allowed">
            <Lock className="w-4 h-4 mr-2" /> Unlocks at {threshold}/{total}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          className="bg-card border border-border rounded-xl p-3 text-left hover:bg-secondary transition"
          onClick={() => !profile?.is_pro && showPaywall("super_swipe")}
        >
          <div className="flex items-center justify-between">
            <Zap className="w-4 h-4 text-blue-500" />
            <span className="text-lg font-black">
              {profile?.is_pro ? "∞" : (profile?.super_swap_count ?? 0)}
            </span>
          </div>
          <div className="text-[11px] uppercase font-bold mt-1">Super Swaps</div>
          <div className="text-[10px] text-muted-foreground">
            {profile?.is_pro ? "Included in Lifetime Pass" : "Tap to top up"}
          </div>
        </button>
        <button
          className="bg-card border border-border rounded-xl p-3 text-left hover:bg-secondary transition"
          onClick={() => !profile?.is_pro && showPaywall("nudge")}
        >
          <div className="flex items-center justify-between">
            <Compass className="w-4 h-4 text-violet-500" />
            <span className="text-lg font-black">
              {profile?.is_pro ? "∞" : (profile?.nudge_count ?? 0)}
            </span>
          </div>
          <div className="text-[11px] uppercase font-bold mt-1">Nudges</div>
          <div className="text-[10px] text-muted-foreground">
            {profile?.is_pro ? "Included in Lifetime Pass" : "Tap to top up"}
          </div>
        </button>
      </div>

      {!profile?.is_pro && profile?.tier !== "premium" && (
        <Button
          variant="outline"
          className="w-full border-amber-500/40 text-amber-700 dark:text-amber-300"
          onClick={() => showPaywall("lifetime_pass")}
        >
          <Crown className="w-4 h-4 mr-2" /> Get the Lifetime Pass
        </Button>
      )}
    </div>
  );
}