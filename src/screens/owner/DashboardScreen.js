import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

function fmt(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toString();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  return { from, to };
}

function monthName() {
  return new Date().toLocaleString('en', { month: 'long', year: 'numeric' });
}

export default function OwnerDashboardScreen() {
  const { logout } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const { from, to } = monthRange();
      const data = await fetchAllDailyReports(from, to);
      setReports(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const todayStr = today();
  const todayReports = reports.filter(r => r.date === todayStr);
  const todayRevenue = todayReports.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const monthRevenue = reports.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const todayBranches = new Set(todayReports.map(r => r.branch)).size;

  // Per-branch month aggregation
  const branchStats = BRANCHES.map(b => {
    const bReports = reports.filter(r => r.branch === b.name);
    const todayRep = todayReports.find(r => r.branch === b.name);
    const rev = bReports.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
    const profit = bReports.reduce((s, r) => s + (r.net_profit || 0), 0);
    return { name: b.name, rev, profit, todayRev: todayRep ? (todayRep.total_revenue || todayRep.revenue || 0) : null, count: bReports.length };
  }).sort((a, b) => b.rev - a.rev);

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>🏠 Owner Dashboard</Text>
          <TouchableOpacity onPress={logout}><Text style={s.logoutBtn}>Log out</Text></TouchableOpacity>
        </View>
        <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🏠 Owner Dashboard</Text>
        <TouchableOpacity onPress={logout}><Text style={s.logoutBtn}>Log out</Text></TouchableOpacity>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Chain header */}
        <View style={s.chainCard}>
          <Text style={s.chainLabel}>CHAIN OVERVIEW — {monthName().toUpperCase()}</Text>
          <View style={s.chainRow}>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{fmt(monthRevenue)} PLN</Text>
              <Text style={s.chainStatLabel}>Month Revenue</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{fmt(todayRevenue)} PLN</Text>
              <Text style={s.chainStatLabel}>Today</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{todayBranches}/{BRANCHES.length}</Text>
              <Text style={s.chainStatLabel}>Reported Today</Text>
            </View>
          </View>
        </View>

        {/* Today alert if branches missing */}
        {todayBranches < BRANCHES.length && (
          <View style={s.alertBox}>
            <Text style={s.alertText}>
              ⚠️ {BRANCHES.length - todayBranches} branch{BRANCHES.length - todayBranches > 1 ? 'es have' : ' has'} not reported today
            </Text>
          </View>
        )}

        {/* Branch cards */}
        <Text style={s.sectionTitle}>Branch Performance — {monthName()}</Text>
        {branchStats.map((b, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '📍';
          const hasToday = b.todayRev !== null;
          const profitColor = b.profit >= 0 ? COLORS.primary : COLORS.danger;
          return (
            <View key={b.name} style={s.branchCard}>
              <View style={s.branchRow}>
                <Text style={s.medal}>{medal}</Text>
                <View style={s.branchInfo}>
                  <Text style={s.branchName}>{b.name}</Text>
                  <Text style={s.branchSub}>{b.count} reports this month</Text>
                </View>
                <View style={s.branchRight}>
                  <Text style={s.branchRev}>{fmt(b.rev)} PLN</Text>
                  <Text style={[s.branchProfit, { color: profitColor }]}>
                    {b.profit >= 0 ? '+' : ''}{fmt(b.profit)} profit
                  </Text>
                </View>
              </View>

              <View style={s.branchFooter}>
                <View style={[s.todayBadge, { backgroundColor: hasToday ? COLORS.primaryLight : '#FFF3E0' }]}>
                  <Text style={[s.todayText, { color: hasToday ? COLORS.primary : COLORS.warning }]}>
                    {hasToday ? `Today: ${fmt(b.todayRev)} PLN` : 'No report today'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}

        <Text style={s.pullHint}>Pull down to refresh</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  logoutBtn: { fontSize: 13, color: COLORS.danger, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { backgroundColor: COLORS.dangerLight, borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: COLORS.danger, fontSize: 13 },
  chainCard: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, marginBottom: 12 },
  chainLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 10 },
  chainRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chainStat: { alignItems: 'center', flex: 1 },
  chainVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
  chainStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  alertBox: { backgroundColor: '#FFF3E0', borderRadius: 10, padding: 12, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  alertText: { color: COLORS.warning, fontSize: 13, fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 10, marginTop: 4, letterSpacing: 0.5 },
  branchCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  branchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  medal: { fontSize: 24, marginRight: 10 },
  branchInfo: { flex: 1 },
  branchName: { fontSize: 13, fontWeight: '800', color: COLORS.text },
  branchSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  branchRight: { alignItems: 'flex-end' },
  branchRev: { fontSize: 15, fontWeight: '900', color: COLORS.text },
  branchProfit: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  branchFooter: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  todayBadge: { borderRadius: 6, padding: 6, alignSelf: 'flex-start' },
  todayText: { fontSize: 11, fontWeight: '700' },
  pullHint: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 11, marginTop: 10 },
});
