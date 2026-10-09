# Dostana SPEC

A separate Android app for branch managers to order SPEC supplies. It uses the
same Supabase database as the Dostana management app, so the owner dashboard and
the supplier portal see every order without any change.

## What managers get

- **Today**: time left before the 18:00 cutoff, today's order status, the
  month's SPEC cost as a share of revenue (target ≤ 15%), and the last order.
- **Order**, step 1: one product list grouped by category. The branch's usual
  products come first and the rest fold under "Show more". Kurczak and Baranina
  are ordered by cone size, taken from the catalogue (`pack_size`). Every
  product shows "Last: X ▲▼" against the previous order. The order is pre-filled
  from the last order.
- **Search**: Polish letters are optional (`smieci` finds `śmieci`), words can be
  in any order (`gouda 2,5`), one typo is allowed (`majoenz`), and English words
  work (`fries`, `gloves`, `foil`). If a product is missing, "Can't find it?" adds
  it to the note for the supplier.
- **Order**, step 2: the order grouped by category, with warnings for a category
  that was ordered last time but not now, for quantities 2× or more above last
  time, and for products with no price. Then a note to the supplier, and send.
- **Edit until confirmed**: today's order can be changed while its status is
  `pending`. Once the supplier confirms it, it is locked.
- **History**: the last 60 days with status and cost. Tap an order to see its
  lines, then "Order the same again".
- **Offline**: products and orders are cached on the phone. An order sent
  without internet is queued and sent automatically when the app is next open
  online.
- **AI search**, all branches: when the normal search finds nothing, the AI
  is asked automatically; otherwise "Ask AI" is one tap away. It understands any
  language, typos and quantities ("2 kurczak 20, 5 pita 85") and only returns
  products from the catalogue. Results can be added one by one or all at once.
- **AI tab**, all branches: "Type your order" turns a whole order written or
  dictated (keyboard microphone) in the manager's own words into products and
  quantities. Anything not in the catalogue can go to the supplier note.
  "Sales advice" is the existing GoPOS-based assistant, still a Łopuszańska
  trial (`AI_BRANCHES` in `src/config.js`).

Settings such as the cutoff hour, the cost target, the history window and the AI
branches are in `src/config.js`.

## Data rules it relies on

- `spec_orders` has one row per branch per day (`spec_orders_branch_date_unique`).
  The id is set by the database trigger `set_spec_order_id`.
- A new order is inserted with `status = 'pending'`. An edit is an update
  filtered on `status = 'pending'`, so it cannot overwrite an order the supplier
  has already confirmed.
- Prices come from `spec_products.price_brutto`. The order total is saved in
  `spec_orders.total_brutto`.
- Only products with `active = true` are shown. Item fields stay compatible with
  the management app: `id, name, qty, unit, cat, price, unit_multiplier, totalKg`.

## AI search setup (one time)

AI matching runs in the Supabase Edge Function `spec-ai-search`
(source: `supabase/functions/spec-ai-search/index.ts`). It checks the branch PIN,
loads the active catalogue and the branch's recent orders, asks OpenAI, and
returns only real product ids and units. The OpenAI key is never in the app.

1. Supabase dashboard → project → Edge Functions → Secrets.
2. Add `OPENAI_API_KEY` with your OpenAI key.
3. Optional: add `OPENAI_MODEL` to choose the model (default `gpt-4o-mini`).

Until the key is added, the app shows "AI search is not set up yet" and the
normal search keeps working.

To redeploy after editing the function: `npx supabase functions deploy spec-ai-search --no-verify-jwt`.

## First build (one time)

```bash
cd spec-app
npm install
npx eas login                 # your Expo account
npx eas init                  # creates the "dostana-spec" project and adds its id to app.json
npx eas update:configure      # optional: enables over-the-air updates
npx eas build -p android --profile preview   # produces an APK to install on phones
```

Install the APK on each manager's phone. It is installed next to the existing
Dostana Kebab app (package `com.dostana.spec`).

## Run during development

```bash
cd spec-app
npm install
npx expo start
```
