const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function overpass(q: string) {
  for (const base of [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ]) {
    try {
      const res = await fetch(base, {
        method: "POST",
        body: "data=" + encodeURIComponent(q),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      if (!res.ok) continue;
      const json = await res.json();
      return (json.elements ?? []) as any[];
    } catch { continue; }
  }
  return [];
}

function toVenues(elements: any[], originLat: number, originLng: number, label?: string) {
  const R = 6371, toRad = (d: number) => d * Math.PI / 180;
  const dist = (a: [number,number], b: [number,number]) => {
    const dLat = toRad(b[0]-a[0]), dLng = toRad(b[1]-a[1]);
    const x = Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
    return 2*R*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
  };
  return elements
    .map((el) => {
      const lat: number = el.lat ?? el.center?.lat;
      const lng: number = el.lon ?? el.center?.lon;
      if (!lat || !lng || !el.tags?.name) return null;
      const type = el.tags.railway ? "transit_hub" : el.tags.shop ? "mall" : "coffee_shop";
      const address = [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
      return { name: el.tags.name, lat, lng, type, address, dist: dist([originLat,originLng],[lat,lng]), label };
    })
    .filter(Boolean)
    .sort((a:any,b:any) => a.dist - b.dist);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const body = await req.json();
  const { lat, lng } = body;
  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: "lat/lng required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── name search mode ──────────────────────────────────────────────────
  if (body.query) {
    const safe = String(body.query).replace(/[^a-zA-Z0-9 ]/g, "").trim();
    if (!safe) return new Response(JSON.stringify({ venues: [] }), { headers: { ...cors, "Content-Type": "application/json" } });

    // Search a wider radius (25km) across named POIs that are likely meetup spots.
    const q = `[out:json][timeout:20];(
      nwr["name"~"${safe}",i]["amenity"](around:25000,${lat},${lng});
      nwr["name"~"${safe}",i]["shop"](around:25000,${lat},${lng});
      nwr["name"~"${safe}",i]["railway"="station"](around:25000,${lat},${lng});
      nwr["name"~"${safe}",i]["public_transport"](around:25000,${lat},${lng});
      nwr["name"~"${safe}",i]["tourism"](around:25000,${lat},${lng});
    );out center 25;`;
    let elements = await overpass(q);
    // Fallback: any named entity within 10km if the typed search came up empty.
    if (elements.length === 0) {
      elements = await overpass(`[out:json][timeout:20];(nwr["name"~"${safe}",i](around:10000,${lat},${lng}););out center 25;`);
    }
    const venues = toVenues(elements, lat, lng).slice(0, 8);
    return new Response(JSON.stringify({ venues }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // ── auto nearby mode (for Meet tab) ──────────────────────────────────
  const { lat2, lng2 } = body;
  const distKm = lat2 && lng2
    ? (() => { const R=6371,t=(d:number)=>d*Math.PI/180,dLa=t(lat2-lat),dLo=t(lng2-lng),x=Math.sin(dLa/2)**2+Math.cos(t(lat))*Math.cos(t(lat2))*Math.sin(dLo/2)**2; return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); })()
    : 0;

  let venues: any[] = [];
  if (distKm > 80 || !lat2 || !lng2) {
    const [a, b] = await Promise.all([
      overpass(`[out:json][timeout:15];(nwr["amenity"~"cafe|fast_food|restaurant"]["name"](around:5000,${lat},${lng});nwr["railway"="station"]["name"](around:5000,${lat},${lng});nwr["shop"="mall"]["name"](around:5000,${lat},${lng}););out center 30;`),
      lat2 && lng2 ? overpass(`[out:json][timeout:15];(nwr["amenity"~"cafe|fast_food|restaurant"]["name"](around:5000,${lat2},${lng2});nwr["railway"="station"]["name"](around:5000,${lat2},${lng2}););out center 20;`) : Promise.resolve([]),
    ]);
    venues = [...toVenues(a,lat,lng,"Near you").slice(0,3), ...toVenues(b,lat2??lat,lng2??lng,"Near them").slice(0,3)];
  } else {
    const mid = [(lat+lat2)/2,(lng+lng2)/2];
    const r = Math.max(3000, distKm*500);
    const elems = await overpass(`[out:json][timeout:15];(nwr["amenity"~"cafe|fast_food|restaurant"]["name"](around:${r},${mid[0]},${mid[1]});nwr["railway"="station"]["name"](around:${r},${mid[0]},${mid[1]}););out center 30;`);
    venues = toVenues(elems,mid[0],mid[1],"Midpoint").slice(0,6);
    if (!venues.length) {
      const [a,b] = await Promise.all([
        overpass(`[out:json][timeout:15];(nwr["amenity"~"cafe|fast_food"]["name"](around:3000,${lat},${lng}););out center 15;`),
        overpass(`[out:json][timeout:15];(nwr["amenity"~"cafe|fast_food"]["name"](around:3000,${lat2},${lng2}););out center 15;`),
      ]);
      venues = [...toVenues(a,lat,lng,"Near you").slice(0,3), ...toVenues(b,lat2,lng2,"Near them").slice(0,3)];
    }
  }

  return new Response(JSON.stringify({ venues }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
