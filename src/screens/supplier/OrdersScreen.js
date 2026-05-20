import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { BRANCHES, COLORS } from '../../constants';

const ORANGE = '#E65100';
const ORANGE_LIGHT = '#FFF3E0';

/* ─── helpers ──────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0, 10); }
function n(v) { return parseFloat(v) || 0; }
function extractItems(items) {
  if (!items) return [];
  if (typeof items === 'string') { try { return JSON.parse(items); } catch { return []; } }
  return Array.isArray(items) ? items : [];
}

/* ─── StatusBadge ─────────────────────────────────────────── */
function StatusBadge({ status }) {
  const map = {
    pending:   { emoji: '🟡', label: 'Pending',   bg: '#FFFDE7', color: '#F57F17' },
    confirmed: { emoji: '🔵', label: 'Confirmed', bg: '#E3F2FD', color: '#1565C0' },
    delivered: { emoji: '✅', label: 'Delivered', bg: '#E8F5E9', color: '#2E7D32' },
  };
  const cfg = map[status || 'pending'] || map.pending;
  return (
    <View style={[sb.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[sb.txt, { color: cfg.color }]}>{cfg.emoji} {cfg.label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  txt:   { fontSize: 11, fontWeight: '800' },
});

/* ─── BranchCard ──────────────────────────────────────────── */
function BranchCard({ order, onConfirm, onDeliver, onNoteChange, saving }) {
  const [expanded, setExpanded] = useState(false);
  const items = extractItems(order.items);

  return (
    <View style={bc.card}>
      {/* Header row */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={bc.header}>
          <View style={{ flex: 1 }}>
            <Text style={bc.branchName}>{order.branch}</Text>
            <Text style={bc.meta}>{items.length} items · {order.submitted_at ? order.submitted_at.slice(0, 16).replace('T', ' ') : ''}</Text>
          </View>
          <StatusBadge status={order.status || 'pending'} />
          <Text style={bc.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {/* Expanded body */}
      {expanded && (
        <View style={bc.body}>
          {/* Items list */}
          {items.length === 0
            ? <Text style={bc.emptyTxt}>No items in this order</Text>
            : items.map((it, i) => (
              <View key={i} style={bc.itemRow}>
                <Text style={bc.itemName}>{it.name}</Text>
                <Text style={bc.itemQty}>{it.qty} {it.unit || ''}{it.totalKg ? ` (${it.totalKg}kg)` : ''}</Text>
              </View>
            ))
          }

          {/* Supplier note */}
          <View style={bc.noteWrap}>
            <Text style={bc.noteLabel}>📝 Supplier Note</Text>
            <TextInput
              style={bc.noteInput}
              value={order.supplier_note || ''}
              onChangeText={v => onNoteChange(order.id, v)}
              placeholder="Add a note for this branch..."
              placeholderTextColor="#bbb"
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Action buttons */}
          <View style={bc.actions}>
            {(order.status === 'pending' || !order.status) && (
              <TouchableOpacity
                style={[bc.btn, { backgroundColor: '#1565C0' }]}
                onPress={() => onConfirm(order.id)}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={bc.btnTxt}>✓ Confirm</Text>
              </TouchableOpacity>
            )}
            {(order.status === 'pending' || order.status === 'confirmed' || !order.status) && (
              <TouchableOpacity
                style={[bc.btn, { backgroundColor: COLORS.primary }]}
                onPress={() => onDeliver(order.id)}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={bc.btnTxt}>✅ Delivered</Text>
              </TouchableOpacity>
            )}
            {order.status === 'delivered' && (
              <View style={[bc.btn, { backgroundColor: '#E8F5E9' }]}>
                <Text style={[bc.btnTxt, { color: COLORS.primary }]}>✅ Delivery Complete</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
const bc = StyleSheet.create({
  card:       { backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', borderTopWidth: 3, borderTopColor: ORANGE, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14 },
  branchName: { fontSize: 14, fontWeight: '900', color: '#222' },
  meta:       { fontSize: 11, color: '#aaa', marginTop: 2 },
  chevron:    { fontSize: 12, color: '#bbb' },
  body:       { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  itemRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#F8F8F8' },
  itemName:   { fontSize: 13, color: '#333', flex: 1 },
  itemQty:    { fontSize: 13, fontWeight: '800', color: ORANGE },
  emptyTxt:   { fontSize: 12, color: '#aaa', textAlign: 'center', paddingVertical: 12 },
  noteWrap:   { marginTop: 12 },
  noteLabel:  { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6 },
  noteInput:  { backgroundColor: '#F8F8F8', borderRadius: 8, borderWidth: 1, borderColor: '#E0E0E0', padding: 10, fontSize: 13, color: '#222', minHeight: 50, textAlignVertical: 'top' },
  actions:    { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn:        { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  btnTxt:     { fontSize: 13, fontWeight: '800', color: '#fff' },
});

/* ════════════════════════════════════════════════════════════ */
export default function SupplierOrdersScreen() {
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [dateInput, setDateInput] = useState(todayStr());
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState({}); // { orderId: note }

  /* ── load orders ── */
  const loadOrders = useCallback(async (date) => {
    try {
      const { data, error } = await supabase
        .from('spec_orders')
        .select('*')
        .eq('date', date)
        .order('branch');

      if (error) throw error;
      setOrders(data || []);
    } catch (e) {
      console.error('Load orders error:', e);
      Alert.alert('Load Error', e.message || 'Failed to load orders.');
      setOrders([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadOrders(selectedDate);
  }, [selectedDate, loadOrders]));

  function applyDate() {
    const d = dateInput.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      Alert.alert('Invalid Date', 'Enter date in YYYY-MM-DD format.');
      return;
    }
    setSelectedDate(d);
  }

  /* ── update status ── */
  async function updateStatus(orderId, status) {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('spec_orders')
        .update({ status })
        .eq('id', orderId);

      if (error) {
        if (error.message.includes('column') && error.message.includes('status')) {
          Alert.alert(
            'Column Missing',
            'The "status" column does not exist in spec_orders table.\n\nRun this SQL in Supabase:\nALTER TABLE spec_orders ADD COLUMN status TEXT DEFAULT \'pending\';\nALTER TABLE spec_orders ADD COLUMN supplier_note TEXT;'
          );
        } else {
          throw error;
        }
      } else {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      }
    } catch (e) {
      Alert.alert('Update Error', e.message || 'Failed to update status.');
    }
    setSaving(false);
  }

  /* ── save note ── */
  async function saveNote(orderId, note) {
    try {
      const { error } = await supabase
        .from('spec_orders')
        .update({ supplier_note: note })
        .eq('id', orderId);

      if (error && error.message.includes('column')) {
        // Column doesn't exist yet — silently ignore, note stored locally
      } else if (error) {
        throw error;
      }
    } catch (e) {
      console.warn('Note save error:', e.message);
    }
  }

  function handleNoteChange(orderId, note) {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, supplier_note: note } : o));
    clearTimeout(handleNoteChange._timers?.[orderId]);
    if (!handleNoteChange._timers) handleNoteChange._timers = {};
    handleNoteChange._timers[orderId] = setTimeout(() => saveNote(orderId, note), 800);
  }

  /* ── derived stats ── */
  const branchNames = BRANCHES.map(b => b.name);
  const orderedBranches = new Set(orders.map(o => o.branch));
  const missingBranches = branchNames.filter(b => !orderedBranches.has(b));

  // Consolidated totals across all orders
  const totalsMap = {};
  orders.forEach(o => {
    extractItems(o.items).forEach(it => {
      const key = `${it.name}|||${it.unit || ''}`;
      if (!totalsMap[key]) totalsMap[key] = { name: it.name, unit: it.unit || '', qty: 0, totalKg: 0 };
      totalsMap[key].qty += n(it.qty);
      totalsMap[key].totalKg += n(it.totalKg || 0);
    });
  });
  const totals = Object.values(totalsMap).sort((a, b) => a.name.localeCompare(b.name));

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={ORANGE} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📦 Branch Orders</Text>
        <Text style={s.sub}>Dostana Kebab · Supplier Portal</Text>
      </View>

      {/* Date picker */}
      <View style={s.datePicker}>
        <TextInput
          style={s.dateInput}
          value={dateInput}
          onChangeText={setDateInput}
          onSubmitEditing={applyDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#bbb"
          keyboardType="numeric"
          returnKeyType="done"
        />
        <TouchableOpacity style={s.dateBtn} onPress={applyDate} activeOpacity={0.8}>
          <Text style={s.dateBtnTxt}>Go</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.dateBtn, { backgroundColor: ORANGE_LIGHT }]}
          onPress={() => { const t = todayStr(); setDateInput(t); setSelectedDate(t); }}
          activeOpacity={0.8}
        >
          <Text style={[s.dateBtnTxt, { color: ORANGE }]}>Today</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(selectedDate); }} tintColor={ORANGE} />}
      >
        {/* Stats bar */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{orders.length}</Text>
            <Text style={s.statLbl}>Branches Ordered</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{totals.length}</Text>
            <Text style={s.statLbl}>Products</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={[s.statVal, { color: missingBranches.length > 0 ? COLORS.danger : COLORS.primary }]}>
              {missingBranches.length}
            </Text>
            <Text style={s.statLbl}>Missing</Text>
          </View>
        </View>

        {/* Missing branches warning */}
        {missingBranches.length > 0 && (
          <View style={s.warnCard}>
            <Text style={s.warnTitle}>⚠️ {missingBranches.length} branch{missingBranches.length > 1 ? 'es' : ''} haven't ordered yet</Text>
            <Text style={s.warnTxt}>{missingBranches.join(' · ')}</Text>
          </View>
        )}

        {/* Orders */}
        {orders.length === 0 ? (
          <View style={s.empty}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>📭</Text>
            <Text style={s.emptyTxt}>No orders for {selectedDate}</Text>
            <Text style={s.emptySub}>Branches submit orders via the manager app</Text>
          </View>
        ) : (
          <>
            <Text style={s.sectionLabel}>BRANCH ORDERS · {selectedDate}</Text>
            {orders.map(order => (
              <BranchCard
                key={order.id}
                order={order}
                onConfirm={id => updateStatus(id, 'confirmed')}
                onDeliver={id => updateStatus(id, 'delivered')}
                onNoteChange={handleNoteChange}
                saving={saving}
              />
            ))}
          </>
        )}

        {/* Consolidated totals */}
        {totals.length > 0 && (
          <View style={s.totalsCard}>
            <Text style={s.totalsTitle}>📊 CONSOLIDATED TOTALS · All Branches</Text>
            {totals.map((t, i) => (
              <View key={i} style={s.totalRow}>
                <Text style={s.totalName}>{t.name}</Text>
                <Text style={s.totalQty}>
                  {t.qty} {t.unit}{t.totalKg > 0 ? ` (${t.totalKg}kg)` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F4F6F8' },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:       { backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 18 },
  title:        { fontSize: 20, fontWeight: '900', color: '#fff' },
  sub:          { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  datePicker:   { flexDirection: 'row', backgroundColor: '#fff', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: '#EEE', alignItems: 'center' },
  dateInput:    { flex: 1, borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, color: '#222' },
  dateBtn:      { backgroundColor: ORANGE, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9 },
  dateBtnTxt:   { fontSize: 13, fontWeight: '800', color: '#fff' },
  content:      { padding: 14 },
  statsBar:     { backgroundColor: '#fff', borderRadius: 14, flexDirection: 'row', padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  statItem:     { flex: 1, alignItems: 'center' },
  statVal:      { fontSize: 22, fontWeight: '900', color: ORANGE },
  statLbl:      { fontSize: 10, color: '#aaa', fontWeight: '600', marginTop: 2, textAlign: 'center' },
  statDivider:  { width: 1, backgroundColor: '#EEE', marginHorizontal: 4 },
  warnCard:     { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  warnTitle:    { fontSize: 13, fontWeight: '800', color: COLORS.danger, marginBottom: 4 },
  warnTxt:      { fontSize: 12, color: '#555', lineHeight: 18 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: '#aaa', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  empty:        { alignItems: 'center', padding: 50 },
  emptyTxt:     { fontSize: 16, fontWeight: '800', color: '#555', marginBottom: 6 },
  emptySub:     { fontSize: 12, color: '#aaa', textAlign: 'center' },
  totalsCard:   { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginTop: 12, borderTopWidth: 3, borderTopColor: ORANGE },
  totalsTitle:  { fontSize: 10, fontWeight: '800', color: ORANGE, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F8F8F8' },
  totalName:    { fontSize: 13, color: '#333', flex: 1 },
  totalQty:     { fontSize: 13, fontWeight: '800', color: ORANGE },
});
