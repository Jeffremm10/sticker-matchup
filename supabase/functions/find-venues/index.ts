const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

async function overpassQuery(lat: number, lng: number, radiusM: number) {
  const q = `[out:json][timeout:20];(nwr["amenity"="cafe"]["name"](around:${radiusM},${lat},${lng});nwr["amenity"="fast_food"]["name"](around:${radiusM},${lat},${lng});nwr["shop"="mall"]["name"](around:${radiusM},${lat},${lng});nwr["railway"="station"]["name"](around:${radiusM},${lat},${lng});nwr["amenity"="restaurant"]["name"](around:${radiusM},${lat},${lng}););out center 60;`;

  // Try primary mirror, fall back to secondary
  for (const base of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
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

function parseElements(elements: any[], originLat: number, originLng: number) {
  return elements
    .filter((el) => el.tags?.name)
    .map((el) => {
      const lat: number = el.lat ?? el.center?.lat;
      const lng: number = el.lon ?? el.center?.lon;
      if (!lat || !lng) return null;
      const dist = haversineKm([originLat, originLng], [lat, lng]);
      const type = el.tags.railway ? "transit_hub" : el.tags.shop ? "mall" : "coffee_shop";
      const address = [el.tags["addr:street"], el.tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
      return { name: el.tags.name as string, lat, lng, type, address, dist };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.dist - b.dist) as any[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const { lat, lng, lat2, lng2 } = await req.json();
  if (!lat || !lng) {
    return new Response(JSON.stringify({ error: "lat/lng required" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Calculate distance between users to pick sensible search strategy
  const userDistKm = lat2 && lng2 ? haversineKm([lat, lng], [lat2, lng2]) : 0;

  let venues: any[] = [];

  if (userDistKm > 80 || !lat2 || !lng2) {
    // Users are far apart or only one location known:
    // search near each user separately with 5km radius
    const [elemsA, elemsB] = await Promise.all([
      overpassQuery(lat, lng, 5000),
      lat2 && lng2 ? overpassQuery(lat2, lng2, 5000) : Promise.resolve([]),
    ]);
    const nearA = parseElements(elemsA, lat, lng).slice(0, 3).map((v: any) => ({ ...v, label: "Near you" }));
    const nearB = parseElements(elemsB, lat2 ?? lat, lng2 ?? lng).slice(0, 3).map((v: any) => ({ ...v, label: "Near them" }));
    venues = [...nearA, ...nearB];
  } else {
    // Users are close: search around their midpoint
    const midLat = (lat + lat2) / 2;
    const midLng = (lng + lng2) / 2;
    // Radius = half the distance between them, minimum 3km
    const radiusM = Math.max(3000, Math.round(userDistKm * 500));
    const elems = await overpassQuery(midLat, midLng, radiusM);
    venues = parseElements(elems, midLat, midLng).slice(0, 6).map((v: any) => ({ ...v, label: "Midpoint" }));

    // If still empty, fall back to near each user
    if (venues.length === 0) {
      const [elemsA, elemsB] = await Promise.all([
        overpassQuery(lat, lng, 3000),
        overpassQuery(lat2, lng2, 3000),
      ]);
      const nearA = parseElements(elemsA, lat, lng).slice(0, 3).map((v: any) => ({ ...v, label: "Near you" }));
      const nearB = parseElements(elemsB, lat2, lng2).slice(0, 3).map((v: any) => ({ ...v, label: "Near them" }));
      venues = [...nearA, ...nearB];
    }
  }

  return new Response(JSON.stringify({ venues }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
