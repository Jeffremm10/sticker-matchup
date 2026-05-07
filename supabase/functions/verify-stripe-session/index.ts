import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });

  const { product_id } = await req.json();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  // Find the most recent completed checkout session for this user
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions?client_reference_id=${user.id}&limit=5`,
    { headers: { "Authorization": `Bearer ${stripeKey}` } }
  );
  const { data: sessions } = await res.json();

  const paid = (sessions ?? []).find(
    (s: any) => s.payment_status === "paid" && s.metadata?.product_id === product_id
  );

  if (!paid) {
    console.log("No paid session found for user", user.id, "product", product_id);
    return new Response(JSON.stringify({ ok: false }), { headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Record purchase
  await admin.from("stripe_purchases").upsert({
    user_id: user.id,
    product_id,
    stripe_session_id: paid.id,
  }, { onConflict: "stripe_session_id" });

  // Unlock based on product
  if (product_id === "lifetime_pass") {
    await admin.from("profiles").update({ is_pro: true }).eq("id", user.id);
    console.log("Set is_pro=true for", user.id);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
