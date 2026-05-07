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

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

  // List recent Stripe sessions for this user
  const res = await fetch(
    `https://api.stripe.com/v1/checkout/sessions?client_reference_id=${user.id}&limit=10`,
    { headers: { "Authorization": `Bearer ${stripeKey}` } }
  );
  const { data: sessions } = await res.json();

  const paid = (sessions ?? []).find((s: any) => s.payment_status === "paid");
  if (!paid) {
    console.log("No paid session found for", user.id);
    return new Response(JSON.stringify({ restored: false }), { headers: corsHeaders });
  }

  const productId = paid.metadata?.product_id ?? "lifetime_pass";
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Record it
  await admin.from("stripe_purchases").upsert({
    user_id: user.id,
    product_id: productId,
    stripe_session_id: paid.id,
  }, { onConflict: "stripe_session_id" });

  // Unlock
  if (productId === "lifetime_pass") {
    const { data: cur } = await admin.from("profiles").select("nudge_count,super_swap_count").eq("id", user.id).single();
    await admin.from("profiles").update({
      is_pro: true,
      nudge_count: (cur?.nudge_count ?? 0) + 30,
      super_swap_count: (cur?.super_swap_count ?? 0) + 30,
    }).eq("id", user.id);
  } else if (productId === "final_10") {
    await admin.from("profiles").update({ is_final_10_active: true }).eq("id", user.id);
  } else if (productId === "nudge") {
    const { data: cur } = await admin.from("profiles").select("nudge_count").eq("id", user.id).single();
    await admin.from("profiles").update({ nudge_count: (cur?.nudge_count ?? 0) + 1 }).eq("id", user.id);
  } else if (productId === "super_swipe") {
    const { data: cur } = await admin.from("profiles").select("super_swap_count").eq("id", user.id).single();
    await admin.from("profiles").update({ super_swap_count: (cur?.super_swap_count ?? 0) + 3 }).eq("id", user.id);
  }

  console.log("Restored", productId, "for", user.id);
  return new Response(JSON.stringify({ restored: true, product_id: productId }), { headers: corsHeaders });
});
