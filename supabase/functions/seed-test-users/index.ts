// Seeds 6 test users with profiles + randomized sticker inventory.
// Public endpoint — intended for dev/testing only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEST_USERS = [
  { email: "alex@swap26.test",   username: "alex_toronto",   display_name: "Alex (Toronto)",      bio: "Hunting Group B players",  lat: 43.65,   lng: -79.38,  swap_count: 3,  avg_rating: 4.7, rating_count: 3  },
  { email: "maya@swap26.test",   username: "maya_cdmx",      display_name: "Maya (CDMX)",         bio: "Dupes of Mexico, need USA", lat: 19.43,   lng: -99.13,  swap_count: 0,  avg_rating: 0,   rating_count: 0  },
  { email: "jordan@swap26.test", username: "jordan_nyc",     display_name: "Jordan (NYC)",        bio: "Foil collector",            lat: 40.71,   lng: -74.0,   swap_count: 7,  avg_rating: 5.0, rating_count: 6  },
  { email: "sam@swap26.test",    username: "sam_london",     display_name: "Sam (London)",        bio: "EU teams mostly",           lat: 51.50,   lng: -0.12,   swap_count: 2,  avg_rating: 4.0, rating_count: 2  },
  { email: "ines@swap26.test",   username: "ines_madrid",    display_name: "Ines (Madrid)",       bio: "Need Argentina legends",    lat: 40.41,   lng: -3.70,   swap_count: 1,  avg_rating: 5.0, rating_count: 1  },
  { email: "kenji@swap26.test",  username: "kenji_tokyo",    display_name: "Kenji (Tokyo)",       bio: "AFC + Museum stickers",     lat: 35.68,   lng: 139.69,  swap_count: 12, avg_rating: 4.9, rating_count: 11 },
  // Swiss test users
  { email: "anna@swap26.test",   username: "anna_zurich",    display_name: "Anna (Zürich)",       bio: "Looking for duplicates",    lat: 47.3769, lng: 8.5472,  swap_count: 5,  avg_rating: 4.8, rating_count: 5  },
  { email: "marco@swap26.test",  username: "marco_geneva",   display_name: "Marco (Geneva)",      bio: "EU trading partner",        lat: 46.2022, lng: 6.1432,  swap_count: 0,  avg_rating: 0,   rating_count: 0  },
  { email: "lisa@swap26.test",   username: "lisa_bern",      display_name: "Lisa (Bern)",         bio: "Foil lover",                lat: 46.9479, lng: 7.4474,  swap_count: 3,  avg_rating: 4.3, rating_count: 3  },
  { email: "thomas@swap26.test", username: "thomas_basel",   display_name: "Thomas (Basel)",      bio: "Complete my sets",          lat: 47.5596, lng: 7.5886,  swap_count: 8,  avg_rating: 4.6, rating_count: 7  },
  { email: "maria@swap26.test",  username: "maria_lugano",   display_name: "Maria (Lugano)",      bio: "Need Swiss edition",        lat: 46.0051, lng: 8.9516,  swap_count: 1,  avg_rating: 5.0, rating_count: 1  },
  { email: "stefan@swap26.test", username: "stefan_lucerne", display_name: "Stefan (Lucerne)",    bio: "Trading duplicates",        lat: 47.0502, lng: 8.3093,  swap_count: 4,  avg_rating: 4.5, rating_count: 4  },
  { email: "sophia@swap26.test", username: "sophia_lausanne",display_name: "Sophia (Lausanne)",   bio: "Seeking rare finds",        lat: 46.5197, lng: 6.6323,  swap_count: 0,  avg_rating: 0,   rating_count: 0  },
  { email: "daniel@swap26.test", username: "daniel_winti",   display_name: "Daniel (Winterthur)", bio: "Alpine collector",          lat: 47.5001, lng: 8.7275,  swap_count: 6,  avg_rating: 4.2, rating_count: 5  },
  { email: "nina@swap26.test",   username: "nina_stgallen",  display_name: "Nina (St. Gallen)",   bio: "Team stickers only",        lat: 47.4235, lng: 9.3768,  swap_count: 2,  avg_rating: 4.5, rating_count: 2  },
  { email: "boris@swap26.test",  username: "boris_neuchatel",display_name: "Boris (Neuchâtel)",   bio: "International trades",      lat: 46.9921, lng: 6.9282,  swap_count: 9,  avg_rating: 4.8, rating_count: 8  },
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
      username: u.username,
      display_name: u.display_name,
      bio: u.bio,
      lat: u.lat,
      lng: u.lng,
      swap_count: u.swap_count,
      avg_rating: u.avg_rating,
      rating_count: u.rating_count,
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