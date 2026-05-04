import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { SlotTile } from "@/components/album/SlotTile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Trophy, Sparkles, Lock } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

type Candidate = {
  user_id: string; display_name: string; bio: string;
  lat: number | null; lng: number | null; is_pro: boolean;
  receive_count: number; give_count: number;
  receive_ids: number[]; give_ids: number[];
};

const km = (a: any, b: any) => {
  if (!a?.lat || !b?.lat) return null;
  const R = 6371, toRad = (d: number) => d*Math.PI/180;
  const dLat = toRad(b.lat-a.lat), dLng = toRad(b.lng-a.lng);
  const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLng/2)**2;
  return Math.round(2*R*Math.atan2(Math.sqrt(x), Math.sqrt(1-x)));
};

export default function Swipe() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [matchModal, setMatchModal] = useState<{ name: string; matchId: string } | null>(null);

  const { data: me } = useQuery({
    enabled: !!user, queryKey: ["profile", user?.id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });

  const { data: stickers = [] } = useQuery({
    queryKey: ["stickers-lite"],
    queryFn: async () => (await supabase.from("stickers").select("id,code,nation").limit(1100)).data ?? [],
  });
  const stickerMap = new Map(stickers.map((s:any) => [s.id, s]));

  const { data: deck = [], isLoading } = useQuery({
    enabled: !!user, queryKey: ["deck"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_potential_matches", { _limit: 20 });
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const top = deck[0];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);

  const swipe = async (direction: "like" | "dislike") => {
    if (!top) return;
    try {
      const { data, error } = await supabase.rpc("record_swipe", { _receiver: top.user_id, _direction: direction });
      if (error) {
        if (error.message.includes("daily_limit")) toast.error("Daily limit reached. Upgrade to Pro!");
        else toast.error(error.message);
        return;
      }
      const r = (data as any)?.[0];
      qc.setQueryData(["deck"], (old: Candidate[] = []) => old.slice(1));
      x.set(0);
      if (r?.matched) {
        setMatchModal({ name: top.display_name, matchId: r.match_id });
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <AppShell><div className="p-8 text-center">Loading deck…</div></AppShell>;

  return (
    <AppShell>
      <header className="p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">Sticker Swapper</h1>
          <p className="text-xs text-muted-foreground">Swipe to trade</p>
        </div>
        {me?.is_pro ? (
          <Badge className="bg-accent text-accent-foreground"><Trophy className="w-3 h-3 mr-1"/>PRO</Badge>
        ) : null}
      </header>

      <div className="px-4">
        <div className="relative h-[520px]">
          <AnimatePresence>
            {top ? (
              <motion.div
                key={top.user_id}
                style={{ x, rotate }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 120) swipe("like");
                  else if (info.offset.x < -120) swipe("dislike");
                }}
                className="absolute inset-0"
              >
                <CardView c={top} me={me} stickerMap={stickerMap} likeOpacity={likeOpacity} nopeOpacity={nopeOpacity}/>
              </motion.div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-card rounded-2xl border border-border">
                <Sparkles className="w-12 h-12 text-primary mb-2"/>
                <p className="font-bold">No more cards right now</p>
                <p className="text-xs text-muted-foreground mt-1">Mark more stickers in your collection or check back later.</p>
              <Button className="mt-4" onClick={()=>nav("/album")}>Edit Album</Button>
              </div>
            )}
          </AnimatePresence>
        </div>

        {top && (
          <div className="flex justify-center gap-6 mt-4">
            <Button size="lg" variant="outline" className="rounded-full w-16 h-16 border-2" onClick={()=>swipe("dislike")}>
              <X className="w-7 h-7 text-need"/>
            </Button>
            <Button size="lg" className="rounded-full w-16 h-16 bg-primary" onClick={()=>swipe("like")}>
              <Heart className="w-7 h-7"/>
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {matchModal && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            className="fixed inset-0 z-50 bg-secondary/95 flex items-center justify-center p-6">
            <motion.div initial={{scale:0.6}} animate={{scale:1}} className="text-center text-primary-foreground">
              <Trophy className="w-20 h-20 mx-auto text-accent mb-4"/>
              <h2 className="text-4xl font-black mb-2">It's a Trade!</h2>
              <p className="mb-6">You and {matchModal.name} can swap stickers.</p>
              <div className="flex flex-col gap-2">
                <Button size="lg" className="bg-accent text-accent-foreground" onClick={()=>nav(`/chat/${matchModal.matchId}`)}>
                  Start Chat
                </Button>
                <Button variant="ghost" className="text-primary-foreground" onClick={()=>setMatchModal(null)}>
                  Keep Swiping
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function CardView({ c, me, stickerMap, likeOpacity, nopeOpacity }: any) {
  const distance = km(me, c);
  const isPro = !!me?.is_pro;
  const showReceive = c.receive_ids.slice(0, 6);
  const showGive = c.give_ids.slice(0, 6);

  return (
    <div className="w-full h-full bg-card rounded-2xl shadow-[var(--shadow-card)] border border-border overflow-hidden flex flex-col">
      <div className="bg-gradient-to-br from-primary to-secondary text-primary-foreground p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black">{c.display_name}</h2>
            {distance !== null && (
              <p className="text-xs flex items-center gap-1 opacity-80"><MapPin className="w-3 h-3"/>{distance} km away</p>
            )}
          </div>
          {c.is_pro && <Badge className="bg-accent text-accent-foreground">PRO</Badge>}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div className="bg-get rounded-lg p-3 text-center">
            <div className="text-3xl font-black">+{c.receive_count}</div>
            <div className="text-[11px] uppercase tracking-wide">You Get</div>
          </div>
          <div className="bg-give rounded-lg p-3 text-center">
            <div className="text-3xl font-black">−{c.give_count}</div>
            <div className="text-[11px] uppercase tracking-wide">You Give</div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {c.bio && <p className="text-sm text-muted-foreground italic">"{c.bio}"</p>}
        <div>
          <h3 className="text-xs font-bold uppercase text-get flex items-center gap-1 mb-2">
            They have you need {!isPro && <Lock className="w-3 h-3"/>}
          </h3>
          <div className="grid grid-cols-6 gap-1">
            {showReceive.map((id: number) => {
              const s = stickerMap.get(id);
              return s ? <SlotTile key={id} id={id} code={s.code} size="sm"/> : null;
            })}
          </div>
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase text-give mb-2">You have they need</h3>
          <div className="grid grid-cols-6 gap-1">
            {showGive.map((id: number) => {
              const s = stickerMap.get(id);
              return s ? <SlotTile key={id} id={id} code={s.code} size="sm"/> : null;
            })}
          </div>
        </div>
      </div>
      <motion.div style={{ opacity: likeOpacity }} className="absolute top-6 right-6 border-4 border-get text-get font-black text-2xl px-3 py-1 rounded-lg rotate-12">LIKE</motion.div>
      <motion.div style={{ opacity: nopeOpacity }} className="absolute top-6 left-6 border-4 border-need text-need font-black text-2xl px-3 py-1 rounded-lg -rotate-12">NOPE</motion.div>
    </div>
  );
}