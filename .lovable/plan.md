# Swap26 — Onboarding & Album Module

## Heads-up: conflict with prior decisions
The earlier MVP was built around **980 stickers**, statuses **`need` / `duplicate`**, and **email + Google** auth. This new brief specifies **650 stickers**, statuses **`owned` / `duplicate`**, and **Google-only** auth. Plan below follows the **new** brief and migrates the existing data/code accordingly. If you'd rather keep 980 / `need`+`duplicate`, say so and I'll adjust before implementing.

## 1. Theme refresh
- Switch palette in `src/index.css` to dark sports look:
  - background near-black, surfaces dark slate
  - primary = grass green `#4ADE80`
  - accent (duplicate) = gold `#FACC15`
  - owned = green glow ring, duplicate = gold ring + `+` badge
- Update `tailwind.config.ts` tokens (`owned`, `duplicate`, `accent`).

## 2. Database changes (migration)
- `profiles`: add `username text unique not null` (backfill existing rows from `display_name`, then add unique index + not-null). Keep existing columns.
- `user_inventory` (new, replaces `user_stickers`):
  - `user_id uuid`, `sticker_id int`, `status text check in ('owned','duplicate')`, `updated_at timestamptz`
  - PK `(user_id, sticker_id)`; RLS: user can CRUD own rows, read own rows only.
- Reseed `stickers` to **650** rows (clear existing 980, insert 1–650 with generic codes like `ARG 10`; keep nation grouping for the Grid View labels but IDs are 1–650).
- Update `get_potential_matches` and `record_swipe` RPCs to read from `user_inventory` and the new statuses (`owned`→`need` equivalent for swap math: a user "needs" any sticker NOT marked owned/duplicate; "duplicate" stays the same). Confirm in implementation.
- Drop `user_stickers` after migration.

## 3. Auth — Google only
- Strip email/password tabs from `src/pages/Auth.tsx`. Single "Continue with Google" button via `lovable.auth.signInWithOAuth("google", …)`.
- After sign-in, route to `/onboarding/username` if profile lacks a username, otherwise `/album`.

## 4. Username step
- New page `src/pages/OnboardingUsername.tsx`.
- Input with live availability check (debounced query against `profiles.username`), zod validation (3–20 chars, alphanumeric + `_`).
- On submit: `update profiles set username = …` then redirect `/album`.
- Add `RequireUsername` guard wrapping app routes.

## 5. Album module (Phase 2)

### Routes & nav
- Bottom nav reduced to 3 tabs: **Album** (active), **Swipe**, **Chat** (placeholders for Swipe/Chat keep existing pages).
- New route `/album` = default landing.

### Book View (`AlbumBook.tsx`)
- Framer Motion horizontal page flip. 20 stickers per page → 33 pages (650/20, last page 10 slots).
- Swipe left/right gesture + page indicator dots + prev/next chevrons.
- Each page renders a 4×5 grid of slot tiles.

### Slot tile interaction
- Tap cycles: none → owned (green glow) → duplicate (gold + `+` badge) → none.
- Optimistic update via TanStack Query mutation; rollback on error.

### Grid View toggle
- Top-of-screen switch: **Book ⇄ Grid**.
- Grid View renders all 650 as small squares in one scrollable screen, virtualized with `@tanstack/react-virtual` (windowed rows of e.g. 8 columns) to stay smooth on mobile.

### Quick Entry Keypad (FAB)
- Floating action button bottom-right with keypad icon.
- Opens a bottom sheet with large 0–9 pad, backspace, and a live preview ("Sticker 502 — ARG 10 ✓ owned").
- Two action buttons: **+ Add to Album** (sets owned), **+ Add Duplicate** (sets duplicate).
- After action: input clears, sheet stays open, focus retained → rapid fire.
- Validates 1–650; shows inline error otherwise.

### State / sync
- TanStack Query: `useInventory()` returns a `Map<sticker_id, status>`. Mutations call `upsert` / `delete` on `user_inventory` and optimistically patch the cache.
- Realtime subscription on `user_inventory` for the current user so multi-device stays in sync.

## 6. Files to add / change

```text
add:    src/pages/OnboardingUsername.tsx
add:    src/pages/Album.tsx
add:    src/components/album/AlbumBook.tsx
add:    src/components/album/AlbumGrid.tsx
add:    src/components/album/SlotTile.tsx
add:    src/components/album/QuickEntryKeypad.tsx
add:    src/hooks/useInventory.ts
add:    src/hooks/useProfile.ts
edit:   src/App.tsx                 # routes + guards
edit:   src/pages/Auth.tsx          # Google only
edit:   src/components/BottomNav.tsx# 3 tabs
edit:   src/index.css               # dark palette
edit:   tailwind.config.ts          # owned/duplicate tokens
edit:   src/pages/Collection.tsx    # remove or redirect to /album
edit:   src/pages/Swipe.tsx         # adapt to user_inventory
migrate: profiles.username, user_inventory table, reseed stickers→650, update RPCs
```

## 7. Out of scope (kept as placeholders)
- Swipe deck and Chat pages remain functional but unchanged beyond the inventory rename.
- PWA manifest / installability not added unless requested.

## Open question
After implementing, the "Generate the Supabase SQL migration…" instruction at the end of your prompt is already covered by step 2 — the migration runs automatically. Confirm the 650 / `owned`+`duplicate` switch and I'll proceed.