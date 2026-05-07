import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const PRICE_IDS: Record<string, string> = {
  lifetime_pass: "price_1TUFNb9X2qNOGWlDhsBKVDk0",
  nudge:         "price_1TUFO09X2qNOGWlDTi5gVg5t",
  super_swipe:   "price_1TUFPA9X2qNOGWlDI8XUFe0P",
  final_10:      "price_1TUFPb9X2qNOGWlDW8z9qqKw",
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
  if (!user) {
    console.error("No user found from JWT");
    return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });
  }

  const { product_id, app_url } = await req.json();
  console.log("Creating checkout for", product_id, "user", user.id, "app_url", app_url);

  const priceId = PRICE_IDS[product_id];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "invalid product" }), { status: 400, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("STRIPE_SECRET_KEY not set");
    return new Response(JSON.stringify({ error: "Stripe not configured" }), { status: 500, headers: corsHeaders });
  }

  const params = new URLSearchParams({
    "payment_method_types[0]": "card",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "mode": "payment",
    "success_url": `${app_url}/swipe?payment_success=1&product=${product_id}`,
    "cancel_url": `${app_url}/swipe`,
    "client_reference_id": user.id,
    "metadata[product_id]": product_id,
    "metadata[user_id]": user.id,
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const stripeData = await stripeRes.json();
  if (!stripeRes.ok) {
    console.error("Stripe API error:", JSON.stringify(stripeData));
    return new Response(JSON.stringify({ error: stripeData.error?.message || "Stripe error" }), { status: 500, headers: corsHeaders });
  }

  console.log("Session created:", stripeData.id);
  return new Response(JSON.stringify({ url: stripeData.url }), { headers: corsHeaders });
});
