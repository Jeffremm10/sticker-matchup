
# Monetization System: Lifetime Pass + Micro-transactions (RevenueCat)

Native IAPs via RevenueCat (App Store + Google Play). Web build will show a "Available in the mobile app" notice for paid CTAs (RevenueCat purchases require native iOS/Android — the current Vite/React app runs in the browser).

## 1. Database changes (migration)

**`profiles`** — add columns:
- `tier text not null default 'free'` — `'free' | 'premium'` (premium = Lifetime Pass owner)
- `super_swap_count int not null default 0`
- `is_final_10_active boolean not null default false`
- `nudge_count int not null default 0` (each Nudge purchase = 1 use)
- `visibility_boost int not null default 0` (3 for premium, 0 otherwise — set by webhook)

**`transactions`** (new):
- `id uuid pk`, `user_id uuid`, `product_id text`, `platform text` (`ios`|`android`), `revenuecat_event_id text unique`, `original_transaction_id text`, `price_cents int`, `currency text`, `purchased_at timestamptz`, `raw jsonb`, `created_at`
- RLS: user can SELECT own rows; INSERT only via service role (edge function).
- Product IDs: `lifetime_pass_1499`, `nudge_299`, `super_swap_3pk_299`, `final_10_499`.

**`super_swap_messages`** (new) — direct messages sent without a match:
- `id`, `sender_id`, `receiver_id`, `body text`, `created_at`, `read_at`
- RLS: sender or receiver can SELECT; INSERT only via `send_super_swap` RPC (which decrements counter atomically).

**RPC `send_super_swap(_receiver uuid, _body text)`** (SECURITY DEFINER):
- Verify `super_swap_count > 0`, decrement, insert message, return new count. Raises `no_super_swaps` otherwise.

**RPC `consume_nudge()`** (SECURITY DEFINER):
- Decrements `nudge_count`, returns one top-compatibility nearby user (≥5 stickers the caller needs), excluding existing matches/swipes.

**Update `get_potential_matches`**:
- Add ordering: `ORDER BY (tier='premium')::int DESC, p.visibility_boost DESC, (compatibility) DESC, distance ASC`.
- Add optional `_final_10 boolean` param. When true: filter to candidates whose inventory contains ANY of caller's missing stickers (strict intersection on wishlist), and ignore distance ordering.

**Trigger `bump_wishlist_count`** on `user_inventory`: maintain `profiles.wishlist_count` (= total stickers − owned).

## 2. RevenueCat integration

**Setup the user must do in RevenueCat dashboard** (documented in chat, not code):
1. Create app + iOS/Android apps in App Store Connect / Play Console with the 4 product IDs above (3 non-consumable: lifetime_pass, nudge, final_10; 1 consumable: super_swap_3pk).
2. Add products in RevenueCat → create entitlements: `premium`, `final_10`. Attach `nudge_299` and `super_swap_3pk_299` as non-entitlement products.
3. Get **RevenueCat Public SDK keys** (iOS + Android) and **REST API secret key** + **Webhook auth header**.

**Secrets to add via add_secret**:
- `REVENUECAT_WEBHOOK_AUTH` (shared secret to verify webhooks)
- `REVENUECAT_REST_API_KEY` (server-side verification fallback)
- Public SDK keys go in client `.env` as `VITE_REVENUECAT_IOS_KEY`, `VITE_REVENUECAT_ANDROID_KEY` (safe to expose).

**Edge function `revenuecat-webhook`** (`verify_jwt = false`, validates `Authorization` header against `REVENUECAT_WEBHOOK_AUTH`):
- Parses event, idempotently inserts into `transactions` keyed by `event.id`.
- On `INITIAL_PURCHASE` / `NON_RENEWING_PURCHASE` / `RENEWAL`:
  - `lifetime_pass_1499` → `tier='premium'`, `is_pro=true`, `visibility_boost=3`
  - `nudge_299` → `nudge_count += 1`
  - `super_swap_3pk_299` → `super_swap_count += 3`
  - `final_10_499` → `is_final_10_active=true`
- On `CANCELLATION`/`REFUND` for lifetime_pass: revert to free.
- App user ID = Supabase `user.id` (set via `Purchases.logIn(user.id)` on client).

**Edge function `verify-purchase`** (called by client right after a successful purchase as belt-and-suspenders): takes `app_user_id` + `product_id`, calls RevenueCat REST `/v1/subscribers/{id}` with `REVENUECAT_REST_API_KEY`, confirms entitlement, then applies the same profile updates. This makes the unlock instant instead of waiting for the webhook.

## 3. Frontend

