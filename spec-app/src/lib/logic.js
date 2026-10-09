/* ─── SPEC order logic (pure, no React, no network) ──────────
   The item shape written to spec_orders.items is the one the owner
   dashboard, supplier portal and My Data screens already read, so keep
   the field names stable: id, name, qty, unit, cat, price,
   unit_multiplier, totalKg.
   ─────────────────────────────────────────────────────────── */
import { ORDER_CUTOFF_HOUR, SPEC_TARGET_PCT } from '../config';

export const DEFAULT_KG_SIZES = ['10kg', '15kg', '20kg', '25kg', '30kg'];

// Same day boundary as the management app, so "ordered today" agrees everywhere.
export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function daysAgoStr(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
export function num(v) { return parseFloat(String(v ?? '').replace(',', '.')) || 0; }
export function fmtPln(v) { return `${Math.round(v || 0).toLocaleString('pl-PL')} PLN`; }
export function fmtK(v) {
  if (!v) return '0';
  return Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v));
}
export function fmtDay(date) {
  if (!date) return '';
  const d = new Date(`${date}T12:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function categoryOf(p) { return p?.category || p?.cat || 'Other'; }
export function priceOf(p) { return num(p?.price_brutto ?? p?.price); }

/* Kurczak / Baranina are ordered as kebab cones of fixed weights. */
export function isSizedMeat(p) { return p?.name === 'Kurczak' || p?.name === 'Baranina'; }

/* Cone sizes come from pack_size ("15kg / 20kg / 30kg"); fall back to all sizes. */
export function meatSizes(p) {
  const found = String(p?.pack_size || '').match(/\d+\s*kg/gi);
  const sizes = (found || []).map(s => s.replace(/\s+/g, '').toLowerCase());
  return sizes.length ? [...new Set(sizes)] : DEFAULT_KG_SIZES;
}
function kgOf(size) { return parseInt(String(size), 10) || 0; }

export function unitOptions(p) {
  let options = p?.unit_options;
  if (typeof options === 'string') { try { options = JSON.parse(options); } catch { options = []; } }
  if (!Array.isArray(options)) options = [];
  const list = options
    .map(o => (typeof o === 'string'
      ? { unit: o, label: o, multiplier: 1 }
      : { unit: o.unit || o.label, label: o.label || o.unit, multiplier: Number(o.multiplier || 1) }))
    .filter(o => o.unit);
  if (p?.unit && !list.some(o => o.unit === p.unit)) list.unshift({ unit: p.unit, label: p.unit, multiplier: 1 });
  return list.length ? list : [{ unit: p?.unit || 'szt', label: p?.unit || 'szt', multiplier: 1 }];
}
export function unitOptionFor(p, unit) {
  const list = unitOptions(p);
  return list.find(o => o.unit === unit) || list[0];
}

export function normalizeItems(raw) {
  if (typeof raw === 'string') {
    try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
  }
  return Array.isArray(raw) ? raw : [];
}

/* ─── cart ─────────────────────────────────────────────────────
   { qty: {id: n}, unit: {id: unit}, sizes: {id: {'15kg': n}} }      */
export const EMPTY_CART = Object.freeze({ qty: {}, unit: {}, sizes: {} });

export function meatKg(sizes) {
  return Object.entries(sizes || {}).reduce((sum, [size, n]) => sum + num(n) * kgOf(size), 0);
}
export function lineQty(cart, p) {
  return isSizedMeat(p) ? meatKg(cart.sizes[p.id]) : num(cart.qty[p.id]);
}
export function lineCost(cart, p) {
  if (isSizedMeat(p)) return meatKg(cart.sizes[p.id]) * priceOf(p);
  return num(cart.qty[p.id]) * priceOf(p) * unitOptionFor(p, cart.unit[p.id]).multiplier;
}
export function selectedProducts(cart, products) {
  return products.filter(p => lineQty(cart, p) > 0);
}
export function cartTotals(cart, products) {
  const selected = selectedProducts(cart, products);
  return {
    count: selected.length,
    cost: selected.reduce((sum, p) => sum + lineCost(cart, p), 0),
    meatKg: selected.reduce((sum, p) => sum + (isSizedMeat(p) ? meatKg(cart.sizes[p.id]) : 0), 0),
    noPrice: selected.filter(p => !priceOf(p)).length,
  };
}

export function findProduct(products, item) {
  const id = item?.product_id || item?.id;
  return (id && products.find(p => p.id === id)) || products.find(p => p.name === item?.name) || null;
}

/* spec_orders.items → cart. Items for products that no longer exist are skipped. */
export function cartFromItems(products, rawItems) {
  const cart = { qty: {}, unit: {}, sizes: {} };
  normalizeItems(rawItems).forEach(item => {
    const p = findProduct(products, item);
    const qty = num(item.qty);
    if (!p || qty <= 0) return;
    if (isSizedMeat(p)) {
      const size = /kg$/i.test(String(item.unit || '')) ? String(item.unit).toLowerCase() : null;
      if (size) {
        const current = cart.sizes[p.id] || {};
        cart.sizes[p.id] = { ...current, [size]: num(current[size]) + qty };
        return;
      }
    }
    cart.qty[p.id] = num(cart.qty[p.id]) + qty;
    if (item.unit && unitOptions(p).some(o => o.unit === item.unit)) cart.unit[p.id] = item.unit;
  });
  return cart;
}

/* cart → spec_orders.items */
export function itemsFromCart(cart, products) {
  const items = [];
  selectedProducts(cart, products).forEach(p => {
    const base = { id: p.id, name: p.name, cat: categoryOf(p), price: priceOf(p) };
    if (isSizedMeat(p)) {
      Object.entries(cart.sizes[p.id] || {}).forEach(([size, n]) => {
        const qty = num(n);
        if (qty > 0) items.push({ ...base, qty, unit: size, totalKg: qty * kgOf(size) });
      });
      return;
    }
    const option = unitOptionFor(p, cart.unit[p.id]);
    items.push({ ...base, qty: num(cart.qty[p.id]), unit: option.unit, unit_multiplier: option.multiplier });
  });
  return items;
}

/* Comparable quantity of a product in an earlier order (kg for sized meat). */
export function previousQty(p, rawItems) {
  const matches = normalizeItems(rawItems).filter(it => (it.id && it.id === p.id) || it.name === p.name);
  if (!matches.length) return 0;
  if (isSizedMeat(p)) return matches.reduce((s, it) => s + (num(it.totalKg) || num(it.qty) * (kgOf(it.unit) || 10)), 0);
  return matches.reduce((s, it) => s + num(it.qty), 0);
}

export function orderCost(order, products = []) {
  if (num(order?.total_brutto) > 0) return num(order.total_brutto);
  return normalizeItems(order?.items).reduce((sum, it) => {
    const p = findProduct(products, it);
    // Orders from the old SPEC screen carry placeholder prices (often 10 PLN),
    // so the catalogue price wins whenever the catalogue has one.
    const price = priceOf(p) || num(it.price);
    const qty = it.totalKg ? num(it.totalKg) : num(it.qty) * (num(it.unit_multiplier) || 1);
    return sum + qty * price;
  }, 0);
}

/* How often this branch ordered each product recently: { productId: count } */
export function usageByProduct(orders, products) {
  const usage = {};
  orders.forEach(o => {
    const seen = new Set();
    normalizeItems(o.items).forEach(it => {
      const p = findProduct(products, it);
      if (p && !seen.has(p.id)) { seen.add(p.id); usage[p.id] = (usage[p.id] || 0) + 1; }
    });
  });
  return usage;
}

/* Categories in catalogue order; inside each, the branch's usual products first. */
export function groupProducts(products, usage = {}) {
  const groups = [];
  const index = new Map();
  products.forEach(p => {
    const cat = categoryOf(p);
    if (!index.has(cat)) { index.set(cat, groups.length); groups.push({ cat, items: [] }); }
    groups[index.get(cat)].items.push(p);
  });
  groups.forEach(g => g.items.sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0)));
  return groups;
}

export function reviewWarnings(cart, products, previousItems) {
  const warnings = [];
  const selected = selectedProducts(cart, products);
  const prevItems = normalizeItems(previousItems);
  if (prevItems.length) {
    const prevCats = new Set(prevItems.map(it => findProduct(products, it)).filter(Boolean).map(categoryOf));
    const nowCats = new Set(selected.map(categoryOf));
    const missing = [...prevCats].filter(c => !nowCats.has(c));
    if (missing.length) warnings.push({ title: 'Category missing', text: `Last time you also ordered from: ${missing.join(', ')}` });
    selected.forEach(p => {
      const before = previousQty(p, prevItems);
      const now = lineQty(cart, p);
      if (before > 0 && now >= before * 2 && now - before >= 2) {
        warnings.push({ title: 'Much more than last time', text: `${p.name}: ${now} now, ${before} last time. Is this correct?` });
      }
    });
  }
  const noPrice = selected.filter(p => !priceOf(p));
  if (noPrice.length) {
    warnings.push({ title: 'No price in catalogue', text: `${noPrice.length} product${noPrice.length > 1 ? 's are' : ' is'} not included in the cost estimate.`, tone: 'info' });
  }
  return warnings;
}

export function cutoffInfo(now = new Date()) {
  const cutoff = new Date(now);
  cutoff.setHours(ORDER_CUTOFF_HOUR, 0, 0, 0);
  const minutes = Math.round((cutoff - now) / 60000);
  if (minutes <= 0) return { tone: 'danger', text: `After ${ORDER_CUTOFF_HOUR}:00. Delivery may be a day later.` };
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return { tone: minutes <= 90 ? 'warn' : 'ok', text: `${h ? `${h}h ` : ''}${m}m left to order for next-day delivery` };
}

export function budgetInfo(spend, revenue) {
  if (!revenue) return null;
  const pct = Math.round((spend / revenue) * 100);
  return { pct, tone: pct > SPEC_TARGET_PCT ? 'danger' : pct > SPEC_TARGET_PCT * 0.8 ? 'warn' : 'ok' };
}

export const STATUS = {
  pending:    { label: 'Sent · waiting', tone: 'warn' },
  confirmed:  { label: 'Confirmed',      tone: 'info' },
  delivered:  { label: 'Delivered',      tone: 'ok' },
  historical: { label: 'Closed',         tone: 'muted' },
  queued:     { label: 'Waiting for internet', tone: 'muted' },
};
export function statusOf(order) {
  if (order?._queued) return 'queued';
  return STATUS[order?.status] ? order.status : 'pending';
}
export function canEdit(order) {
  return !!order && (statusOf(order) === 'pending' || statusOf(order) === 'queued');
}
