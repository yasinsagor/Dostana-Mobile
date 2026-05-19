import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

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
  const [dailyReports, setDailyReports] = useState([]);
  const [cashflowReports, setCashflowReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = todayStr();
      const [daily, { data: cashflow }] = await Promise.all([
        fetchAllDailyReports(t, t),
        supabase.from('cashflow_reports').select('*').eq('date', t).order('created_at', { ascending: false }),
      ]);
      setDailyReports(daily || []);
      setCashflowReports(cashflow || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalRevenue = dailyReports.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const totalProfit = dailyReports.reduce((s, r) => s + (r.net_profit || 0), 0);
  const totalExpenses = cashflowReports.reduce((s, r) => s + (r.total_expenses || r.total || 0), 0);
  const reportedSet = new Set(dailyReports.map(r => r.branch));
  const reportCount = reportedSet.size;
  const missingBranches = BRANCHES.filter(b => !reportedSet.has(b.name)).map(b => b.name);

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            colors={[COLORS.primary]}
          />
        }
      >
        <Text style={s.pageTitle}>Dashboard</Text>

        {/* 4 metric cards */}
        <View style={s.metricsGrid}>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>REVENUE</Text>
            <Text style={[s.metricValue, { color: COLORS.primary }]}>PLN {(totalRevenue / 1000).toFixed(1)}k</Text>
          </View>
          <View style={s.metricCard}>
            <Text style={s.metricLabel}>PROFIT</Text>
            <Text style={[s.metricValue, { color: COLORS.primary }]}>PLN {(totalProfit / 1000).toFixed(1)}k</Text>
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

        {/* Missing branches warning */}
        {missingBranches.length > 0 && (
          <View style={s.warningBox}>
            <Text style={s.warningText}>
              No report: {missingBranches.join(', ')}
            </Text>
          </View>
        )}

        {/* Branch cards — reported today */}
        {dailyReports.map((r) => {
          const card = r.card_revenue ?? r.card ?? 0;
          const cash = r.cash_revenue ?? r.cash ?? 0;
          const rev = r.total_revenue || r.revenue || 0;
          const profit = r.net_profit || 0;
          return (
            <View key={r.id || r.branch} style={s.branchCard}>
              <View style={s.branchLeft}>
                <View style={s.greenDot} />
                <View>
                  <Text style={s.branchName}>{r.branch}</Text>
                  <Text style={s.branchSub}>
                    {r.branch} | Card:{fmtPLN(card)} Cash:{fmtPLN(cash)}
                  </Text>
                </View>
              </View>
              <View style={s.branchRight}>
                <Text style={s.branchRev}>{fmtPLN(rev)}</Text>
                <Text style={s.branchProfit}>{fmtPLN(profit)}</Text>
              </View>
            </View>
          );
        })}

        {dailyReports.length === 0 && (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>No reports submitted today yet.</Text>
          </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F5F5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 26, fontWeight: '800', color: '#111', marginBottom: 16 },

  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  metricCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    width: '47.5%',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricLabel: { fontSize: 11, fontWeight: '700', color: '#999', letterSpacing: 1, marginBottom: 6 },
  metricValue: { fontSize: 22, fontWeight: '800' },

  warningBox: {
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 3,
    borderLeftColor: '#FFA000',
  },
  warningText: { color: '#E65100', fontSize: 13, fontWeight: '500', lineHeight: 20 },

  branchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  branchLeft: { flexDirection: 'row', alignItems: 'flex-start', flex: 1, marginRight: 8 },
  greenDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#43A047', marginTop: 4, marginRight: 10 },
  branchName: { fontSize: 15, fontWeight: '700', color: '#111', marginBottom: 3 },
  branchSub: { fontSize: 11, color: '#888', flexShrink: 1 },
  branchRight: { alignItems: 'flex-end' },
  branchRev: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  branchProfit: { fontSize: 12, color: '#555', marginTop: 2 },

  emptyBox: { backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 14 },
  emptyText: { color: '#aaa', fontSize: 14 },

  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#999', letterSpacing: 1.5, marginTop: 8, marginBottom: 10 },

  activityRow: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
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
