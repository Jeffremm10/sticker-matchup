import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PRODUCTS = {
  LIFETIME: "lifetime_pass_1499",
  NUDGE: "nudge_299",
  SUPER_SWAP: "super_swap_3pk_299",
  FINAL_10: "final_10_499",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  const got = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!expected || got !== `Bearer ${expected}` && got !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event) return new Response(JSON.stringify({ error: "no event" }), { status: 400, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const userId = event.app_user_id as string | undefined;
  const productId = event.product_id as string | undefined;
  const type = event.type as string | undefined;
  if (!userId) return new Response(JSON.stringify({ ok: true, skip: "no user" }), { headers: corsHeaders });

  // Idempotent insert
  await supabase.from("transactions").upsert({
    user_id: userId,
    product_id: productId ?? "unknown",
    platform: event.store === "APP_STORE" ? "ios" : event.store === "PLAY_STORE" ? "android" : null,
    revenuecat_event_id: event.id,
    original_transaction_id: event.original_transaction_id ?? null,
    price_cents: event.price_in_purchased_currency ? Math.round(event.price_in_purchased_currency * 100) : null,
    currency: event.currency ?? null,
    purchased_at: event.purchased_at_ms ? new Date(event.purchased_at_ms).toISOString() : new Date().toISOString(),
    raw: event,
  }, { onConflict: "revenuecat_event_id", ignoreDuplicates: true });

  const grant = ["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "RENEWAL", "PRODUCT_CHANGE"].includes(type ?? "");
  const revoke = ["CANCELLATION", "EXPIRATION", "REFUND"].includes(type ?? "");

  if (grant && productId) {
    if (productId === PRODUCTS.LIFETIME) {
      await supabase.from("profiles").update({ tier: "premium", is_pro: true, visibility_boost: 3 }).eq("id", userId);
    } else if (productId === PRODUCTS.NUDGE) {
      const { data: p } = await supabase.from("profiles").select("nudge_count").eq("id", userId).maybeSingle();
      await supabase.from("profiles").update({ nudge_count: (p?.nudge_count ?? 0) + 1 }).eq("id", userId);
    } else if (productId === PRODUCTS.SUPER_SWAP) {
      const { data: p } = await supabase.from("profiles").select("super_swap_count").eq("id", userId).maybeSingle();
      await supabase.from("profiles").update({ super_swap_count: (p?.super_swap_count ?? 0) + 3 }).eq("id", userId);
    } else if (productId === PRODUCTS.FINAL_10) {
      await supabase.from("profiles").update({ is_final_10_active: true }).eq("id", userId);
    }
  } else if (revoke && productId === PRODUCTS.LIFETIME) {
    await supabase.from("profiles").update({ tier: "free", is_pro: false, visibility_boost: 0 }).eq("id", userId);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});