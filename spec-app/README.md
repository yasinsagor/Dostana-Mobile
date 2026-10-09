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
- **AI search** (all branches): the search bar has 🎤 voice and 📷 photo
  buttons. Typing, speaking or photographing (a product, its label, an empty box
  or a written list) in any language finds the correct catalogue product **and
  the correct order unit**: "10 kg frytki" becomes 1 karton (4 × 2.5 kg). When
  the normal search finds nothing, the AI is asked automatically. Each result
  can be added, or updated when the order already has a different amount;
  kebab meat without a cone size asks the manager to choose. Words that match
  nothing can go to the supplier note.
- **Share order**: on today's sent order and in History, share as PDF (Dostana
  logo, grouped by category, tick boxes, signature lines) or as text for
  WhatsApp / SMS. Documents are in Polish for the SPEC warehouse.
- **AI tab** (all branches): the same AI as a full-screen helper with big
  Speak / Photo / Type buttons for dictating a whole order.

## Supplier (PIN 7777, same as in the management app)

- **Branch orders** for any day (‹ ›), with counts of orders, orders to
  confirm and branches that have not ordered yet.
- **By branch**: each order grouped by category with the branch's note, a
  message back to the branch (saved in `manager_notification`, shown to the
  manager as "Message from supplier", so the branch note is never
  overwritten), and Confirm / Delivered (`completed_at` is set on delivery).
  "Confirm all" confirms every waiting order.
- **Picking totals**: the day's quantities per product with the branches that
  ordered them.
- **Share**: one branch, or the whole day (picking totals plus every branch on
  its own page) as PDF or text.
- Refreshes every minute and when the app is reopened.

Settings such as the cutoff hour, the cost target and the history window are in
`src/config.js`.

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
3. Optional: `OPENAI_MODEL` for matching and photos (default `gpt-5-mini`) and
   `OPENAI_TRANSCRIBE_MODEL` for voice (default `gpt-4o-mini-transcribe`, falls
   back to `whisper-1`).

Model choice: on test orders against the live catalogue (Polish, English,
Bengali, Urdu, unit conversions), `gpt-5-mini` matched product and unit best
but takes about 9 s; `gpt-4.1` was nearly as accurate at about 5 s and roughly
three times the price; `gpt-4o-mini` and `gpt-4.1-mini` made unit and product
mistakes.

Safety checks in the function: the branch PIN is verified before any OpenAI
call; the model gets short catalogue numbers and must copy the name, and the
name decides if they disagree; only catalogue units are accepted; no prompt is
sent to the speech model (it can echo prompts in silence) and echo-like
transcripts are treated as "no words". The app ignores recordings under 1 s.

Voice recordings (max 30 s) and photos (shrunk to 1024 px) are sent to the
function for that one search and are not stored.

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
