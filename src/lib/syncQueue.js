import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { expiredHaccp } from './haccpRetention';

const QUEUE_KEY = 'dostana_offline_sync_queue_v1';
const STATUS_KEY = 'dostana_last_sync_v1';

async function readQueue() {
  try {
    const queue = JSON.parse(await AsyncStorage.getItem(QUEUE_KEY)) || [];
    const retained = queue.filter(item => item.kind !== 'haccp_entry' || !expiredHaccp(item.payload.recorded_at || item.createdAt));
    if (retained.length !== queue.length) await writeQueue(retained);
    return retained;
  }
  catch { return []; }
}

async function writeQueue(items) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function getSyncState() {
  const [queue, lastSync] = await Promise.all([readQueue(), AsyncStorage.getItem(STATUS_KEY)]);
  return { pending: queue.length, lastSync };
}

export async function queueMutation(kind, payload, stableKey) {
  const queue = await readQueue();
  const key = stableKey || `${kind}:${Date.now()}`;
  const next = [...queue.filter(item => item.key !== key), {
    key, kind, payload, createdAt: new Date().toISOString(), attempts: 0,
  }];
  await writeQueue(next);
  return next.length;
}

async function execute(item) {
  const { kind, payload } = item;
  if (kind === 'daily_report') {
    const clean = { ...payload };
    delete clean.revenue;
    delete clean.repos;
    delete clean.wydatki;
    const { data: current, error: readError } = await supabase
      .from('daily_reports').select('id').eq('branch', payload.branch).eq('date', payload.date).maybeSingle();
    if (readError) throw readError;
    const query = current
      ? supabase.from('daily_reports').update(clean).eq('id', current.id)
      : supabase.from('daily_reports').insert([clean]);
    const { error } = await query;
    if (error) throw error;
    return;
  }
  if (kind === 'haccp_entry') {
    const { error } = await supabase.from('haccp_register_entries').insert([{ ...payload, recorded_at: payload.recorded_at || item.createdAt }]);
    if (error && error.code !== '23505') throw error;
    return;
  }
  if (kind === 'spec_order') {
    const { data: current, error: readError } = await supabase
      .from('spec_orders').select('id').eq('id', payload.id).maybeSingle();
    if (readError) throw readError;
    const query = current
      ? supabase.from('spec_orders').update(payload).eq('id', payload.id)
      : supabase.from('spec_orders').insert([payload]);
    const { error } = await query;
    if (error) throw error;
    return;
  }
  throw new Error(`Unknown queued operation: ${kind}`);
}

export async function flushSyncQueue() {
  const queue = await readQueue();
  if (!queue.length) return { pending: 0, synced: 0, lastSync: await AsyncStorage.getItem(STATUS_KEY) };
  const remaining = [];
  let synced = 0;
  for (const item of queue) {
    try { await execute(item); synced += 1; }
    catch { remaining.push({ ...item, attempts: (item.attempts || 0) + 1 }); }
  }
  await writeQueue(remaining);
  const lastSync = new Date().toISOString();
  if (synced) await AsyncStorage.setItem(STATUS_KEY, lastSync);
  return { pending: remaining.length, synced, lastSync };
}
