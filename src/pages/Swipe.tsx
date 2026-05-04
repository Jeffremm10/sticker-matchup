import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { SlotTile } from "@/components/album/SlotTile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, X, MapPin, Trophy, Sparkles, Lock, Eye, SlidersHorizontal, ArrowLeftRight } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const [maxKm, setMaxKm] = useState<number>(0); // 0 = no limit
  const [showLikes, setShowLikes] = useState(false);

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
    enabled: !!user, queryKey: ["deck", maxKm],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_potential_matches", {
        _limit: 20,
        _max_km: maxKm > 0 ? maxKm : null,
      } as any);
      if (error) throw error;
      return data as Candidate[];
    },
  });

  const { data: likesYou = [] } = useQuery({
    enabled: !!user, queryKey: ["likes-received", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_likes_received");
      if (error) throw error;
      return data as any[];
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
      qc.invalidateQueries({ queryKey: ["likes-received"] });
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
      <header className="p-4 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-black">Sticker Swapper</h1>
          <p className="text-xs text-muted-foreground">{maxKm > 0 ? `Within ${maxKm} km` : "Anywhere"}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="relative" onClick={() => setShowLikes(true)}>
            <Eye className="w-4 h-4 mr-1"/> Likes
            {likesYou.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-black">
                {likesYou.length}
              </span>
            )}
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm"><SlidersHorizontal className="w-4 h-4"/></Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader><SheetTitle>Filter</SheetTitle></SheetHeader>
              <div className="py-6 space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="font-bold">Max distance</span>
                  <span className="text-muted-foreground">{maxKm === 0 ? "Anywhere" : `${maxKm} km`}</span>
                </div>
                <Slider value={[maxKm]} min={0} max={20000} step={50}
                  onValueChange={(v) => setMaxKm(v[0])} />
                <div className="grid grid-cols-5 gap-2">
                  {[0, 50, 200, 1000, 5000].map((v) => (
                    <Button key={v} variant={maxKm === v ? "default" : "outline"} size="sm" onClick={() => setMaxKm(v)}>
                      {v === 0 ? "Any" : `${v}km`}
                    </Button>
                  ))}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
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
          <MatchCelebration
            name={matchModal.name}
            onChat={() => nav(`/chat/${matchModal.matchId}`)}
            onClose={() => setMatchModal(null)}
          />
        )}
      </AnimatePresence>

      <Sheet open={showLikes} onOpenChange={setShowLikes}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4"/> {likesYou.length} {likesYou.length === 1 ? "person likes" : "people like"} you
            </SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Names are hidden. Swipe to reveal — match if they like you back.
            </p>
          </SheetHeader>
          <div className="py-4 space-y-3">
            {likesYou.length === 0 && (
              <div className="text-center text-muted-foreground py-8 text-sm">
                No secret admirers yet. Keep swiping to get noticed.
              </div>
            )}
            {likesYou.map((l: any) => (
              <div key={l.anon_id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-black text-xs">
                      ??
                    </div>
                    <div>
                      <div className="font-bold text-sm">Mystery collector</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        {l.distance_km != null && <><MapPin className="w-3 h-3"/> {l.distance_km} km</>}
                        {l.is_pro && <Badge className="bg-accent text-accent-foreground h-4 text-[9px] px-1">PRO</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-center">
                    <div className="bg-get/15 rounded px-2 py-1">
                      <div className="text-sm font-black text-get">+{l.receive_count}</div>
                      <div className="text-[9px] uppercase text-muted-foreground">Get</div>
                    </div>
                    <div className="bg-give/15 rounded px-2 py-1">
                      <div className="text-sm font-black text-give">−{l.give_count}</div>
                      <div className="text-[9px] uppercase text-muted-foreground">Give</div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <ArrowLeftRight className="w-3 h-3"/> Stickers in their dupes:
                </div>
                <div className="grid grid-cols-8 gap-1 mt-1">
                  {l.receive_ids.slice(0, 8).map((id: number) => {
                    const s = stickerMap.get(id);
                    return s ? <SlotTile key={id} id={id} code={s.code} size="sm"/> : null;
                  })}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function MatchCelebration({ name, onChat, onClose }: { name: string; onChat: () => void; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-background/80 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 18, stiffness: 220 }}
        className="relative w-full max-w-sm rounded-3xl overflow-hidden border border-border shadow-2xl bg-card"
      >
        <div className="relative h-40 bg-gradient-to-br from-primary via-secondary to-accent overflow-hidden">
          {[...Array(14)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 200, opacity: [0, 1, 0], rotate: 360 }}
              transition={{ duration: 2 + Math.random(), delay: i * 0.08, repeat: Infinity, repeatDelay: 1 }}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${(i * 7) % 100}%`,
                background: ["hsl(var(--accent))", "hsl(var(--get))", "hsl(var(--primary-foreground))"][i % 3],
              }}
            />
          ))}
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", delay: 0.15, damping: 10 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="bg-background/90 backdrop-blur rounded-full p-5 shadow-2xl">
              <ArrowLeftRight className="w-12 h-12 text-primary"/>
            </div>
          </motion.div>
        </div>

        <div className="p-6 text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-bold">It's a trade</p>
          <h2 className="text-3xl font-black">You & {name}</h2>
          <p className="text-sm text-muted-foreground">
            You both want what the other has. Start chatting to arrange the swap.
          </p>

          <div className="flex flex-col gap-2 pt-4">
            <Button size="lg" className="w-full bg-primary text-primary-foreground font-bold" onClick={onChat}>
              Send a message
            </Button>
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Keep swiping
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
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