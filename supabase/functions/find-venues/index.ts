import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { lat, lng } = await req.json();
  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: "lat/lng required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const query = `[out:json][timeout:20];(nwr["amenity"="cafe"]["name"](around:3000,${lat},${lng});nwr["amenity"="fast_food"]["name"](around:3000,${lat},${lng});nwr["shop"="mall"]["name"](around:3000,${lat},${lng});nwr["railway"="station"]["name"](around:3000,${lat},${lng});nwr["amenity"="restaurant"]["name"](around:2000,${lat},${lng}););out center 50;`;

  const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!overpassRes.ok) {
    return new Response(JSON.stringify({ venues: [], error: "overpass error" }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const json = await overpassRes.json();
  const elements: any[] = json.elements ?? [];

  const haversine = (a: [number, number], b: [number, number]) => {
    const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const venues = elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const elLat: number = el.lat ?? el.center?.lat;
      const elLng: number = el.lon ?? el.center?.lon;
      if (!elLat || !elLng) return null;
      const name: string = el.tags.name;
      const dist = haversine([lat, lng], [elLat, elLng]);
      const type = el.tags.railway ? "transit_hub" : el.tags.shop ? "mall" : "coffee_shop";
      const address = [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
      return { name, lat: elLat, lng: elLng, type, address, dist };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.dist - b.dist)
    .slice(0, 6);

  return new Response(JSON.stringify({ venues }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
