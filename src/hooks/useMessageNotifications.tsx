import { useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { createElement } from "react";

export function useMessageNotifications() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const matchIdsRef = useRef<Set<string>>(new Set());
  const profilesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const { data: matches } = await supabase.from("matches").select("id,user_a,user_b")
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
      if (cancelled || !matches) return;
      matchIdsRef.current = new Set(matches.map(m => m.id));
      const otherIds = matches.map(m => m.user_a === user.id ? m.user_b : m.user_a);
      if (otherIds.length) {
        const { data: profs } = await supabase.from("profiles").select("id,display_name").in("id", otherIds);
        profilesRef.current = new Map((profs ?? []).map((p: any) => [p.id, p.display_name]));
      }
    })();

    const ch = supabase.channel(`notif:${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m: any = payload.new;
        if (m.sender_id === user.id) return;
        if (!matchIdsRef.current.has(m.match_id)) return;
        if (loc.pathname === `/chat/${m.match_id}`) return;
        const name = profilesRef.current.get(m.sender_id) ?? "New message";
        const preview = m.msg_type === "dupes_share" ? "📦 Shared duplicates" : (m.body || "New message");
        toast(name, { description: preview, action: { label: "Open", onClick: () => nav(`/chat/${m.match_id}`) } });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "meetup_slots" }, (payload) => {
        const s: any = payload.new;
        if (s.suggested_by === user.id) return;
        if (!matchIdsRef.current.has(s.match_id)) return;
        if (loc.pathname === `/chat/${s.match_id}`) return;
        toast("📍 Meetup proposed", { description: s.venue_name, action: { label: "View", onClick: () => nav(`/chat/${s.match_id}`) } });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "super_swap_messages" }, async (payload) => {
        const m: any = payload.new;
        if (m.receiver_id !== user.id) return;
        let name = profilesRef.current.get(m.sender_id);
        if (!name) {
          const { data } = await supabase.from("profiles").select("display_name").eq("id", m.sender_id).maybeSingle();
          name = data?.display_name ?? "Someone";
        }
        toast(createElement("span", { className: "flex items-center gap-1 font-bold" },
          createElement(Zap, { className: "w-4 h-4 text-blue-500" }),
          `Super Swap from ${name}`
        ), {
          description: m.body,
          duration: 8000,
          action: { label: "Open", onClick: () => nav("/matches") },
        });
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user, loc.pathname, nav]);
}

export function MessageNotifications() {
  useMessageNotifications();
  return null;
}
