import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { daysAgoStr } from './logic';
import { HISTORY_DAYS } from '../config';

const CACHE = {
  branches: 'spec_app_branches_v1',
  products: 'spec_app_products_v1',
  orders: branch => `spec_app_orders_v1_${branch}`,
  queue: 'spec_app_queue_v1',
};

async function readJson(key, fallback) {
  try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
async function writeJson(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

/* ─── branches (PIN login) ─────────────────────────────────── */
export async function loadBranches() {
  const { data, error } = await supabase.from('branch_settings').select('branch,pin').eq('active', true).order('branch');
  if (error) throw error;
  const list = (data || []).map(b => ({ name: b.branch, pin: String(b.pin || '').trim() })).filter(b => b.name && b.pin);
  if (list.length) await writeJson(CACHE.branches, list);
  return list;
}
export const cachedBranches = () => readJson(CACHE.branches, []);

/* ─── catalogue ────────────────────────────────────────────── */
export async function loadProducts() {
  const { data, error } = await supabase
    .from('spec_products').select('*').eq('active', true)
    .order('sort_order', { ascending: true }).order('name', { ascending: true });
  if (error) throw error;
  await writeJson(CACHE.products, data || []);
  return data || [];
}
export const cachedProducts = () => readJson(CACHE.products, []);

/* ─── orders ───────────────────────────────────────────────── */
export async function loadOrders(branch) {
  const { data, error } = await supabase
    .from('spec_orders').select('*').eq('branch', branch)
    .gte('date', daysAgoStr(HISTORY_DAYS)).order('date', { ascending: false });
  if (error) throw error;
  await writeJson(CACHE.orders(branch), data || []);
  return data || [];
}
export const cachedOrders = branch => readJson(CACHE.orders(branch), []);

export async function loadMonthRevenue(branch) {
  const now = new Date();
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const { data, error } = await supabase
    .from('daily_reports').select('total_revenue,utarg').eq('branch', branch).gte('date', from);
  if (error) throw error;
  return (data || []).reduce((sum, r) => sum + (Number(r.total_revenue || r.utarg) || 0), 0);
}

/* The database sets the order id from branch + date and allows one order per
   branch per day. A new order is an insert; a change is an update that only
   succeeds while the supplier has not confirmed it yet. */
export class OrderLockedError extends Error {
  constructor() { super('The supplier has already confirmed this order. Call the supplier to change it.'); this.name = 'OrderLockedError'; }
}
export class OrderExistsError extends Error {
  constructor() { super('An order for today was already sent from this branch. Open Today to see it.'); this.name = 'OrderExistsError'; }
}

async function writeOrder(op) {
  const { branch, date, items, supplier_note, total_brutto } = op.order;
  if (op.kind === 'insert') {
    const { data, error } = await supabase.from('spec_orders').insert([{
      branch, date, items, supplier_note, total_brutto,
      status: 'pending', submitted_at: op.at,
    }]).select().single();
    if (error?.code === '23505') throw new OrderExistsError();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('spec_orders')
    .update({ items, supplier_note, total_brutto })
    .eq('branch', branch).eq('date', date).eq('status', 'pending')
    .select();
  if (error) throw error;
  if (!data?.length) throw new OrderLockedError();
  return data[0];
}

function isNetworkError(e) {
  const msg = String(e?.message || e || '').toLowerCase();
  return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout') || msg.includes('failed to');
}

/* Sends now; on a network problem the order is kept on the phone and sent later. */
export async function sendOrder(kind, order) {
  const op = { kind, order, at: new Date().toISOString() };
  try {
    return { order: await writeOrder(op), queued: false };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const all = await readJson(CACHE.queue, []);
    const same = q => q.order.branch === order.branch && q.order.date === order.date;
    // An edit of an order that never reached the server is still an insert.
    const pendingInsert = all.some(q => same(q) && q.kind === 'insert');
    await writeJson(CACHE.queue, [...all.filter(q => !same(q)), { ...op, kind: pendingInsert ? 'insert' : kind }]);
    return { order: { ...order, status: 'pending', _queued: true, submitted_at: op.at }, queued: true };
  }
}

export async function queuedOrders(branch) {
  return (await readJson(CACHE.queue, [])).filter(q => q.order.branch === branch && !q.error);
}
export async function failedQueued(branch) {
  return (await readJson(CACHE.queue, [])).filter(q => q.order.branch === branch && q.error);
}
export async function dismissFailed(branch) {
  await writeJson(CACHE.queue, (await readJson(CACHE.queue, [])).filter(q => !(q.order.branch === branch && q.error)));
}

/* Tries to send everything waiting on the phone. */
export async function flushQueue() {
  const queue = await readJson(CACHE.queue, []);
  if (!queue.length) return { sent: 0 };
  const left = [];
  let sent = 0;
  for (const op of queue) {
    if (op.error) { left.push(op); continue; }
    try { await writeOrder(op); sent += 1; }
    catch (e) {
      if (isNetworkError(e)) left.push(op);
      else left.push({ ...op, error: e.message || 'Could not send' });
    }
  }
  await writeJson(CACHE.queue, left);
  return { sent };
}
