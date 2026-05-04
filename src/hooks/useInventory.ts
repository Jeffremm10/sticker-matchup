import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type InvStatus = "owned" | "duplicate";
export type InvMap = Map<number, InvStatus>;

export function useInventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["inventory", user?.id];

  const query = useQuery({
    enabled: !!user,
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_inventory")
        .select("sticker_id,status")
        .eq("user_id", user!.id)
        .limit(1000);
      if (error) throw error;
      const m: InvMap = new Map();
      (data ?? []).forEach((r: any) => m.set(r.sticker_id, r.status as InvStatus));
      return m;
    },
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("inv-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_inventory", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: key })
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const setStatus = useMutation({
    mutationFn: async ({ sticker_id, status }: { sticker_id: number; status: InvStatus | null }) => {
      if (!user) throw new Error("auth");
      if (status === null) {
        const { error } = await supabase.from("user_inventory")
          .delete().eq("user_id", user.id).eq("sticker_id", sticker_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_inventory")
          .upsert({ user_id: user.id, sticker_id, status });
        if (error) throw error;
      }
    },
    onMutate: async ({ sticker_id, status }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<InvMap>(key);
      const next = new Map(prev ?? []);
      if (status === null) next.delete(sticker_id);
      else next.set(sticker_id, status);
      qc.setQueryData(key, next);
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(key, ctx.prev); },
  });

  const cycle = (sticker_id: number) => {
    const cur = query.data?.get(sticker_id);
    const next: InvStatus | null = cur === undefined ? "owned" : cur === "owned" ? "duplicate" : null;
    setStatus.mutate({ sticker_id, status: next });
  };

  const set = (sticker_id: number, status: InvStatus | null) => setStatus.mutate({ sticker_id, status });

  return { inventory: query.data ?? new Map<number, InvStatus>(), isLoading: query.isLoading, cycle, set };
}
