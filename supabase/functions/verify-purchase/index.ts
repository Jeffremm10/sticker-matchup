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

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: claims } = await supabase.auth.getClaims(auth.replace("Bearer ", ""));
  const userId = claims?.claims?.sub;
  if (!userId) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });

  const { product_id } = await req.json().catch(() => ({}));
  if (!product_id) return new Response(JSON.stringify({ error: "missing product_id" }), { status: 400, headers: corsHeaders });

  // Verify with RevenueCat REST
  const apiKey = Deno.env.get("REVENUECAT_REST_API_KEY")!;
  const rcRes = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!rcRes.ok) {
    return new Response(JSON.stringify({ error: "rc_fetch_failed", status: rcRes.status }), { status: 502, headers: corsHeaders });
  }
  const rc = await rcRes.json();
  const subscriber = rc?.subscriber ?? {};
  const owns = (productId: string) =>
    !!subscriber?.non_subscriptions?.[productId]?.length ||
    !!subscriber?.entitlements?.[productId]?.expires_date === null ||
    Object.values(subscriber?.entitlements ?? {}).some((e: any) =>
      e.product_identifier === productId && (!e.expires_date || new Date(e.expires_date) > new Date())
    );

  if (!owns(product_id)) {
    return new Response(JSON.stringify({ verified: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  if (product_id === PRODUCTS.LIFETIME) {
    await admin.from("profiles").update({ tier: "premium", is_pro: true, visibility_boost: 3 }).eq("id", userId);
  } else if (product_id === PRODUCTS.FINAL_10) {
    await admin.from("profiles").update({ is_final_10_active: true }).eq("id", userId);
  }
  // Consumables (nudge, super_swap_3pk) are handled by webhook only — REST API doesn't track per-purchase consumables reliably.

  return new Response(JSON.stringify({ verified: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});