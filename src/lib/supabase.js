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
  const query = supabase.from('spec_orders').select('*').order('date', { ascending: false });
  if (branch) query.eq('branch', branch);
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
  const { data, error } = await supabase.from('spec_orders').insert([order]).select().single();
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
