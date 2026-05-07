import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (!user) return new Response(JSON.stringify({ error: "unauth" }), { status: 401, headers: corsHeaders });

  const { product_id, app_url } = await req.json();
  const priceId = PRICE_IDS[product_id];
  if (!priceId) {
    return new Response(JSON.stringify({ error: "invalid product" }), { status: 400, headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "payment",
    success_url: `${app_url}/swipe?payment_success=1&product=${product_id}`,
    cancel_url: `${app_url}/swipe`,
    client_reference_id: user.id,
    metadata: { product_id, user_id: user.id },
  });

  return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
});
