import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const productId = session.metadata?.product_id;
    if (!userId || !productId) return new Response("ok", { status: 200 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Record purchase
    await supabase.from("stripe_purchases").upsert({
      user_id: userId,
      product_id: productId,
      stripe_session_id: session.id,
    }, { onConflict: "stripe_session_id" });

    // Lifetime pass unlocks is_pro
    if (productId === "lifetime_pass") {
      await supabase.from("profiles").update({ is_pro: true }).eq("id", userId);
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
