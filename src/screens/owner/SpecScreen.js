import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { fetchAllSpecOrders } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

function fmt(n){ if(!n) return '0'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }
function today(){ return new Date().toISOString().slice(0,10); }
function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function monthStart(){ const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),1).toISOString().slice(0,10); }

const PERIODS = [
  { label: 'Today', key: 'today' },
  { label: 'Last 7 days', key: '7d' },
  { label: 'This month', key: 'month' },
  { label: 'All time', key: 'all' },
];

export default function OwnerSpecScreen() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [branch, setBranch] = useState('ALL');
  const [period, setPeriod] = useState('month');
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    try {
      const data = await fetchAllSpecOrders();
      setOrders(data || []);
    } catch(e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Filter
  const todayStr = today();
  const fromDate = period === 'today' ? todayStr : period === '7d' ? daysAgo(7) : period === 'month' ? monthStart() : '2000-01-01';

  const filtered = orders.filter(o => {
    const brOk = branch === 'ALL' || o.branch === branch;
    const dtOk = (o.date || '') >= fromDate && (o.date || '') <= todayStr;
    return brOk && dtOk;
  }).sort((a,b) => (b.date||'').localeCompare(a.date||''));

  // Stats
  const totalOrders = filtered.length;
  const branchCount = new Set(filtered.map(o => o.branch)).size;
  let kurczak = 0, baranina = 0, totalQty = 0;
  filtered.forEach(o => {
    (o.items||[]).forEach(it => {
      const qty = parseFloat(it.qty||0);
      totalQty += qty;
      if (/kurczak/i.test(it.name||'')) kurczak += qty;
      else if (/baranina/i.test(it.name||'')) baranina += qty;
    });
  });

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📦 SPEC Orders</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📦 SPEC Orders</Text></View>
      <ScrollView
        style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {/* Branch filter */}
        <Text style={s.filterLabel}>Branch</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterRow}>
          <TouchableOpacity onPress={() => setBranch('ALL')} style={[s.pill, branch==='ALL' && s.pillActive]}>
            <Text style={[s.pillTxt, branch==='ALL' && s.pillTxtActive]}>All</Text>
          </TouchableOpacity>
          {BRANCHES.map(b => (
            <TouchableOpacity key={b.name} onPress={() => setBranch(b.name)} style={[s.pill, branch===b.name && s.pillActive]}>
              <Text style={[s.pillTxt, branch===b.name && s.pillTxtActive]}>{b.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Period filter */}
        <Text style={s.filterLabel}>Period</Text>
        <View style={s.filterRow2}>
          {PERIODS.map(p => (
            <TouchableOpacity key={p.key} onPress={() => setPeriod(p.key)} style={[s.pill, period===p.key && s.pillActive]}>
              <Text style={[s.pillTxt, period===p.key && s.pillTxtActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary card */}
        <View style={s.summaryCard}>
          <Text style={s.summaryLabel}>SPEC SUMMARY</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryStat}>
              <Text style={s.summaryVal}>{totalOrders}</Text>
              <Text style={s.summaryLbl}>Orders</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={s.summaryVal}>{branchCount}</Text>
              <Text style={s.summaryLbl}>Branches</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={s.summaryVal}>{Math.round(kurczak)}</Text>
              <Text style={s.summaryLbl}>🐓 Kurczak</Text>
            </View>
            <View style={s.summaryStat}>
              <Text style={s.summaryVal}>{Math.round(baranina)}</Text>
              <Text style={s.summaryLbl}>🐑 Baranina</Text>
            </View>
          </View>
        </View>

        {/* Orders list */}
        {filtered.length === 0 && (
          <View style={s.empty}><Text style={s.emptyTxt}>No orders found for this filter</Text></View>
        )}

        {filtered.slice(0, 80).map((o, idx) => {
          const id = o.id || idx;
          const isOpen = expanded[id];
          const qty = (o.items||[]).reduce((s,it) => s+parseFloat(it.qty||0), 0);
          const kQty = (o.items||[]).filter(it => /kurczak/i.test(it.name||'')).reduce((s,it) => s+parseFloat(it.qty||0), 0);
          const bQty = (o.items||[]).filter(it => /baranina/i.test(it.name||'')).reduce((s,it) => s+parseFloat(it.qty||0), 0);

          return (
            <TouchableOpacity key={id} style={s.card} onPress={() => setExpanded(e => ({...e, [id]: !e[id]}))}>
              <View style={s.cardHeader}>
                <View style={s.cardInfo}>
                  <Text style={s.cardBranch}>{o.branch || 'Unknown'}</Text>
                  <Text style={s.cardDate}>{o.date} · {Math.round(qty)} units total</Text>
                </View>
                <View style={s.cardRight}>
                  {kQty > 0 && <Text style={s.tag}>🐓 {Math.round(kQty)}</Text>}
                  {bQty > 0 && <Text style={s.tag}>🐑 {Math.round(bQty)}</Text>}
                </View>
                <Text style={s.chevron}>{isOpen ? '▲' : '▼'}</Text>
              </View>

              {isOpen && (
                <View style={s.itemList}>
                  {(o.items||[]).map((it, i) => (
                    <View key={i} style={s.itemRow}>
                      <Text style={s.itemName}>{it.name}</Text>
                      <Text style={s.itemQty}>{it.qty} {it.unit||''}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        <Text style={s.pullHint}>Pull down to refresh · Tap order to expand</Text>
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
  filterLabel: { fontSize:11, fontWeight:'800', color: COLORS.textSecondary, marginBottom:6, letterSpacing:0.5 },
  filterRow: { marginBottom:12 },
  filterRow2: { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:14 },
  pill: { paddingHorizontal:12, paddingVertical:6, borderRadius:20, backgroundColor:'#fff', borderWidth:1, borderColor: COLORS.border, marginRight:6, marginBottom:4 },
  pillActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  pillTxt: { fontSize:12, color: COLORS.textSecondary, fontWeight:'600' },
  pillTxtActive: { color:'#fff' },
  summaryCard: { backgroundColor: COLORS.purple, borderRadius:14, padding:16, marginBottom:14 },
  summaryLabel: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1, marginBottom:10 },
  summaryRow: { flexDirection:'row', justifyContent:'space-between' },
  summaryStat: { alignItems:'center', flex:1 },
  summaryVal: { fontSize:18, fontWeight:'900', color:'#fff' },
  summaryLbl: { fontSize:9, color:'rgba(255,255,255,0.7)', marginTop:2 },
  empty: { padding:40, alignItems:'center' },
  emptyTxt: { color: COLORS.textSecondary, fontSize:14 },
  card: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2, borderLeftWidth:3, borderLeftColor: COLORS.purple },
  cardHeader: { flexDirection:'row', alignItems:'center' },
  cardInfo: { flex:1 },
  cardBranch: { fontSize:13, fontWeight:'800', color: COLORS.text },
  cardDate: { fontSize:11, color: COLORS.textSecondary, marginTop:2 },
  cardRight: { flexDirection:'row', gap:4, marginRight:8 },
  tag: { fontSize:11, backgroundColor: COLORS.purpleLight, color: COLORS.purple, paddingHorizontal:6, paddingVertical:2, borderRadius:6, fontWeight:'700' },
  chevron: { fontSize:12, color: COLORS.textSecondary },
  itemList: { marginTop:12, borderTopWidth:1, borderTopColor: COLORS.border, paddingTop:10 },
  itemRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:5, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  itemName: { fontSize:12, color: COLORS.text, flex:1 },
  itemQty: { fontSize:12, fontWeight:'800', color: COLORS.purple },
  pullHint: { textAlign:'center', color: COLORS.textSecondary, fontSize:11, marginTop:10 },
});
