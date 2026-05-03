# Sticker Swapper 2026 — Core MVP Plan

A Tinder-style trading app for a 980-sticker generic football collection. Mobile-first, football aesthetic (grass green, stadium white, deep blue). Zero copyrighted assets — generic FIFA-style 3-letter country codes only.

## Sticker Set Audit (980 total, 48 nations)

Following the standard 2026 album structure (48 qualified nations × ~20 stickers + extras for legends/stadiums/badges). Codes follow ISO 3166-1 alpha-3 / standard FIFA trigrams — these are **generic public country codes**, not Panini IP.

**48 nations (group-stage style, alphabetical):**
ARG, AUS, AUT, BEL, BRA, CAN, CIV, COL, CRC, CRO, DEN, ECU, EGY, ENG, FRA, GER, GHA, IRN, ITA, JPN, KOR, MAR, MEX, NED, NGA, NOR, PAN, PAR, PER, POL, POR, QAT, KSA, SCO, SEN, SRB, SUI, ESP, SWE, TUN, TUR, UKR, URU, USA, VEN, WAL, NZL, RSA

**Per nation (20 cards):** 1 = team badge, 2 = team photo, 3–20 = numbered player slots (e.g. `ARG 03` … `ARG 20`).
**Extras (20 cards):** `LEG 01–10` (legend silhouettes), `STA 01–06` (stadium icons), `TRO 01–04` (trophy/mascot generic art).

Total: 48 × 20 + 20 = **980**. All labels are 3-letter code + 2-digit number. No player names, no team names beyond the country code, no logos.

## What Gets Built

### 1. Database (Lovable Cloud / Supabase)

- `profiles` — id, display_name, bio, lat, lng, is_pro
- `stickers` — id (1–980), code (e.g. `ARG 10`), nation, slot_type (`badge`/`team`/`player`/`legend`/`stadium`/`trophy`)
- `user_stickers` — user_id, sticker_id, status (`need` | `duplicate`)
- `swipes` — sender_id, receiver_id, direction (`like`/`dislike`), created_at
- `matches` — view/table derived from mutual likes
- `messages` — match_id, sender_id, body, created_at
- `daily_swipe_count` — tracked per user per day (free tier: 20/day)

RLS on every table. `user_roles` table for any future admin needs (never role on profile). `stickers` is seeded from a migration with all 980 rows.

### 2. Screens

**Auth** — email/password + Google sign-in, branded football look.

**Onboarding — Sticker Grid**
- Scrollable grid of all 980 cards, grouped by nation with sticky headers.
- Tap cycles: none → Need (red ring) → Duplicate (blue ring) → none.
- Search/filter by code or nation, "jump to nation" chips.
- Progress bar showing % of collection marked.

**Swipe Deck (Home)**
- Stack of user cards rendered with Framer Motion (drag, rotate, fling).
- Each card shows: display name, distance (from lat/lng), nation flag emojis of top duplicates, and two big badges:
  - `+N You Get` (green) — count of their duplicates that I need
  - `−N You Give` (blue) — count of my duplicates that they need
- Swipe right = like, left = dislike. Buttons below as fallback.
- Free tier: 20 swipes/day counter; lockout screen when exhausted with Pro upsell.

**Match Screen**
- Confetti + "It's a Trade!" modal when mutual like detected.
- Buttons: "Start Chat" / "Keep Swiping".

**Match List + Chat**
- List of active matches with last message preview.
- 1:1 chat per match using Supabase Realtime (postgres_changes on `messages`).
- Text only in v1.

**Profile**
- Edit name, bio, location (geolocation button + manual lat/lng).
- See own Need / Duplicate counts, link back to grid to edit.

### 3. Match / Trade-Value Logic

Computed server-side via a Postgres function `get_potential_matches(user_id, limit)` that:
1. Finds users within X km (haversine on lat/lng).
2. For each candidate, joins their `duplicates` against my `needs` → Receive Count.
3. Joins my `duplicates` against their `needs` → Give Count.
4. Excludes anyone I've already swiped.
5. Returns ordered by `(receive + give)` desc.

TanStack Query caches the deck; invalidated after each swipe.

### 4. Pro Gating (UI hooks only, no payment yet)

- `is_pro` flag on profile, toggleable in dev for testing.
- Free users: 20 swipes/day, specific sticker codes in "You Get" list shown blurred until match.
- Pro: unlimited swipes, unblurred lists, "High Value Only" filter (Receive Count > 10).
- Stripe wiring deferred to a follow-up.

### 5. Design System

- Tailwind tokens in `index.css`: pitch-green `142 55% 28%`, stadium-white `0 0% 98%`, deep-blue `222 65% 22%`, accent-gold for Pro.
- shadcn/ui components, Lucide icons (generic `Trophy`, `Shield`, `MapPin`).
- Card art = colored gradient + 3-letter code + number in big bold type + small flag emoji. No images.
- Framer Motion for swipe physics and match celebration.

## Deferred to Follow-Ups

- Safe Swap Zones map (Mapbox/Leaflet + curated public locations).
- Stripe Pro subscription.
- Image attachments in chat.
- Push notifications / PWA install.

## Technical Notes

- Vite + React + TS + Tailwind + shadcn (already scaffolded).
- TanStack Query for all data fetching.
- Framer Motion for swipe deck.
- Lovable Cloud for auth, DB, Realtime.
- Single seed migration inserts all 980 stickers.
- Mobile-first; desktop gets a centered phone-width column.

Approve and I'll start with the schema + seed, then onboarding grid, then swipe deck, match, and chat.