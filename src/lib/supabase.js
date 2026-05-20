import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = 'https://acpllsoigparbwmlwbem.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFjcGxsc29pZ3BhcmJ3bWx3YmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1NTI4MzksImV4cCI6MjA5NDEyODgzOX0.c_4fjYsq2R70-RW6psftZv96AG3R_Kxv-IHCH-E4L70';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true },
});

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
