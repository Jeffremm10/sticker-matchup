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

  const { product_id, session_id } = await req.json();
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  if (!session_id) {
    console.error("No session_id provided");
    return new Response(JSON.stringify({ ok: false, error: "no_session_id" }), { headers: corsHeaders });
  }

  // Fetch the specific session directly from Stripe
  const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session_id}`, {
    headers: { "Authorization": `Bearer ${stripeKey}` },
  });
  const session = await res.json();

  console.log("Session status:", session.payment_status, "client_ref:", session.client_reference_id, "user:", user.id);

  if (session.payment_status !== "paid") {
    console.log("Session not paid:", session.payment_status);
    return new Response(JSON.stringify({ ok: false, error: "not_paid" }), { headers: corsHeaders });
  }

  if (session.client_reference_id !== user.id) {
    console.error("User mismatch", session.client_reference_id, "vs", user.id);
    return new Response(JSON.stringify({ ok: false, error: "user_mismatch" }), { status: 403, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  await admin.from("stripe_purchases").upsert({
    user_id: user.id,
    product_id,
    stripe_session_id: session_id,
  }, { onConflict: "stripe_session_id" });

  if (product_id === "lifetime_pass") {
    const { error } = await admin.from("profiles").update({ is_pro: true }).eq("id", user.id);
    if (error) console.error("Failed to set is_pro:", error.message);
    else console.log("Set is_pro=true for", user.id);
  }

  return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
});
