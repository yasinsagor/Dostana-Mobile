import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2,'0'); }
function fmt(n) { if (!n) return '0'; if (Math.abs(n) >= 1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }

export default function OwnerPerformanceScreen() {
  const now = new Date();
  const [selM, setSelM] = useState(now.getMonth() + 1);
  const [selY, setSelY] = useState(now.getFullYear());
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const from = selY+'-'+pad(selM)+'-01';
      const to = selY+'-'+pad(selM)+'-31';
      const data = await fetchAllDailyReports(from, to);
      setReports(data || []);
    } catch(e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [selM, selY]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Aggregate per branch
  const branchData = {};
  BRANCHES.forEach(b => {
    branchData[b.name] = { revenue:0, card:0, cash:0, delivery:0, expenses:0, netProfit:0, warzywa:0, cola:0, gaz:0, spec:0, hours:0, reports:0 };
  });
  reports.forEach(r => {
    const b = branchData[r.branch];
    if (!b) return;
    b.revenue += (r.total_revenue || r.revenue || 0);
    b.card += (r.card || r.karta || 0);
    b.cash += (r.cash || r.gotowka || 0);
    b.delivery += (r.total_delivery || 0);
    b.expenses += (r.total_expenses || 0);
    b.netProfit += (r.net_profit || 0);
    b.hours += (r.hours || 0);
    b.reports++;
    const exp = r.wydatki ? (typeof r.wydatki === 'string' ? JSON.parse(r.wydatki) : r.wydatki) : [];
    exp.forEach(e => {
      const nm = (e.name||e.kategoria||'').toLowerCase();
      const val = parseFloat(e.amount||e.kwota||0);
      if (/warz|salad|vegeta/i.test(nm)) b.warzywa += val;
      else if (/cola|pepsi|napoj/i.test(nm)) b.cola += val;
      else if (/gaz|gas/i.test(nm)) b.gaz += val;
      else if (/spec/i.test(nm)) b.spec += val;
    });
  });

  const branches = BRANCHES.map(b => b.name).filter(br => branchData[br].reports > 0);
  const n = branches.length || 1;
  const avgRev = branches.reduce((s,b) => s + branchData[b].revenue, 0) / n;
  const avgDel = branches.reduce((s,b) => s + (branchData[b].revenue > 0 ? branchData[b].delivery/branchData[b].revenue*100 : 0), 0) / n;
  const avgWarz = branches.reduce((s,b) => s + (branchData[b].revenue > 0 ? branchData[b].warzywa/branchData[b].revenue*100 : 0), 0) / n;
  const avgRPH = branches.reduce((s,b) => s + (branchData[b].hours > 0 ? branchData[b].revenue/branchData[b].hours : 0), 0) / n;

  const scored = BRANCHES.map(b => {
    const d = branchData[b.name];
    let score = 0;
    if (d.revenue >= avgRev) score += 30; else score += Math.round(d.revenue/avgRev*30);
    const delPct = d.revenue > 0 ? d.delivery/d.revenue*100 : 0;
    if (delPct >= avgDel) score += 25; else score += Math.round(delPct/Math.max(avgDel,1)*25);
    const rph = d.hours > 0 ? d.revenue/d.hours : 0;
    if (rph >= avgRPH*0.9) score += 25; else if (rph > 0) score += Math.round(rph/avgRPH*25);
    const wPct = d.revenue > 0 ? d.warzywa/d.revenue*100 : 0;
    if (wPct > 0 && wPct <= avgWarz*1.1) score += 20; else if (wPct === 0) score += 15;
    return { br: b.name, d, score: Math.min(100, score), delPct, rph, wPct };
  }).filter(x => x.d.reports > 0).sort((a,b) => b.score - a.score);

  const totalRev = branches.reduce((s,b) => s + branchData[b].revenue, 0);
  const medals = ['🥇','🥈','🥉'];

  const years = [now.getFullYear(), now.getFullYear()-1];

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📊 Performance</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📊 Performance</Text></View>
      <ScrollView
        style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {/* Month/Year selector */}
        <View style={s.selRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {MONTHS.map((m,i) => (
              <TouchableOpacity key={m} onPress={() => setSelM(i+1)} style={[s.pill, selM===i+1 && s.pillActive]}>
                <Text style={[s.pillTxt, selM===i+1 && s.pillTxtActive]}>{m.slice(0,3)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <View style={s.selRow}>
          {years.map(y => (
            <TouchableOpacity key={y} onPress={() => setSelY(y)} style={[s.pill, selY===y && s.pillActive]}>
              <Text style={[s.pillTxt, selY===y && s.pillTxtActive]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chain header */}
        <View style={s.chainCard}>
          <Text style={s.chainLabel}>CHAIN — {MONTHS[selM-1].toUpperCase()} {selY}</Text>
          <View style={s.chainRow}>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{fmt(totalRev)} PLN</Text>
              <Text style={s.chainStatLbl}>Total Revenue</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{scored.length}</Text>
              <Text style={s.chainStatLbl}>Active Branches</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{scored.length > 0 ? fmt(totalRev/scored.length) : '0'}</Text>
              <Text style={s.chainStatLbl}>Avg/Branch</Text>
            </View>
          </View>
        </View>

        {scored.length === 0 && (
          <View style={s.empty}><Text style={s.emptyTxt}>No data for {MONTHS[selM-1]} {selY}</Text></View>
        )}

        {/* Branch cards */}
        {scored.map((item, idx) => {
          const rank = idx + 1;
          const isGood = item.score >= 75, isWarn = item.score >= 50 && item.score < 75;
          const color = isGood ? COLORS.primary : isWarn ? COLORS.warning : COLORS.danger;
          const bg = isGood ? COLORS.primaryLight : isWarn ? COLORS.warningLight : COLORS.dangerLight;
          const revDiff = item.d.revenue - avgRev;
          const medal = medals[idx] || (rank <= Math.ceil(scored.length/2) ? '📈' : '📉');

          return (
            <View key={item.br} style={[s.card, { borderColor: color, backgroundColor: bg }]}>
              {/* Header */}
              <View style={s.cardHeader}>
                <Text style={s.medal}>{medal}</Text>
                <View style={s.cardInfo}>
                  <Text style={[s.cardName, { color }]}>#{rank} {item.br}</Text>
                  <Text style={s.cardSub}>{item.d.reports} reports · Score {item.score}/100</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={[s.cardRev, { color }]}>{fmt(item.d.revenue/1000)}k PLN</Text>
                  <Text style={[s.cardDiff, { color: revDiff >= 0 ? COLORS.primary : COLORS.danger }]}>
                    {revDiff >= 0 ? '+' : ''}{fmt(revDiff/1000)}k vs avg
                  </Text>
                </View>
              </View>

              {/* Score bar */}
              <View style={s.barBg}>
                <View style={[s.barFill, { width: item.score+'%', backgroundColor: color }]} />
              </View>

              {/* Metrics grid */}
              <View style={s.metrics}>
                <View style={s.metric}>
                  <Text style={s.metricVal}>{item.d.hours > 0 ? Math.round(item.rph) : '—'}</Text>
                  <Text style={s.metricLbl}>PLN/hr</Text>
                </View>
                <View style={s.metric}>
                  <Text style={s.metricVal}>{item.delPct.toFixed(0)}%</Text>
                  <Text style={s.metricLbl}>Delivery</Text>
                </View>
                <View style={s.metric}>
                  <Text style={s.metricVal}>{item.d.warzywa > 0 ? item.wPct.toFixed(1)+'%' : '—'}</Text>
                  <Text style={s.metricLbl}>Warzywa</Text>
                </View>
                <View style={s.metric}>
                  <Text style={[s.metricVal, { color: item.d.netProfit >= 0 ? COLORS.primary : COLORS.danger }]}>
                    {item.d.netProfit >= 0 ? '+' : ''}{fmt(item.d.netProfit/1000)}k
                  </Text>
                  <Text style={s.metricLbl}>Net Profit</Text>
                </View>
              </View>

              {/* Tips */}
              {item.wPct > 0 && item.wPct > avgWarz * 1.1 && (
                <View style={s.tip}><Text style={s.tipTxt}>🥬 Warzywa {item.wPct.toFixed(1)}% — above chain avg {avgWarz.toFixed(1)}% — review portions</Text></View>
              )}
              {item.delPct > 0 && item.delPct < avgDel * 0.85 && (
                <View style={s.tip}><Text style={s.tipTxt}>🛵 Delivery {item.delPct.toFixed(1)}% — below avg {avgDel.toFixed(1)}% — push platforms</Text></View>
              )}
              {item.score >= 75 && (
                <View style={[s.tip, { backgroundColor: COLORS.primaryLight }]}><Text style={[s.tipTxt, { color: COLORS.primary }]}>✅ Strong performance — use as chain benchmark</Text></View>
              )}
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
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 30 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selRow: { flexDirection: 'row', marginBottom: 8, gap: 6 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: COLORS.border, marginRight: 6 },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillTxt: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  pillTxtActive: { color: '#fff' },
  chainCard: { backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, marginBottom: 14, marginTop: 4 },
  chainLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginBottom: 10 },
  chainRow: { flexDirection: 'row', justifyContent: 'space-between' },
  chainStat: { alignItems: 'center', flex: 1 },
  chainVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
  chainStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { color: COLORS.textSecondary, fontSize: 14 },
  card: { borderWidth: 2, borderRadius: 14, padding: 14, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  medal: { fontSize: 26, marginRight: 10 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 13, fontWeight: '900' },
  cardSub: { fontSize: 10, color: COLORS.textSecondary, marginTop: 1 },
  cardRight: { alignItems: 'flex-end' },
  cardRev: { fontSize: 16, fontWeight: '900' },
  cardDiff: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  barBg: { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 4, height: 8, marginBottom: 12 },
  barFill: { height: '100%', borderRadius: 4 },
  metrics: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  metric: { flex: 1, backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: 8, padding: 8, alignItems: 'center' },
  metricVal: { fontSize: 14, fontWeight: '900', color: COLORS.text },
  metricLbl: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2 },
  tip: { backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: 8, padding: 8, marginTop: 4 },
  tipTxt: { fontSize: 11, color: COLORS.text },
  pullHint: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 11, marginTop: 10 },
});
