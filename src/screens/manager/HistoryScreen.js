import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { fetchDailyReports, fetchCashflowReports, fetchSpecOrders } from '../../lib/supabase';
import { COLORS } from '../../constants';

function fmt(n){ if(!n) return '0'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }

const TABS = ['Daily', 'Cash Flow', 'SPEC'];

export default function ManagerHistoryScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState('Daily');
  const [daily, setDaily] = useState([]);
  const [cf, setCf] = useState([]);
  const [spec, setSpec] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});

  const load = useCallback(async () => {
    try {
      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth()-2, 1).toISOString().slice(0,10);
      const to = now.toISOString().slice(0,10);
      const [d, c, s] = await Promise.all([
        fetchDailyReports(user.branch, from, to),
        fetchCashflowReports(user.branch, from, to),
        fetchSpecOrders(user.branch),
      ]);
      setDaily(d || []);
      setCf(c || []);
      setSpec((s || []).slice(0, 50));
    } catch(e) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user.branch]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>🗂️ History</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🗂️ History</Text>
        <Text style={s.headerSub}>{user.branch}</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, tab===t && s.tabBtnActive]}>
            <Text style={[s.tabTxt, tab===t && s.tabTxtActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
      >
        {/* Daily Reports */}
        {tab === 'Daily' && (
          daily.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No daily reports found</Text></View>
            : daily.map(r => (
              <TouchableOpacity key={r.id} style={s.card} onPress={() => setExpanded(e => ({...e, [r.id]: !e[r.id]}))}>
                <View style={s.cardHeader}>
                  <View style={s.cardInfo}>
                    <Text style={s.cardDate}>{r.date}</Text>
                    <Text style={s.cardSub}>{r.reports} report</Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={s.cardRev}>{fmt(r.total_revenue||r.revenue)} PLN</Text>
                    <Text style={[s.cardProfit, {color: (r.net_profit||0)>=0?COLORS.primary:COLORS.danger}]}>
                      {(r.net_profit||0)>=0?'+':''}{fmt(r.net_profit)} profit
                    </Text>
                  </View>
                  <Text style={s.chevron}>{expanded[r.id]?'▲':'▼'}</Text>
                </View>
                {expanded[r.id] && (
                  <View style={s.detail}>
                    <View style={s.detailRow}><Text style={s.detailLbl}>Card</Text><Text style={s.detailVal}>{fmt(r.card||r.karta)} PLN</Text></View>
                    <View style={s.detailRow}><Text style={s.detailLbl}>Cash</Text><Text style={s.detailVal}>{fmt(r.cash||r.gotowka)} PLN</Text></View>
                    <View style={s.detailRow}><Text style={s.detailLbl}>Delivery</Text><Text style={s.detailVal}>{fmt(r.total_delivery)} PLN</Text></View>
                    <View style={s.detailRow}><Text style={s.detailLbl}>Expenses</Text><Text style={s.detailVal}>{fmt(r.total_expenses)} PLN</Text></View>
                    {r.notes ? <Text style={s.notes}>📝 {r.notes}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            ))
        )}

        {/* Cash Flow */}
        {tab === 'Cash Flow' && (
          cf.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No cash flow reports found</Text></View>
            : cf.map(r => (
              <TouchableOpacity key={r.id} style={s.card} onPress={() => setExpanded(e => ({...e, ['cf'+r.id]: !e['cf'+r.id]}))}>
                <View style={s.cardHeader}>
                  <View style={s.cardInfo}>
                    <Text style={s.cardDate}>{r.date}</Text>
                    <Text style={s.cardSub}>{(r.expenses||[]).length} categories</Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={[s.cardRev, {color:COLORS.danger}]}>{fmt(r.total_expenses)} PLN</Text>
                    <Text style={s.cardSub}>expenses</Text>
                  </View>
                  <Text style={s.chevron}>{expanded['cf'+r.id]?'▲':'▼'}</Text>
                </View>
                {expanded['cf'+r.id] && (
                  <View style={s.detail}>
                    {(r.expenses||[]).map((e,i) => (
                      <View key={i} style={s.detailRow}>
                        <Text style={s.detailLbl}>{e.name||e.kategoria}</Text>
                        <Text style={s.detailVal}>{fmt(e.amount||e.kwota)} PLN</Text>
                      </View>
                    ))}
                    {r.notes ? <Text style={s.notes}>📝 {r.notes}</Text> : null}
                  </View>
                )}
              </TouchableOpacity>
            ))
        )}

        {/* SPEC Orders */}
        {tab === 'SPEC' && (
          spec.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No SPEC orders found</Text></View>
            : spec.map((o, idx) => (
              <TouchableOpacity key={o.id||idx} style={[s.card, {borderLeftColor:COLORS.purple}]} onPress={() => setExpanded(e => ({...e, ['sp'+(o.id||idx)]: !e['sp'+(o.id||idx)]}))}>
                <View style={s.cardHeader}>
                  <View style={s.cardInfo}>
                    <Text style={s.cardDate}>{o.date}</Text>
                    <Text style={s.cardSub}>{(o.items||[]).length} items</Text>
                  </View>
                  <View style={s.cardRight}>
                    <Text style={[s.cardRev, {color:COLORS.purple}]}>
                      {Math.round((o.items||[]).reduce((s,it)=>s+parseFloat(it.qty||0),0))} units
                    </Text>
                  </View>
                  <Text style={s.chevron}>{expanded['sp'+(o.id||idx)]?'▲':'▼'}</Text>
                </View>
                {expanded['sp'+(o.id||idx)] && (
                  <View style={s.detail}>
                    {(o.items||[]).map((it,i) => (
                      <View key={i} style={s.detailRow}>
                        <Text style={s.detailLbl}>{it.name}</Text>
                        <Text style={[s.detailVal, {color:COLORS.purple}]}>{it.qty} {it.unit||'kg'}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            ))
        )}

        <Text style={s.pullHint}>Pull down to refresh · Tap to expand</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor:COLORS.background },
  header: { padding:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:COLORS.border },
  title: { fontSize:18, fontWeight:'900', color:COLORS.text },
  headerSub: { fontSize:12, color:COLORS.textSecondary, marginTop:2 },
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  tabs: { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:COLORS.border },
  tabBtn: { flex:1, padding:12, alignItems:'center', borderBottomWidth:3, borderBottomColor:'transparent' },
  tabBtnActive: { borderBottomColor:COLORS.primary },
  tabTxt: { fontSize:13, fontWeight:'700', color:COLORS.textSecondary },
  tabTxtActive: { color:COLORS.primary },
  scroll: { flex:1 },
  content: { padding:14, paddingBottom:30 },
  empty: { padding:40, alignItems:'center' },
  emptyTxt: { color:COLORS.textSecondary, fontSize:14 },
  card: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:10, borderLeftWidth:3, borderLeftColor:COLORS.primary, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardHeader: { flexDirection:'row', alignItems:'center' },
  cardInfo: { flex:1 },
  cardDate: { fontSize:14, fontWeight:'800', color:COLORS.text },
  cardSub: { fontSize:11, color:COLORS.textSecondary, marginTop:2 },
  cardRight: { alignItems:'flex-end', marginRight:8 },
  cardRev: { fontSize:15, fontWeight:'900', color:COLORS.text },
  cardProfit: { fontSize:11, fontWeight:'700', marginTop:1 },
  chevron: { fontSize:12, color:COLORS.textSecondary },
  detail: { marginTop:12, borderTopWidth:1, borderTopColor:COLORS.border, paddingTop:10 },
  detailRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  detailLbl: { fontSize:12, color:COLORS.textSecondary },
  detailVal: { fontSize:12, fontWeight:'700', color:COLORS.text },
  notes: { fontSize:12, color:COLORS.textSecondary, marginTop:8, fontStyle:'italic' },
  pullHint: { textAlign:'center', color:COLORS.textSecondary, fontSize:11, marginTop:10 },
});
