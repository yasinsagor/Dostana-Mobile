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
- **AI assistant**: the existing Łopuszańska trial (`AI_BRANCHES` in
  `src/config.js`).

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
