import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function pad(n){ return String(n).padStart(2,'0'); }
function fmt(n){ if(!n) return '0'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }

export default function OwnerCashflowScreen() {
  const now = new Date();
  const [selM, setSelM] = useState(now.getMonth()+1);
  const [selY, setSelY] = useState(now.getFullYear());
  const [cfReports, setCfReports] = useState([]);
  const [drReports, setDrReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    try {
      const from = selY+'-'+pad(selM)+'-01';
      const to = selY+'-'+pad(selM)+'-31';
      const [cf, dr] = await Promise.all([
        supabase.from('cashflow_reports').select('*').gte('date', from).lte('date', to).order('date', {ascending:false}),
        supabase.from('daily_reports').select('*').gte('date', from).lte('date', to),
      ]);
      setCfReports(cf.data || []);
      setDrReports(dr.data || []);
    } catch(e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [selM, selY]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Aggregate per branch
  const branchStats = BRANCHES.map(b => {
    const bCF = cfReports.filter(r => r.branch === b.name);
    const bDR = drReports.filter(r => r.branch === b.name);
    const revenue = bDR.reduce((s,r) => s+(r.total_revenue||r.revenue||0), 0);
    const totalExp = bCF.reduce((s,r) => s+(r.total_expenses||0), 0);
    const balance = revenue - totalExp;

    // Aggregate expense categories
    const cats = {};
    bCF.forEach(r => {
      const exps = r.expenses ? (typeof r.expenses==='string' ? JSON.parse(r.expenses) : r.expenses) : [];
      exps.forEach(e => {
        const nm = e.name||e.kategoria||'Other';
        cats[nm] = (cats[nm]||0) + parseFloat(e.amount||e.kwota||0);
      });
    });

    return { name: b.name, revenue, totalExp, balance, cats, cfCount: bCF.length, drCount: bDR.length };
  }).filter(b => b.drCount > 0 || b.cfCount > 0).sort((a,b) => b.revenue - a.revenue);

  const chainRevenue = branchStats.reduce((s,b) => s+b.revenue, 0);
  const chainExp = branchStats.reduce((s,b) => s+b.totalExp, 0);
  const chainBalance = chainRevenue - chainExp;

  // All unique expense categories across chain
  const allCats = {};
  branchStats.forEach(b => {
    Object.entries(b.cats).forEach(([k,v]) => { allCats[k] = (allCats[k]||0)+v; });
  });
  const sortedCats = Object.entries(allCats).sort((a,b) => b[1]-a[1]);

  const years = [now.getFullYear(), now.getFullYear()-1];

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>💰 Cash Flow</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>💰 Cash Flow</Text></View>
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

        {/* Chain summary */}
        <View style={s.chainCard}>
          <Text style={s.chainLabel}>CHAIN CASH FLOW — {MONTHS[selM-1].toUpperCase()} {selY}</Text>
          <View style={s.chainRow}>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{fmt(chainRevenue)} PLN</Text>
              <Text style={s.chainStatLbl}>Revenue</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={s.chainVal}>{fmt(chainExp)} PLN</Text>
              <Text style={s.chainStatLbl}>Expenses</Text>
            </View>
            <View style={s.chainStat}>
              <Text style={[s.chainVal, { color: chainBalance >= 0 ? '#A5D6A7' : '#EF9A9A' }]}>
                {chainBalance >= 0 ? '+' : ''}{fmt(chainBalance)}
              </Text>
              <Text style={s.chainStatLbl}>Balance</Text>
            </View>
          </View>
        </View>

        {/* Chain expense breakdown */}
        {sortedCats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Chain Expense Breakdown</Text>
            {sortedCats.map(([cat, val]) => (
              <View key={cat} style={s.catRow}>
                <Text style={s.catName}>{cat}</Text>
                <View style={s.catBarWrap}>
                  <View style={[s.catBar, { width: (val/chainExp*100)+'%' }]} />
                </View>
                <Text style={s.catVal}>{fmt(val)} PLN</Text>
              </View>
            ))}
          </View>
        )}

        {/* Branch cards */}
        <Text style={s.sectionTitle}>Per Branch</Text>
        {branchStats.length === 0 && (
          <View style={s.empty}><Text style={s.emptyTxt}>No data for {MONTHS[selM-1]} {selY}</Text></View>
        )}
        {branchStats.map(b => {
          const isOpen = expanded[b.name];
          const balColor = b.balance >= 0 ? COLORS.primary : COLORS.danger;
          const hasCF = b.cfCount > 0;
          return (
            <TouchableOpacity key={b.name} style={s.card} onPress={() => setExpanded(e => ({...e, [b.name]: !e[b.name]}))}>
              <View style={s.cardHeader}>
                <View style={s.cardInfo}>
                  <Text style={s.cardName}>{b.name}</Text>
                  <Text style={s.cardSub}>{b.drCount} daily reports · {b.cfCount} CF reports</Text>
                </View>
                <View style={s.cardRight}>
                  <Text style={[s.cardBalance, { color: balColor }]}>
                    {b.balance >= 0 ? '+' : ''}{fmt(b.balance)} PLN
                  </Text>
                  <Text style={s.cardSub}>balance</Text>
                </View>
                <Text style={s.chevron}>{isOpen ? '▲' : '▼'}</Text>
              </View>

              <View style={s.cardMetrics}>
                <View style={s.cardMetric}>
                  <Text style={s.metricVal}>{fmt(b.revenue)}</Text>
                  <Text style={s.metricLbl}>Revenue</Text>
                </View>
                <View style={s.cardMetric}>
                  <Text style={s.metricVal}>{fmt(b.totalExp)}</Text>
                  <Text style={s.metricLbl}>Expenses</Text>
                </View>
                <View style={s.cardMetric}>
                  <Text style={s.metricVal}>{b.revenue > 0 ? (b.totalExp/b.revenue*100).toFixed(1)+'%' : '—'}</Text>
                  <Text style={s.metricLbl}>Cost Ratio</Text>
                </View>
              </View>

              {!hasCF && (
                <View style={s.warnBox}>
                  <Text style={s.warnTxt}>⚠️ No Cash Flow reports submitted this month</Text>
                </View>
              )}

              {isOpen && hasCF && Object.keys(b.cats).length > 0 && (
                <View style={s.catList}>
                  <Text style={s.catListTitle}>Expense Categories:</Text>
                  {Object.entries(b.cats).sort((a,b) => b[1]-a[1]).map(([cat, val]) => (
                    <View key={cat} style={s.catListRow}>
                      <Text style={s.catListName}>{cat}</Text>
                      <Text style={s.catListVal}>{fmt(val)} PLN</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={s.pullHint}>Pull down to refresh · Tap card to expand</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor: COLORS.background },
  header: { padding:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor: COLORS.border },
  title: { fontSize:18, fontWeight:'900', color: COLORS.text },
  scroll: { flex:1 },
  content: { padding:14, paddingBottom:30 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  selRow: { flexDirection:'row', marginBottom:8 },
  pill: { paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'#fff', borderWidth:1, borderColor:COLORS.border, marginRight:6 },
  pillActive: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  pillTxt: { fontSize:12, color:COLORS.textSecondary, fontWeight:'600' },
  pillTxtActive: { color:'#fff' },
  chainCard: { backgroundColor:COLORS.primary, borderRadius:14, padding:16, marginBottom:14, marginTop:4 },
  chainLabel: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1, marginBottom:10 },
  chainRow: { flexDirection:'row', justifyContent:'space-between' },
  chainStat: { alignItems:'center', flex:1 },
  chainVal: { fontSize:18, fontWeight:'900', color:'#fff' },
  chainStatLbl: { fontSize:10, color:'rgba(255,255,255,0.7)', marginTop:2 },
  section: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:14 },
  sectionTitle: { fontSize:13, fontWeight:'800', color:COLORS.textSecondary, marginBottom:10, letterSpacing:0.5 },
  catRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  catName: { fontSize:12, color:COLORS.text, width:90 },
  catBarWrap: { flex:1, height:8, backgroundColor:'#F0F0F0', borderRadius:4, marginHorizontal:8 },
  catBar: { height:'100%', backgroundColor:COLORS.primary, borderRadius:4, maxWidth:'100%' },
  catVal: { fontSize:12, fontWeight:'700', color:COLORS.text, width:70, textAlign:'right' },
  empty: { padding:40, alignItems:'center' },
  emptyTxt: { color:COLORS.textSecondary, fontSize:14 },
  card: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardHeader: { flexDirection:'row', alignItems:'center', marginBottom:10 },
  cardInfo: { flex:1 },
  cardName: { fontSize:13, fontWeight:'800', color:COLORS.text },
  cardSub: { fontSize:10, color:COLORS.textSecondary, marginTop:1 },
  cardRight: { alignItems:'flex-end', marginRight:8 },
  cardBalance: { fontSize:15, fontWeight:'900' },
  chevron: { fontSize:12, color:COLORS.textSecondary },
  cardMetrics: { flexDirection:'row', gap:6 },
  cardMetric: { flex:1, backgroundColor:COLORS.background, borderRadius:8, padding:8, alignItems:'center' },
  metricVal: { fontSize:13, fontWeight:'800', color:COLORS.text },
  metricLbl: { fontSize:9, color:COLORS.textSecondary, marginTop:2 },
  warnBox: { backgroundColor:COLORS.warningLight, borderRadius:8, padding:8, marginTop:10 },
  warnTxt: { fontSize:11, color:COLORS.warning },
  catList: { marginTop:10, borderTopWidth:1, borderTopColor:COLORS.border, paddingTop:10 },
  catListTitle: { fontSize:11, fontWeight:'800', color:COLORS.textSecondary, marginBottom:6 },
  catListRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  catListName: { fontSize:12, color:COLORS.text },
  catListVal: { fontSize:12, fontWeight:'700', color:COLORS.text },
  pullHint: { textAlign:'center', color:COLORS.textSecondary, fontSize:11, marginTop:10 },
});
