import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cachedOrders, cachedProducts, dismissFailed, failedQueued, flushQueue,
  loadMonthRevenue, loadOrders, loadProducts, queuedOrders, sendOrder,
} from './lib/api';
import {
  EMPTY_CART, cartFromItems, cartTotals, itemsFromCart, orderCost,
  todayStr, usageByProduct,
} from './lib/logic';

const SpecContext = createContext(null);
const draftKey = (branch, date) => `spec_app_draft_v1_${branch}_${date}`;

export function SpecProvider({ branch, children }) {
  const today = todayStr();
  const [products, setProducts] = useState([]);
  const [serverOrders, setServerOrders] = useState([]);
  const [queued, setQueued] = useState([]);
  const [failed, setFailed] = useState([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  const [cart, setCart] = useState(EMPTY_CART);
  const [note, setNote] = useState('');
  const [origin, setOrigin] = useState(null);   // { kind: 'draft'|'last'|'reorder'|'ai'|'edit', date? }
  const [editing, setEditing] = useState(false);
  const [reviewNonce, setReviewNonce] = useState(0);
  const draftLoaded = useRef(false);

  /* Server orders, with anything still waiting on the phone shown on top. */
  const orders = useMemo(() => {
    const local = queued.map(q => ({ ...q.order, status: 'pending', _queued: true, submitted_at: q.at }));
    const rest = serverOrders.filter(o => !local.some(l => l.date === o.date));
    return [...local, ...rest].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [serverOrders, queued]);

  const todayOrder = orders.find(o => o.date === today) || null;
  const lastOrder = orders.find(o => o.date < today) || null;
  const usage = useMemo(() => usageByProduct(serverOrders, products), [serverOrders, products]);
  const totals = useMemo(() => cartTotals(cart, products), [cart, products]);
  const monthSpend = useMemo(() => {
    const month = today.slice(0, 7);
    return orders.filter(o => String(o.date).startsWith(month)).reduce((s, o) => s + orderCost(o, products), 0);
  }, [orders, products, today]);

  const refreshQueue = useCallback(async () => {
    setQueued(await queuedOrders(branch));
    setFailed(await failedQueued(branch));
  }, [branch]);

  const refresh = useCallback(async () => {
    try {
      await flushQueue();
      const [p, o, r] = await Promise.all([loadProducts(), loadOrders(branch), loadMonthRevenue(branch).catch(() => 0)]);
      setProducts(p);
      setServerOrders(o);
      setRevenue(r);
      setOffline(false);
      setLastSync(new Date());
    } catch {
      setOffline(true);
    }
    await refreshQueue();
  }, [branch, refreshQueue]);

  /* First load: show the phone's copy at once, then refresh from the server. */
  useEffect(() => {
    let alive = true;
    (async () => {
      const [p, o] = await Promise.all([cachedProducts(), cachedOrders(branch)]);
      if (!alive) return;
      if (p.length) setProducts(p);
      if (o.length) setServerOrders(o);
      await refresh();
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [branch]);

  /* Refresh when the app comes back to the screen (sends anything queued). */
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => sub.remove();
  }, [refresh]);

  /* Restore today's draft, or start from the last order. */
  useEffect(() => {
    if (loading || draftLoaded.current || !products.length) return;
    draftLoaded.current = true;
    (async () => {
      let draft = null;
      try { draft = JSON.parse(await AsyncStorage.getItem(draftKey(branch, today)) || 'null'); } catch {}
      if (draft?.cart) {
        setCart({ ...EMPTY_CART, ...draft.cart });
        setNote(draft.note || '');
        setOrigin(draft.origin || { kind: 'draft' });
      } else if (lastOrder) {
        setCart(cartFromItems(products, lastOrder.items));
        setOrigin({ kind: 'last', date: lastOrder.date });
      }
    })();
  }, [loading, products.length]);

  /* Autosave the draft so nothing is lost if the phone closes the app. */
  useEffect(() => {
    if (!draftLoaded.current || editing || todayOrder) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(draftKey(branch, today), JSON.stringify({ cart, note, origin })).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [cart, note, origin, editing, todayOrder, branch, today]);

  /* ─── cart actions ─── */
  const setQty = useCallback((p, v) => setCart(c => ({ ...c, qty: { ...c.qty, [p.id]: v } })), []);
  const setUnit = useCallback((p, u) => setCart(c => ({ ...c, unit: { ...c.unit, [p.id]: u } })), []);
  const setSizes = useCallback((p, v) => setCart(c => ({ ...c, sizes: { ...c.sizes, [p.id]: v } })), []);
  const clearCart = useCallback(() => { setCart(EMPTY_CART); setOrigin(null); }, []);

  function loadItems(items, nextOrigin, { review = false, noteText } = {}) {
    setCart(cartFromItems(products, items));
    setOrigin(nextOrigin);
    if (noteText !== undefined) setNote(noteText);
    if (review) setReviewNonce(n => n + 1);
  }

  function startEdit() {
    if (!todayOrder) return;
    setCart(cartFromItems(products, todayOrder.items));
    setNote(todayOrder.supplier_note || '');
    setOrigin({ kind: 'edit' });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setCart(EMPTY_CART);
    setOrigin(null);
  }

  async function send() {
    const items = itemsFromCart(cart, products);
    const order = {
      branch, date: today, items,
      supplier_note: note.trim() || null,
      total_brutto: Math.round(totals.cost * 100) / 100,
    };
    const kind = editing && todayOrder ? 'update' : 'insert';
    const result = await sendOrder(kind, order);
    await AsyncStorage.removeItem(draftKey(branch, today)).catch(() => {});
    setEditing(false);
    await refresh();
    return { ...result, count: totals.count, cost: totals.cost, edited: kind === 'update' };
  }

  async function clearFailed() {
    await dismissFailed(branch);
    await refreshQueue();
  }

  const value = {
    branch, today, products, orders, todayOrder, lastOrder, usage, revenue, monthSpend,
    loading, offline, lastSync, queued, failed, refresh, clearFailed,
    cart, note, setNote, origin, editing, totals, reviewNonce,
    setQty, setUnit, setSizes, clearCart, loadItems, startEdit, cancelEdit, send,
  };
  return <SpecContext.Provider value={value}>{children}</SpecContext.Provider>;
}

export const useSpec = () => useContext(SpecContext);