**Native bridge layer `src/lib/iap.ts`**:
- Detect Capacitor/native vs web (`Capacitor.isNativePlatform()`).
- On native: dynamically import `@revenuecat/purchases-capacitor`, configure with platform key, `logIn(user.id)`, expose `purchase(productId)`, `restore()`, `getOfferings()`.
- On web: `purchase()` resolves to `{ webBlocked: true }`; UI shows a "Get the mobile app to unlock" sheet.
- Note: enabling IAPs requires adding Capacitor + iOS/Android shells. Plan covers code; the user will run `npx cap add ios/android` after Lovable export to GitHub. We will add Capacitor config + the plugin so it's wired up.

**`PaywallProvider` (`src/providers/PaywallProvider.tsx`)**:
- Context with `showPaywall(productId)`.
- Renders a single global `<PaywallSheet>` (shadcn Sheet) showing product copy, price (from RevenueCat offerings), CTA → `iap.purchase(productId)` → on success: invalidate `["profile"]` query + toast.
- Wrap inside `<AuthProvider>` in `App.tsx`.

**Hook `usePaywall()`** — `const { showPaywall } = usePaywall()`.

**Feature integrations**:
- **Swipe daily limit** (`record_swipe` raises `daily_limit`) → `showPaywall('lifetime_pass_1499')`.
- **Likes-you blur**: tap "Reveal" → `showPaywall('lifetime_pass_1499')`.
- **Super Swap button** on `CardView` in `Swipe.tsx`: blue ⚡ icon top-right of card. Tap:
  - if `super_swap_count > 0` → open `SuperSwapModal` (textarea + Send) → calls `send_super_swap` RPC → success toast + decrements badge.
  - else → `showPaywall('super_swap_3pk_299')`.
  - Badge shows remaining count next to icon.
- **Nudge** button in Swipe header ("✨ Find a top match"): if `nudge_count>0` call `consume_nudge` RPC, navigate to revealed profile; else `showPaywall('nudge_299')`.
- **Final 10**:
  - In `Profile.tsx` add a "Progress to complete" card with a "Final 10 Insurance" button.
  - When `owned < total - 10`: greyed out + lock icon + caption "Unlocks at {total−10}/{total}".
  - When `owned >= total - 10` and not active: enabled CTA → `showPaywall('final_10_499')`.
  - When `is_final_10_active=true`: badge "Active – matching with holders of your last cards".
  - In `Album.tsx`: when `owned >= total - 10` and `!is_final_10_active`, auto-open the "Finish the Book" paywall once per session (sessionStorage flag).
  - In `Swipe.tsx`: pass `_final_10: profile.is_final_10_active` to `get_potential_matches`.

**Inbox for Super Swap messages**: Add a "Direct" tab in `Matches.tsx` listing `super_swap_messages` where `receiver_id = me`. Tapping sends the user to a lightweight chat using the same table (no match required).

## 4. Realtime + notifications
- Add `super_swap_messages` to `supabase_realtime` publication.
- Extend `useMessageNotifications` to subscribe and fire a high-priority sonner toast titled "⚡ Super Swap from …" with an Open action.

## 5. File changes summary

New:
- `supabase/migrations/<ts>_monetization.sql` (schema + RPCs + trigger + RPC update)
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/functions/verify-purchase/index.ts`
- `src/lib/iap.ts`
- `src/providers/PaywallProvider.tsx`
- `src/components/paywall/PaywallSheet.tsx`
- `src/components/trade/SuperSwapModal.tsx`
- `src/components/profile/ProgressDashboard.tsx`

Edited:
- `src/App.tsx` (wrap with PaywallProvider)
- `src/pages/Swipe.tsx` (Super Swap icon, Nudge button, Final 10 RPC param)
- `src/pages/Profile.tsx` (Progress Dashboard + Final 10 button)
- `src/pages/Album.tsx` (auto-trigger Final 10 paywall at total−10)
- `src/pages/Matches.tsx` (Direct/Super Swap inbox tab)
- `src/hooks/useMessageNotifications.tsx` (super_swap channel)
- `src/integrations/supabase/types.ts` is regenerated automatically.

## 6. What the user does after I build this
1. Approve this plan; I implement code + DB + edge functions.
2. Add secrets `REVENUECAT_WEBHOOK_AUTH` and `REVENUECAT_REST_API_KEY` when prompted.
3. In RevenueCat dashboard: create the 4 products + entitlements + webhook pointing at the deployed `revenuecat-webhook` URL.
4. After GitHub export: `npx cap add ios && npx cap add android`, set bundle IDs, build the native shells, and the IAP buttons will go live in TestFlight / Internal Testing. Web preview will keep showing the "Available in the mobile app" sheet.
