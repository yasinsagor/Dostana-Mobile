import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const PERIODS = [
  { label: 'Today', key: 'today' },
  { label: 'This Week', key: 'week' },
  { label: 'This Month', key: 'month' },
];

function getRange(key) {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (key === 'today') return { from: to, to };
  if (key === 'week') {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
    return { from: d.toISOString().slice(0, 10), to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  return { from, to };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmtPLN(n) {
  if (!n && n !== 0) return 'PLN 0,00';
  return 'PLN ' + n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtShort(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k PLN';
  return Math.round(n) + ' PLN';
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1) return 'just now';
  if (diff < 60) return diff + 'm ago';
  const h = Math.floor(diff / 60);
  if (h < 24) return h + 'h ago';
  return Math.floor(h / 24) + 'd ago';
}

export default function OwnerDashboardScreen() {
  const [period, setPeriod] = useState('today');
  const [dailyReports, setDailyReports] = useState([]);
  const [cashflowReports, setCashflowReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p = period) => {
    try {
      const { from, to } = getRange(p);
      const t = todayStr();
      const [daily, { data: cashflow }] = await Promise.all([
        fetchAllDailyReports(from, to),
        supabase.from('cashflow_reports').select('*').gte('date', from).lte('date', to).order('created_at', { ascending: false }),
      ]);
      setDailyReports(daily || []);
      setCashflowReports(cashflow || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [period]);

  useEffect(() => { setLoading(true); load(period); }, [period]);

  const totalRevenue = dailyReports.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const totalProfit = dailyReports.reduce((s, r) => s + (r.net_profit || 0), 0);
  const totalExpenses = cashflowReports.reduce((s, r) => s + (r.total_expenses || r.total || 0), 0);
  const t = todayStr();
  const todayReports = dailyReports.filter(r => r.date === t);
  const reportedSet = new Set(todayReports.map(r => r.branch));
  const reportCount = reportedSet.size;
  const missingBranches = BRANCHES.filter(b => !reportedSet.has(b.name)).map(b => b.name);

  // Per-branch aggregation for week/month
  const branchAgg = BRANCHES.map(b => {
    const brs = dailyReports.filter(r => r.branch === b.name);
    const todayR = todayReports.find(r => r.branch === b.name);
    const rev = brs.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
    const profit = brs.reduce((s, r) => s + (r.net_profit || 0), 0);
    const card = todayR ? (todayR.card_revenue ?? todayR.card ?? 0) : null;
    const cash = todayR ? (todayR.cash_revenue ?? todayR.cash ?? 0) : null;
    return { name: b.name, rev, profit, card, cash, reported: !!todayR, count: brs.length };
  }).filter(b => b.rev > 0).sort((a, b) => b.rev - a.rev);

  const activity = [
    ...dailyReports.map(r => ({
      type: 'daily',
      branch: r.branch,
      amount: r.total_revenue || r.revenue || 0,
      createdAt: r.created_at,
    })),
    ...cashflowReports.map(r => ({
      type: 'cashflow',
      branch: r.branch,
      amount: null,
      createdAt: r.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(period); }}
            colors={[COLORS.primary]}
          />
        }
      >
        <Text style={s.pageTitle}>Dashboard</Text>

        {/* Period selector */}
        <View style={s.pills}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[s.pill, period === p.key && s.pillActive]}
              onPress={() => setPeriod(p.key)}
            >
              <Text style={[s.pillText, period === p.key && s.pillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={s.loadBox}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : (
          <>
            {/* 4 metric cards */}
            <View style={s.metricsGrid}>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>REVENUE</Text>
                <Text style={[s.metricValue, { color: COLORS.primary }]}>PLN {(totalRevenue / 1000).toFixed(1)}k</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>PROFIT</Text>
                <Text style={[s.metricValue, { color: totalProfit >= 0 ? COLORS.primary : COLORS.danger }]}>
                  PLN {(Math.abs(totalProfit) / 1000).toFixed(1)}k
                </Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>EXPENSES</Text>
                <Text style={[s.metricValue, { color: COLORS.danger }]}>{fmtPLN(totalExpenses)}</Text>
              </View>
              <View style={s.metricCard}>
                <Text style={s.metricLabel}>REPORTS</Text>
                <Text style={[s.metricValue, { color: COLORS.text }]}>{reportCount}/{BRANCHES.length}</Text>
              </View>
            </View>

            {/* Missing branches warning (today only) */}
            {missingBranches.length > 0 && (
              <View style={s.warningBox}>
                <Text style={s.warningText}>
                  No report: {missingBranches.join(', ')}
                </Text>
              </View>
            )}

            {/* Branch cards */}
            {period === 'today' ? (
              todayReports.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>No reports submitted today yet.</Text>
                </View>
              ) : (
                todayReports.map((r) => {
                  const card = r.card_revenue ?? r.card ?? 0;
                  const cash = r.cash_revenue ?? r.cash ?? 0;
                  const rev = r.total_revenue || r.revenue || 0;
                  const profit = r.net_profit || 0;
                  return (
                    <View key={r.id || r.branch} style={s.branchCard}>
                      <View style={s.branchLeft}>
                        <View style={s.greenDot} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.branchName}>{r.branch}</Text>
                          <Text style={s.branchSub} numberOfLines={1}>
                            Card:{fmtPLN(card)}  Cash:{fmtPLN(cash)}
                          </Text>
                        </View>
                      </View>
                      <View style={s.branchRight}>
                        <Text style={s.branchRev}>{fmtPLN(rev)}</Text>
                        <Text style={[s.branchProfit, { color: profit >= 0 ? COLORS.primary : COLORS.danger }]}>
                          {fmtPLN(profit)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            ) : (
              branchAgg.length === 0 ? (
                <View style={s.emptyBox}>
                  <Text style={s.emptyText}>No data for this period.</Text>
                </View>
              ) : (
                branchAgg.map((b, i) => {
                  const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
                  return (
                    <View key={b.name} style={s.branchCard}>
                      <View style={s.branchLeft}>
                        <View style={[s.greenDot, { backgroundColor: b.reported ? '#43A047' : '#bbb' }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={s.branchName}>{medal ? medal + ' ' : ''}{b.name}</Text>
                          <Text style={s.branchSub}>{b.count} report{b.count !== 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <View style={s.branchRight}>
                        <Text style={s.branchRev}>{fmtPLN(b.rev)}</Text>
                        <Text style={[s.branchProfit, { color: b.profit >= 0 ? COLORS.primary : COLORS.danger }]}>
                          {fmtPLN(b.profit)}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            )}

            {/* Recent Activity */}
            {activity.length > 0 && (
              <>
                <Text style={s.sectionTitle}>RECENT ACTIVITY</Text>
                {activity.map((a, i) => (
                  <View key={i} style={s.activityRow}>
                    <View style={[s.activityIcon, { backgroundColor: a.type === 'daily' ? '#FFF3E0' : '#E8F5E9' }]}>
                      <Text style={s.activityEmoji}>{a.type === 'daily' ? '📋' : '💰'}</Text>
                    </View>
                    <View style={s.activityInfo}>
                      <Text style={s.activityBranch}>{a.branch}</Text>
                      <Text style={s.activityType}>{a.type === 'daily' ? 'Daily Report' : 'Cash Flow'} · {a.branch}</Text>
                    </View>
                    <View style={s.activityRight}>
                      {a.amount ? <Text style={s.activityAmount}>{fmtShort(a.amount)}</Text> : null}
                      <Text style={s.activityTime}>{timeAgo(a.createdAt)}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 14 },

  pills: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  pill: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#ddd' },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillText: { fontSize: 13, fontWeight: '600', color: '#666' },
  pillTextActive: { color: '#fff' },

  loadBox: { paddingVertical: 60, alignItems: 'center' },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, width: '47.5%',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  metricLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: '800' },

  warningBox: {
    backgroundColor: '#FFF8E1', borderRadius: 10, padding: 12, marginBottom: 14,
    borderLeftWidth: 3, borderLeftColor: '#FFA000',
  },
  warningText: { color: '#E65100', fontSize: 13, fontWeight: '500', lineHeight: 20 },

  branchCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2,
  },
  branchLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#43A047', marginTop: 4, marginRight: 10 },
  branchName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 3 },
  branchSub: { fontSize: 11, color: '#888' },
  branchRight: { alignItems: 'flex-end' },
  branchRev: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  branchProfit: { fontSize: 12, fontWeight: '600', marginTop: 2 },

  emptyBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 14 },
  emptyText: { color: '#aaa', fontSize: 14 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#999', letterSpacing: 1.5, marginTop: 10, marginBottom: 10 },
  activityRow: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  activityIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityEmoji: { fontSize: 20 },
  activityInfo: { flex: 1 },
  activityBranch: { fontSize: 14, fontWeight: '700', color: '#111' },
  activityType: { fontSize: 12, color: '#999', marginTop: 2 },
  activityRight: { alignItems: 'flex-end' },
  activityAmount: { fontSize: 13, fontWeight: '700', color: '#111' },
  activityTime: { fontSize: 11, color: '#bbb', marginTop: 2 },
});
