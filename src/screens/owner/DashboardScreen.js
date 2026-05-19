import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const CHART_H = 80;

function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function dayLabel(ds) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(ds + 'T12:00:00').getDay()]; }

function fmtK(n) {
  if (!n) return '0';
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function fmtPLN(n) {
  if (!n && n !== 0) return 'PLN 0,00';
  return 'PLN ' + n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function extractItems(items) {
  if (!items) return {};
  let obj = items;
  if (typeof items === 'string') { try { obj = JSON.parse(items); } catch { return {}; } }
  if (Array.isArray(obj)) {
    return obj.reduce((acc, i) => {
      const k = i.name || i.productName || i.product || 'Item';
      acc[k] = (acc[k] || 0) + (Number(i.qty ?? i.quantity ?? i.amount ?? 0));
      return acc;
    }, {});
  }
  if (typeof obj === 'object') return obj;
  return {};
}

export default function OwnerDashboardScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayDaily, setTodayDaily] = useState([]);
  const [todayCashflow, setTodayCashflow] = useState([]);
  const [todaySpec, setTodaySpec] = useState([]);
  const [trendDaily, setTrendDaily] = useState([]);

  const load = useCallback(async () => {
    try {
      const t = todayStr();
      const wk = daysAgoStr(6);
      const [daily, cfRes, spRes, trend] = await Promise.all([
        fetchAllDailyReports(t, t),
        supabase.from('cashflow_reports').select('*').eq('date', t),
        supabase.from('spec_orders').select('*').eq('date', t),
        fetchAllDailyReports(wk, t),
      ]);
      setTodayDaily(daily || []);
      setTodayCashflow(cfRes.data || []);
      setTodaySpec(spRes.data || []);
      setTrendDaily(trend || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const t = todayStr();
  const submittedSet = new Set(todayDaily.map(r => r.branch));
  const cashflowSet = new Set(todayCashflow.map(r => r.branch));
  const specSet = new Set(todaySpec.map(r => r.branch));

  const todayRevenue = todayDaily.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const todayExpenses = todayCashflow.reduce((s, r) => s + (r.total_expenses || r.total || 0), 0);
  const todayCash = todayDaily.reduce((s, r) => s + (r.cash_revenue || r.cash || 0), 0);

  // Alerts
  const missingDaily = BRANCHES.filter(b => !submittedSet.has(b.name));
  const missingCF = BRANCHES.filter(b => submittedSet.has(b.name) && !cashflowSet.has(b.name));
  const negBranches = todayDaily.filter(r => (r.net_profit || 0) < 0);
  const alerts = [];
  if (missingDaily.length > 0)
    alerts.push({ kind: 'error', icon: '🚨', msg: `${missingDaily.length} missing daily report: ${missingDaily.map(b => b.name).join(', ')}` });
  if (missingCF.length > 0)
    alerts.push({ kind: 'warn', icon: '⚠️', msg: `Cash flow missing: ${missingCF.map(b => b.name).join(', ')}` });
  if (todaySpec.length === 0)
    alerts.push({ kind: 'warn', icon: '📦', msg: 'No SPEC orders submitted today' });
  if (negBranches.length > 0)
    alerts.push({ kind: 'error', icon: '📉', msg: `Negative balance: ${negBranches.map(r => r.branch).join(', ')}` });
  if (todayRevenue > 0 && todayExpenses / todayRevenue > 0.8)
    alerts.push({ kind: 'warn', icon: '💸', msg: `High expenses: ${Math.round(todayExpenses / todayRevenue * 100)}% of today revenue` });

  // SPEC aggregation
  const specAgg = {};
  let topBranch = null; let topTotal = 0;
  todaySpec.forEach(order => {
    const items = extractItems(order.items);
    let bt = 0;
    Object.entries(items).forEach(([k, v]) => { specAgg[k] = (specAgg[k] || 0) + (Number(v) || 0); bt += Number(v) || 0; });
    if (bt > topTotal) { topTotal = bt; topBranch = order.branch; }
  });
  const specEntries = Object.entries(specAgg).sort((a, b) => b[1] - a[1]);

  // Branch status sorted by revenue
  const branchStatus = BRANCHES.map(b => {
    const dr = todayDaily.find(r => r.branch === b.name);
    return {
      name: b.name,
      submitted: !!dr,
      revenue: dr ? (dr.total_revenue || dr.revenue || 0) : 0,
      profit: dr ? (dr.net_profit || 0) : 0,
      hours: dr ? (dr.hours || 0) : 0,
      specDone: specSet.has(b.name),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // Trend data
  const last7 = Array.from({ length: 7 }, (_, i) => daysAgoStr(6 - i));
  const trendByDay = last7.map(date => ({
    date,
    rev: trendDaily.filter(r => r.date === date).reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0),
  }));
  const maxRev = Math.max(...trendByDay.map(d => d.rev), 1);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {/* Header */}
        <Text style={s.pageTitle}>Dashboard</Text>
        <Text style={s.pageDate}>{new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })}</Text>

        {/* ── 1. ALERTS ── */}
        {alerts.length > 0 && (
          <View style={s.alertsSection}>
            {alerts.map((a, i) => (
              <View key={i} style={[s.alertCard, a.kind === 'error' ? s.alertError : s.alertWarn]}>
                <Text style={s.alertIcon}>{a.icon}</Text>
                <Text style={[s.alertText, a.kind === 'error' ? s.alertTextError : s.alertTextWarn]} numberOfLines={2}>
                  {a.msg}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 2. TODAY SUMMARY ── */}
        <Text style={s.secTitle}>💰 Today Summary</Text>
        <View style={s.grid2}>
          <View style={s.metCard}>
            <Text style={s.metLabel}>REVENUE</Text>
            <Text style={[s.metVal, { color: COLORS.primary }]}>PLN {fmtK(todayRevenue)}</Text>
          </View>
          <View style={s.metCard}>
            <Text style={s.metLabel}>EXPENSES</Text>
            <Text style={[s.metVal, { color: COLORS.danger }]}>PLN {fmtK(todayExpenses)}</Text>
          </View>
          <View style={s.metCard}>
            <Text style={s.metLabel}>CASH</Text>
            <Text style={[s.metVal, { color: '#1565C0' }]}>PLN {fmtK(todayCash)}</Text>
          </View>
          <View style={s.metCard}>
            <Text style={s.metLabel}>SUBMITTED</Text>
            <Text style={[s.metVal, { color: COLORS.text }]}>{submittedSet.size}/{BRANCHES.length}</Text>
          </View>
        </View>

        {/* ── 3. TODAY SPEC ORDERS ── */}
        <Text style={s.secTitle}>📦 Today SPEC Orders</Text>
        <View style={s.card}>
          {todaySpec.length === 0 ? (
            <Text style={s.emptyTxt}>No SPEC orders submitted today</Text>
          ) : specEntries.length === 0 ? (
            <Text style={s.emptyTxt}>Orders submitted — no item detail available</Text>
          ) : (
            <>
              {specEntries.slice(0, 6).map(([name, qty]) => (
                <View key={name} style={s.specRow}>
                  <Text style={s.specName}>{name}</Text>
                  <Text style={s.specQty}>{qty} units</Text>
                </View>
              ))}
              {topBranch && (
                <View style={s.specHighlight}>
                  <Text style={s.specHighlightTxt}>🏆 {topBranch} ordered the most today</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── 4. BRANCH STATUS ── */}
        <Text style={s.secTitle}>🏆 Branch Status</Text>
        {branchStatus.map((b, i) => {
          const medal = b.submitted ? (i === 0 ? '🥇 ' : i === 1 ? '🥈 ' : i === 2 ? '🥉 ' : '') : '';
          return (
            <View key={b.name} style={[s.branchCard, !b.submitted && { opacity: 0.6 }]}>
              <View style={s.branchHeader}>
                <View style={[s.dot, { backgroundColor: b.submitted ? '#43A047' : '#ccc' }]} />
                <Text style={s.branchName}>{medal}{b.name}</Text>
                <View style={s.badges}>
                  <View style={[s.badge, b.submitted ? s.badgeGreen : s.badgeRed]}>
                    <Text style={s.badgeTxt}>{b.submitted ? '✅ Daily' : '❌ Daily'}</Text>
                  </View>
                  <View style={[s.badge, b.specDone ? s.badgeGreen : s.badgeGrey]}>
                    <Text style={s.badgeTxt}>{b.specDone ? '✅ SPEC' : '— SPEC'}</Text>
                  </View>
                </View>
              </View>
              {b.submitted && (
                <View style={s.branchStats}>
                  <View style={s.bStat}>
                    <Text style={s.bStatVal}>{fmtK(b.revenue)}</Text>
                    <Text style={s.bStatLbl}>Revenue</Text>
                  </View>
                  <View style={s.bStat}>
                    <Text style={[s.bStatVal, { color: b.profit >= 0 ? COLORS.primary : COLORS.danger }]}>
                      {b.profit >= 0 ? '+' : ''}{fmtK(b.profit)}
                    </Text>
                    <Text style={s.bStatLbl}>Profit</Text>
                  </View>
                  <View style={s.bStat}>
                    <Text style={s.bStatVal}>{b.hours}h</Text>
                    <Text style={s.bStatLbl}>Hours</Text>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {/* ── 5. 7-DAY TREND ── */}
        <Text style={s.secTitle}>📈 7-Day Revenue Trend</Text>
        <View style={s.card}>
          <View style={s.chartRow}>
            {trendByDay.map((d) => {
              const barH = Math.max(4, (d.rev / maxRev) * CHART_H);
              const isToday = d.date === t;
              return (
                <View key={d.date} style={s.barCol}>
                  <Text style={s.barValTxt}>{d.rev > 0 ? fmtK(d.rev) : ''}</Text>
                  <View style={[s.bar, { height: barH, backgroundColor: isToday ? COLORS.primary : '#A5D6A7' }]} />
                  <Text style={[s.barLbl, isToday && { color: COLORS.primary, fontWeight: '700' }]}>
                    {dayLabel(d.date)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── 6. QUICK ACTIONS ── */}
        <Text style={s.secTitle}>⚡ Quick Actions</Text>
        <View style={s.actGrid}>
          {[
            { icon: '📦', label: 'SPEC Center', tab: 'SPEC' },
            { icon: '📊', label: 'Performance', tab: 'Performance' },
            { icon: '💵', label: 'Cash Flow', tab: 'Cash Flow' },
            { icon: '⚙️', label: 'Settings', tab: 'Settings' },
          ].map(a => (
            <TouchableOpacity key={a.tab} style={s.actBtn} onPress={() => navigation.navigate(a.tab)}>
              <Text style={s.actIcon}>{a.icon}</Text>
              <Text style={s.actLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 50 },
  pageTitle: { fontSize: 28, fontWeight: '800', color: '#111', marginBottom: 2 },
  pageDate: { fontSize: 13, color: '#888', marginBottom: 16 },

  secTitle: { fontSize: 15, fontWeight: '800', color: '#333', marginTop: 20, marginBottom: 10 },

  alertsSection: { gap: 8, marginBottom: 4 },
  alertCard: { flexDirection: 'row', alignItems: 'flex-start', borderRadius: 10, padding: 12, gap: 10 },
  alertError: { backgroundColor: '#FFEBEE' },
  alertWarn: { backgroundColor: '#FFF8E1' },
  alertIcon: { fontSize: 16, marginTop: 1 },
  alertText: { flex: 1, fontSize: 13, lineHeight: 20, fontWeight: '500' },
  alertTextError: { color: '#B71C1C' },
  alertTextWarn: { color: '#E65100' },

  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metCard: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  metLabel: { fontSize: 11, fontWeight: '700', color: '#aaa', letterSpacing: 1, marginBottom: 6 },
  metVal: { fontSize: 22, fontWeight: '800' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  emptyTxt: { color: '#bbb', fontSize: 14, textAlign: 'center', paddingVertical: 8 },

  specRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  specName: { fontSize: 14, color: '#333', fontWeight: '500' },
  specQty: { fontSize: 14, color: '#6A1B9A', fontWeight: '700' },
  specHighlight: { marginTop: 12, backgroundColor: '#F3E5F5', borderRadius: 8, padding: 10 },
  specHighlightTxt: { fontSize: 13, color: '#6A1B9A', fontWeight: '600' },

  branchCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  branchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  branchName: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111' },
  badges: { flexDirection: 'row', gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '600' },
  badgeGreen: { backgroundColor: '#E8F5E9' },
  badgeRed: { backgroundColor: '#FFEBEE' },
  badgeGrey: { backgroundColor: '#F5F5F5' },
  branchStats: { flexDirection: 'row', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 0 },
  bStat: { flex: 1, alignItems: 'center' },
  bStatVal: { fontSize: 14, fontWeight: '800', color: '#111' },
  bStatLbl: { fontSize: 11, color: '#aaa', marginTop: 2 },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: CHART_H + 40 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 2 },
  barValTxt: { fontSize: 8, color: '#999', marginBottom: 2 },
  bar: { width: '80%', borderRadius: 4, minHeight: 4 },
  barLbl: { fontSize: 10, color: '#aaa', marginTop: 4 },

  actGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actBtn: {
    width: '47.5%', backgroundColor: '#fff', borderRadius: 14, padding: 18,
    alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  actIcon: { fontSize: 28, marginBottom: 8 },
  actLabel: { fontSize: 13, fontWeight: '700', color: '#333' },
});
