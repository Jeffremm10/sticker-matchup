// Seeds 6 test users with profiles + randomized sticker inventory.
// Public endpoint — intended for dev/testing only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_USERS = [
  { email: "alex@swap26.test",   display_name: "Alex (Toronto)",   bio: "Hunting Group B players", lat: 43.65, lng: -79.38 },
  { email: "maya@swap26.test",   display_name: "Maya (CDMX)",      bio: "Dupes of Mexico, need USA", lat: 19.43, lng: -99.13 },
  { email: "jordan@swap26.test", display_name: "Jordan (NYC)",     bio: "Foil collector",            lat: 40.71, lng: -74.0 },
  { email: "sam@swap26.test",    display_name: "Sam (London)",     bio: "EU teams mostly",           lat: 51.50, lng: -0.12 },
  { email: "ines@swap26.test",   display_name: "Ines (Madrid)",    bio: "Need Argentina legends",    lat: 40.41, lng: -3.70 },
  { email: "kenji@swap26.test",  display_name: "Kenji (Tokyo)",    bio: "AFC + Museum stickers",     lat: 35.68, lng: 139.69 },
];
const PASSWORD = "Test1234!";

function pickRandom<T>(arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Action: generate a magic link for an existing test user, returned as token_hash
  // so the client can call verifyOtp() and sign in without email-provider login.
  let body: any = {};
  try { body = await req.json(); } catch {}
  if (body?.action === "login" && typeof body.email === "string") {
    const email = body.email;
    if (!TEST_USERS.find((u) => u.email === email)) {
      return new Response(JSON.stringify({ error: "not a test user" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !data?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: error?.message ?? "no token" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ token_hash: data.properties.hashed_token, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const allIds = Array.from({ length: 980 }, (_, i) => i + 1);
  const results: any[] = [];

  for (const u of TEST_USERS) {
    // create or find user
    let userId: string | null = null;
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: u.display_name },
    });
    if (created?.user) {
      userId = created.user.id;
    } else {
      // already exists — look up via listUsers
      const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users.find((x) => x.email === u.email);
      if (found) userId = found.id;
    }
    if (!userId) {
      results.push({ email: u.email, error: createErr?.message ?? "could not create" });
      continue;
    }

    // upsert profile
    await supabase.from("profiles").upsert({
      id: userId,
      display_name: u.display_name,
      bio: u.bio,
      lat: u.lat,
      lng: u.lng,
    });

    // wipe + reseed inventory
    await supabase.from("user_inventory").delete().eq("user_id", userId);

    const owned = pickRandom(allIds, 140);
    const ownedSet = new Set(owned);
    const duplicates = pickRandom(owned, 35); // some of the owned are duplicates
    const dupSet = new Set(duplicates);

    const rows = owned.map((sticker_id) => ({
      user_id: userId,
      sticker_id,
      status: dupSet.has(sticker_id) ? "duplicate" : "owned",
    }));
    // chunk insert
    for (let i = 0; i < rows.length; i += 200) {
      await supabase.from("user_inventory").insert(rows.slice(i, i + 200));
    }

    results.push({ email: u.email, password: PASSWORD, display_name: u.display_name, user_id: userId, owned: owned.length, duplicates: duplicates.length });
  }

  return new Response(JSON.stringify({ users: results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});