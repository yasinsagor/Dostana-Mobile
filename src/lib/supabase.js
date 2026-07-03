import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fqjblkdolxxawvvyoewr.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_uYyqG984_qGCZkF-T4cOqA_Vlb1ibgU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
});

// HACCP register. Mobile can read the approved instructions and append signed
// entries. Register history is deliberately unavailable to the public client;
// it is reviewed through the authenticated manager portal.
export async function fetchHaccpInstructions() {
  const { data, error } = await supabase
    .from('haccp_instructions')
    .select('code,register_type,title,description,steps,limits,sort_order')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data || [];
}

export async function insertHaccpEntry(entry) {
  const { error } = await supabase.from('haccp_register_entries').insert([entry]);
  if (error) throw error;
}

export async function fetchActiveBranches() {
  const [settingsResult, reportsResult, ordersResult] = await Promise.all([
    supabase.from('branch_settings').select('branch,pin').eq('active', true).order('branch'),
    supabase.from('daily_reports').select('branch'),
    supabase.from('spec_orders').select('branch'),
  ]);
  if (settingsResult.error) throw settingsResult.error;
  const byName = new Map();
  for (const item of settingsResult.data || []) byName.set(item.branch, { name: item.branch, pin: item.pin || '' });
  for (const item of [...(reportsResult.data || []), ...(ordersResult.data || [])]) {
    if (item.branch && !byName.has(item.branch)) byName.set(item.branch, { name: item.branch, pin: '' });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// Daily reports
export async function fetchDailyReports(branch, from, to) {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('branch', branch)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function fetchAllDailyReports(from, to) {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertDailyReport(report) {
  const { data, error } = await supabase.from('daily_reports').insert([report]).select().single();
  if (error) throw error;
  return data;
}

export async function updateDailyReport(id, updates) {
  const { data, error } = await supabase.from('daily_reports').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteDailyReport(id) {
  const { error } = await supabase.from('daily_reports').delete().eq('id', id);
  if (error) throw error;
}

// Cashflow reports
export async function fetchCashflowReports(branch, from, to) {
  const { data, error } = await supabase
    .from('cashflow_reports')
    .select('*')
    .eq('branch', branch)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function updateCashflowReport(id, updates) {
  const { data, error } = await supabase.from('cashflow_reports').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCashflowReport(id) {
  const { error } = await supabase.from('cashflow_reports').delete().eq('id', id);
  if (error) throw error;
}

// SPEC orders
export async function fetchSpecOrders(branch) {
  let query = supabase.from('spec_orders').select('*').order('date', { ascending: false });
  if (branch) query = query.eq('branch', branch);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchAllSpecOrders() {
  const { data, error } = await supabase
    .from('spec_orders')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertSpecOrder(order) {
  const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  const { data, error } = await supabase.from('spec_orders').insert([{ id, ...order }]).select().single();
  if (error) throw error;
  return data;
}

export async function updateSpecOrder(id, updates) {
  const { data, error } = await supabase.from('spec_orders').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSpecOrder(id) {
  const { error } = await supabase.from('spec_orders').delete().eq('id', id);
  if (error) throw error;
}

// SPEC products catalogue
export async function fetchSpecProducts() {
  const { data, error } = await supabase.from('spec_products').select('*').order('name');
  if (error) throw error;
  return data;
}

// Branch workers — stored in 'branch_workers' table (branch, name, active)
// Falls back to distinct staff_name from schedules if table doesn't exist yet
export async function fetchBranchWorkers(branch) {
  try {
    const { data, error } = await supabase
      .from('branch_workers')
      .select('name')
      .eq('branch', branch)
      .eq('active', true)
      .order('name');
    if (!error && data && data.length > 0) return data.map(r => r.name);
  } catch {}
  // Fallback: distinct names from schedules
  try {
    const { data } = await supabase
      .from('schedules')
      .select('staff_name')
      .eq('branch', branch);
    if (data && data.length > 0) {
      return [...new Set(data.map(r => r.staff_name).filter(Boolean))].sort();
    }
  } catch {}
  return [];
}

export async function saveBranchWorkers(branch, names) {
  try {
    // Upsert each name
    const rows = names.filter(Boolean).map(name => ({ branch, name, active: true }));
    if (rows.length === 0) return;
    await supabase.from('branch_workers').upsert(rows, { onConflict: 'branch,name', ignoreDuplicates: false });
  } catch {}
}
