import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const LABOR_RATE = 22; // PLN per hour estimate

function pad(n) { return String(n).padStart(2,'0'); }
function fmtK(n) { if (!n&&n!==0) return '0'; if (Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }
function fmtPLN(n) { if (!n&&n!==0) return 'PLN 0,00'; return 'PLN '+n.toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(n) { return n.toFixed(1)+'%'; }

function monthRange(y, m) {
  const lastDay = new Date(y, m, 0).getDate();
  return { from:`${y}-${pad(m)}-01`, to:`${y}-${pad(m)}-${pad(lastDay)}` };
}
function lastMonthRange(y, m) {
  const lm = m===1?12:m-1; const ly = m===1?y-1:y;
  const lastDay = new Date(ly, lm, 0).getDate();
  return { from:`${ly}-${pad(lm)}-01`, to:`${ly}-${pad(lm)}-${pad(lastDay)}` };
}

function extractExpenses(r) {
  const cats = {};
  const fields = ['warzywa','cola_pepsi','cola','pepsi','gaz','c2c','spec','wynajem','pracownicy','inne','other'];
  fields.forEach(f => { if (r[f] && Number(r[f])>0) cats[f] = (cats[f]||0)+Number(r[f]); });
  if (r.expenses && typeof r.expenses === 'object') {
    Object.entries(r.expenses).forEach(([k,v]) => { cats[k]=(cats[k]||0)+Number(v); });
  }
  if (r.wydatki) {
    let w = r.wydatki;
    if (typeof w==='string') { try { w=JSON.parse(w); } catch{} }
    if (Array.isArray(w)) w.forEach(e => { const k=(e.name||e.kategoria||'inne').toLowerCase(); cats[k]=(cats[k]||0)+Number(e.amount||e.kwota||0); });
  }
  return cats;
}

export default function OwnerCashflowScreen() {
  const now = new Date();
  const [selM, setSelM] = useState(now.getMonth()+1);
  const [selY, setSelY] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cfReports, setCfReports] = useState([]);
  const [drReports, setDrReports] = useState([]);
  const [specOrders, setSpecOrders] = useState([]);
  const [lastDR, setLastDR] = useState([]);
  const [trendDR, setTrendDR] = useState([]);
  const [expandedBranch, setExpandedBranch] = useState(null);
  const [showTimeline, setShowTimeline] = useState(false);

  const load = useCallback(async () => {
    try {
      const { from, to } = monthRange(selY, selM);
      const lm = lastMonthRange(selY, selM);
      const wkAgo = new Date(); wkAgo.setDate(wkAgo.getDate()-6);
      const wkFrom = wkAgo.toISOString().slice(0,10);
      const today = new Date().toISOString().slice(0,10);
      const [cfRes, drData, spRes, lmDR, trendData] = await Promise.all([
        supabase.from('cashflow_reports').select('*').gte('date',from).lte('date',to).order('date',{ascending:false}),
        fetchAllDailyReports(from, to),
        supabase.from('spec_orders').select('*').gte('date',from).lte('date',to),
        fetchAllDailyReports(lm.from, lm.to),
        fetchAllDailyReports(wkFrom, today),
      ]);
      setCfReports(cfRes.data||[]);
      setDrReports(drData||[]);
      setSpecOrders(spRes.data||[]);
      setLastDR(lmDR||[]);
      setTrendDR(trendData||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selM, selY]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Chain totals
  const chainRevenue = drReports.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
  const chainCF = cfReports.reduce((s,r)=>s+(r.total_expenses||r.total||0),0);
  const chainSpec = specOrders.reduce((s,o)=>s+(o.total_cost||o.total||0),0);
  const chainHours = drReports.reduce((s,r)=>s+(r.hours||0),0);
  const chainLabor = chainHours * LABOR_RATE;
  const chainProfit = chainRevenue - chainCF - chainSpec;
  const chainMargin = chainRevenue>0 ? chainProfit/chainRevenue*100 : 0;
  const daysInMonth = new Date(selY,selM,0).getDate();
  const daysElapsed = now.getMonth()+1===selM&&now.getFullYear()===selY ? now.getDate() : daysInMonth;
  const avgPerDay = daysElapsed>0 ? chainRevenue/daysElapsed : 0;
  const activeBranches = new Set(drReports.map(r=>r.branch)).size || 1;
  const avgPerBranch = chainRevenue/activeBranches;

  // Last month comparison
  const lastRevenue = lastDR.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
  const revGrowth = lastRevenue>0 ? (chainRevenue-lastRevenue)/lastRevenue*100 : null;

  // Expense category breakdown across all CF reports
  const expBreakdown = {};
  cfReports.forEach(r => {
    const cats = extractExpenses(r);
    Object.entries(cats).forEach(([k,v])=>{ expBreakdown[k]=(expBreakdown[k]||0)+v; });
    // also direct fields
    ['warzywa','cola_pepsi','gaz','c2c','spec','wynajem','pracownicy','inne'].forEach(f=>{
      if (r[f]&&Number(r[f])>0) expBreakdown[f]=(expBreakdown[f]||0)+Number(r[f]);
    });
  });
  const expEntries = Object.entries(expBreakdown).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
  const maxExp = expEntries[0]?.[1]||1;

  // Per-branch aggregation
  const branchFinance = BRANCHES.map(b => {
    const bDR = drReports.filter(r=>r.branch===b.name);
    const bCF = cfReports.filter(r=>r.branch===b.name);
    const bSpec = specOrders.filter(r=>r.branch===b.name);
    const revenue = bDR.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
    const cfExp = bCF.reduce((s,r)=>s+(r.total_expenses||r.total||0),0);
    const specCost = bSpec.reduce((s,o)=>s+(o.total_cost||o.total||0),0);
    const hours = bDR.reduce((s,r)=>s+(r.hours||0),0);
    const laborEst = hours * LABOR_RATE;
    const estProfit = revenue - cfExp - specCost;
    const margin = revenue>0 ? estProfit/revenue*100 : 0;
    const reportCount = bDR.length;
    const bExpBreak = {};
    bCF.forEach(r=>{
      ['warzywa','cola_pepsi','gaz','c2c','spec','wynajem','pracownicy','inne'].forEach(f=>{
        if (r[f]&&Number(r[f])>0) bExpBreak[f]=(bExpBreak[f]||0)+Number(r[f]);
      });
    });
    return { name:b.name, revenue, cfExp, specCost, laborEst, hours, estProfit, margin, reportCount, bExpBreak };
  }).filter(b=>b.revenue>0||b.cfExp>0).sort((a,b)=>b.revenue-a.revenue);

  // Alerts
  const alerts = [];
  branchFinance.forEach(b=>{
    if (b.estProfit<0&&b.revenue>0) alerts.push({kind:'error',msg:`${b.name}: estimated loss of ${fmtK(Math.abs(b.estProfit))} PLN`});
    if (b.cfExp>0&&b.revenue>0&&b.cfExp/b.revenue>0.5) alerts.push({kind:'warn',msg:`${b.name}: CF expenses ${fmtPct(b.cfExp/b.revenue*100)} of revenue`});
  });
  if (expBreakdown.inne>0&&chainCF>0&&expBreakdown.inne/chainCF>0.25) alerts.push({kind:'warn',msg:`High "Other" expenses: ${fmtPct(expBreakdown.inne/chainCF*100)} of total — review descriptions`});
  const negBranches = branchFinance.filter(b=>b.estProfit<0);
  if (negBranches.length>0&&alerts.length===0) alerts.push({kind:'error',msg:`${negBranches.length} branch${negBranches.length>1?'es':''} with negative estimated profit`});

  // 7-day trend
  const last7 = Array.from({length:7},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()-(6-i)); return d.toISOString().slice(0,10); });
  const trendByDay = last7.map(date=>({
    date,
    rev: trendDR.filter(r=>r.date===date).reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0),
  }));
  const maxTrend = Math.max(...trendByDay.map(d=>d.rev),1);
  const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  // Day-by-day timeline
  const allDates = [...new Set([...drReports.map(r=>r.date),...cfReports.map(r=>r.date)])].sort((a,b)=>b.localeCompare(a));

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} colors={[COLORS.primary]}/>}
      >
        <Text style={s.pageTitle}>Finances</Text>

        {/* Month selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          {MONTHS.map((m,i)=>(
            <TouchableOpacity key={m} onPress={()=>setSelM(i+1)} style={[s.pill,selM===i+1&&s.pillOn]}>
              <Text style={[s.pillTxt,selM===i+1&&s.pillTxtOn]}>{m.slice(0,3)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
          {[now.getFullYear(),now.getFullYear()-1].map(y=>(
            <TouchableOpacity key={y} onPress={()=>setSelY(y)} style={[s.pill,selY===y&&s.pillOn]}>
              <Text style={[s.pillTxt,selY===y&&s.pillTxtOn]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. FINANCIAL SUMMARY */}
        <Text style={s.secTitle}>💵 Financial Summary</Text>
        <View style={s.summaryGrid}>
          <View style={[s.sumCard,{backgroundColor:'#E8F5E9'}]}>
            <Text style={s.sumLbl}>REVENUE</Text>
            <Text style={[s.sumVal,{color:COLORS.primary}]}>{fmtK(chainRevenue)} PLN</Text>
            {revGrowth!==null&&<Text style={[s.sumSub,{color:revGrowth>=0?COLORS.primary:COLORS.danger}]}>{revGrowth>=0?'↑':'↓'}{Math.abs(revGrowth).toFixed(0)}% vs last month</Text>}
          </View>
          <View style={[s.sumCard,{backgroundColor:'#FFEBEE'}]}>
            <Text style={s.sumLbl}>CF EXPENSES</Text>
            <Text style={[s.sumVal,{color:COLORS.danger}]}>{fmtK(chainCF)} PLN</Text>
            <Text style={s.sumSub}>{chainRevenue>0?fmtPct(chainCF/chainRevenue*100)+' of rev':'—'}</Text>
          </View>
          <View style={[s.sumCard,{backgroundColor:'#F3E5F5'}]}>
            <Text style={s.sumLbl}>SPEC COST</Text>
            <Text style={[s.sumVal,{color:'#6A1B9A'}]}>{fmtK(chainSpec)} PLN</Text>
            <Text style={s.sumSub}>{chainRevenue>0?fmtPct(chainSpec/chainRevenue*100)+' food cost':'—'}</Text>
          </View>
          <View style={[s.sumCard,{backgroundColor:chainProfit>=0?'#E8F5E9':'#FFEBEE'}]}>
            <Text style={s.sumLbl}>EST. PROFIT</Text>
            <Text style={[s.sumVal,{color:chainProfit>=0?COLORS.primary:COLORS.danger}]}>{chainProfit>=0?'+':''}{fmtK(chainProfit)} PLN</Text>
            <Text style={s.sumSub}>Margin: {chainRevenue>0?fmtPct(chainMargin):'—'}</Text>
          </View>
          <View style={[s.sumCard,{backgroundColor:'#E3F2FD'}]}>
            <Text style={s.sumLbl}>AVG / DAY</Text>
            <Text style={[s.sumVal,{color:'#1565C0'}]}>{fmtK(avgPerDay)} PLN</Text>
            <Text style={s.sumSub}>{daysElapsed} days recorded</Text>
          </View>
          <View style={[s.sumCard,{backgroundColor:'#FFF8E1'}]}>
            <Text style={s.sumLbl}>AVG / BRANCH</Text>
            <Text style={[s.sumVal,{color:'#F57F17'}]}>{fmtK(avgPerBranch)} PLN</Text>
            <Text style={s.sumSub}>{activeBranches} active branches</Text>
          </View>
        </View>

        {/* 2. ALERTS */}
        {alerts.length>0&&(
          <>
            <Text style={s.secTitle}>🚨 Financial Alerts</Text>
            {alerts.map((a,i)=>(
              <View key={i} style={[s.alertCard,a.kind==='error'?s.alertError:s.alertWarn]}>
                <Text style={s.alertIcon}>{a.kind==='error'?'🔴':'⚠️'}</Text>
                <Text style={[s.alertTxt,{color:a.kind==='error'?'#B71C1C':'#E65100'}]} numberOfLines={2}>{a.msg}</Text>
              </View>
            ))}
          </>
        )}

        {/* 3. REVENUE vs SPEC vs LABOR TABLE */}
        <Text style={s.secTitle}>📊 Revenue → SPEC → Labor → Profit</Text>
        <View style={s.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow,s.tableHead]}>
                {['Branch','Revenue','SPEC','Labor*','CF Exp','Profit','Margin'].map(h=>(
                  <Text key={h} style={[s.tc,s.theadTxt]}>{h}</Text>
                ))}
              </View>
              {branchFinance.map((b,i)=>{
                const marginFlag = b.margin>=20?'✅':b.margin>=5?'⚠️':b.estProfit<0?'🔴':'—';
                return (
                  <View key={b.name} style={[s.tableRow,i%2===0&&{backgroundColor:'#FAFAFA'}]}>
                    <Text style={[s.tc,{fontWeight:'700',fontSize:11}]} numberOfLines={1}>{b.name.split(' ')[0]}</Text>
                    <Text style={s.tc}>{fmtK(b.revenue)}</Text>
                    <Text style={[s.tc,{color:'#6A1B9A'}]}>{fmtK(b.specCost)}</Text>
                    <Text style={[s.tc,{color:'#F57F17'}]}>{b.hours>0?fmtK(b.laborEst):'—'}</Text>
                    <Text style={[s.tc,{color:COLORS.danger}]}>{fmtK(b.cfExp)}</Text>
                    <Text style={[s.tc,{color:b.estProfit>=0?COLORS.primary:COLORS.danger,fontWeight:'700'}]}>{b.estProfit>=0?'+':''}{fmtK(b.estProfit)}</Text>
                    <Text style={s.tc}>{marginFlag} {b.revenue>0?fmtPct(b.margin):''}</Text>
                  </View>
                );
              })}
              {branchFinance.length===0&&<View style={{padding:16}}><Text style={{color:'#aaa',fontSize:13}}>No data for {MONTHS[selM-1]} {selY}</Text></View>}
            </View>
          </ScrollView>
          <Text style={{fontSize:10,color:'#bbb',marginTop:8}}>* Labor estimated at {LABOR_RATE} PLN/hr</Text>
        </View>

        {/* 4. BRANCH FINANCIAL CARDS */}
        <Text style={s.secTitle}>🏪 Branch Breakdown</Text>
        {branchFinance.map(b=>{
          const isExp = expandedBranch===b.name;
          const marginColor = b.margin>=20?COLORS.primary:b.margin>=5?COLORS.warning:COLORS.danger;
          return (
            <View key={b.name} style={s.branchCard}>
              <TouchableOpacity onPress={()=>setExpandedBranch(p=>p===b.name?null:b.name)} activeOpacity={0.8}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:6}}>
                  <View style={[s.marginDot,{backgroundColor:marginColor}]}/>
                  <Text style={s.branchName}>{b.name}</Text>
                  <Text style={[s.marginPct,{color:marginColor}]}>{b.revenue>0?fmtPct(b.margin)+' margin':'—'}</Text>
                  <Text style={s.chevron}>{isExp?'▲':'▼'}</Text>
                </View>
                <View style={s.branchQuick}>
                  <View style={s.bq}><Text style={[s.bqVal,{color:COLORS.primary}]}>{fmtK(b.revenue)}</Text><Text style={s.bqLbl}>Revenue</Text></View>
                  <View style={s.bq}><Text style={[s.bqVal,{color:COLORS.danger}]}>{fmtK(b.cfExp)}</Text><Text style={s.bqLbl}>CF Exp</Text></View>
                  <View style={s.bq}><Text style={[s.bqVal,{color:'#6A1B9A'}]}>{fmtK(b.specCost)}</Text><Text style={s.bqLbl}>SPEC</Text></View>
                  <View style={s.bq}><Text style={[s.bqVal,{color:b.estProfit>=0?COLORS.primary:COLORS.danger}]}>{b.estProfit>=0?'+':''}{fmtK(b.estProfit)}</Text><Text style={s.bqLbl}>Est. Profit</Text></View>
                </View>
              </TouchableOpacity>

              {isExp&&(
                <View style={s.expandedDetail}>
                  {/* Profit waterfall */}
                  <Text style={s.detailSec}>💵 Profit Calculation</Text>
                  <View style={[s.profitBox,{borderColor:b.estProfit>=0?COLORS.primary:COLORS.danger}]}>
                    <View style={s.pRow}><Text style={s.pLbl}>Revenue</Text><Text style={s.pVal}>+{fmtPLN(b.revenue)}</Text></View>
                    <View style={s.pRow}><Text style={s.pLbl}>CF Expenses</Text><Text style={[s.pVal,{color:COLORS.danger}]}>-{fmtPLN(b.cfExp)}</Text></View>
                    <View style={s.pRow}><Text style={s.pLbl}>SPEC Cost</Text><Text style={[s.pVal,{color:'#6A1B9A'}]}>-{fmtPLN(b.specCost)}</Text></View>
                    {b.hours>0&&<View style={s.pRow}><Text style={s.pLbl}>Labor Est. ({b.hours}h)</Text><Text style={[s.pVal,{color:'#F57F17'}]}>~-{fmtPLN(b.laborEst)}</Text></View>}
                    <View style={[s.pRow,{borderTopWidth:1,borderTopColor:'#eee',marginTop:6,paddingTop:8}]}>
                      <Text style={[s.pLbl,{fontWeight:'800'}]}>Est. Profit</Text>
                      <Text style={[s.pVal,{fontSize:16,fontWeight:'900',color:b.estProfit>=0?COLORS.primary:COLORS.danger}]}>{b.estProfit>=0?'+':''}{fmtPLN(b.estProfit)}</Text>
                    </View>
                  </View>

                  {/* Labor */}
                  <Text style={s.detailSec}>👨‍🍳 Labor</Text>
                  <View style={{flexDirection:'row',gap:10}}>
                    <View style={s.labBox}><Text style={s.labVal}>{b.hours}h</Text><Text style={s.labLbl}>Total Hours</Text></View>
                    <View style={s.labBox}><Text style={[s.labVal,{color:'#F57F17'}]}>~{fmtK(b.laborEst)} PLN</Text><Text style={s.labLbl}>Labor Est.</Text></View>
                    <View style={s.labBox}><Text style={s.labVal}>{b.hours>0&&b.revenue>0?Math.round(b.revenue/b.hours)+' PLN':'—'}</Text><Text style={s.labLbl}>PLN/hr</Text></View>
                  </View>

                  {/* Expense breakdown */}
                  {Object.keys(b.bExpBreak).length>0&&(
                    <>
                      <Text style={s.detailSec}>📋 Expense Breakdown</Text>
                      {Object.entries(b.bExpBreak).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>(
                        <View key={cat} style={s.expRow}>
                          <Text style={s.expCat}>{cat}</Text>
                          <View style={s.expBarBg}><View style={[s.expBarFill,{width:b.cfExp>0?(val/b.cfExp*100)+'%':'0%'}]}/></View>
                          <Text style={s.expAmt}>{fmtK(val)} PLN</Text>
                          <Text style={s.expPct}>{b.cfExp>0?fmtPct(val/b.cfExp*100):'—'}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {/* 5. CHAIN EXPENSE BREAKDOWN */}
        {expEntries.length>0&&(
          <>
            <Text style={s.secTitle}>📦 Chain Expense Breakdown</Text>
            <View style={s.card}>
              {expEntries.slice(0,8).map(([cat,val])=>(
                <View key={cat} style={s.expRow}>
                  <Text style={[s.expCat,{width:90}]}>{cat}</Text>
                  <View style={s.expBarBg}><View style={[s.expBarFill,{width:(val/maxExp*100)+'%',backgroundColor:'#EF9A9A'}]}/></View>
                  <Text style={s.expAmt}>{fmtK(val)}</Text>
                  <Text style={s.expPct}>{chainCF>0?fmtPct(val/chainCF*100):'—'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* 6. 7-DAY REVENUE TREND */}
        <Text style={s.secTitle}>📈 7-Day Revenue Trend</Text>
        <View style={s.card}>
          <View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',height:100}}>
            {trendByDay.map(d=>{
              const h = Math.max(4, d.rev/maxTrend*80);
              const isToday = d.date===new Date().toISOString().slice(0,10);
              const dow = new Date(d.date+'T12:00:00').getDay();
              return (
                <View key={d.date} style={{flex:1,alignItems:'center',justifyContent:'flex-end'}}>
                  <Text style={{fontSize:8,color:'#aaa',marginBottom:2}}>{d.rev>0?fmtK(d.rev):''}</Text>
                  <View style={{width:'70%',height:h,backgroundColor:isToday?COLORS.primary:'#A5D6A7',borderRadius:3}}/>
                  <Text style={{fontSize:9,color:isToday?COLORS.primary:'#aaa',marginTop:3,fontWeight:isToday?'700':'400'}}>{dayLabels[dow]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* 7. DAY-BY-DAY TIMELINE */}
        <TouchableOpacity style={s.timelineToggle} onPress={()=>setShowTimeline(p=>!p)}>
          <Text style={s.timelineTxt}>📅 {showTimeline?'Hide':'Show'} Day-by-Day Timeline ({allDates.length} days)</Text>
        </TouchableOpacity>
        {showTimeline&&allDates.slice(0,30).map(date=>{
          const dayDR = drReports.filter(r=>r.date===date);
          const dayCF = cfReports.filter(r=>r.date===date);
          const dayRev = dayDR.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
          const dayCFExp = dayCF.reduce((s,r)=>s+(r.total_expenses||r.total||0),0);
          return (
            <View key={date} style={s.dayCard}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <Text style={s.dayDate}>{date}</Text>
                <View style={{flexDirection:'row',gap:12}}>
                  {dayRev>0&&<Text style={[s.dayAmt,{color:COLORS.primary}]}>+{fmtK(dayRev)} PLN</Text>}
                  {dayCFExp>0&&<Text style={[s.dayAmt,{color:COLORS.danger}]}>-{fmtK(dayCFExp)} PLN</Text>}
                </View>
              </View>
              <Text style={s.daySub}>{dayDR.length} daily · {dayCF.length} CF · {dayDR.map(r=>r.branch.split(' ')[0]).join(', ')}</Text>
            </View>
          );
        })}

        {/* 8. EXPORT */}
        <Text style={s.secTitle}>📤 Export</Text>
        <View style={s.card}>
          <Text style={{fontSize:13,color:'#888',marginBottom:12}}>Export financial reports for {MONTHS[selM-1]} {selY}</Text>
          <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
            {['📊 Monthly Report','📋 Branch Summary','📦 Expense Sheet','🧾 Accountant Export'].map(lbl=>(
              <TouchableOpacity key={lbl} style={s.expBtn} onPress={()=>Alert.alert('Coming Soon','Export will be available in the next update.')}>
                <Text style={s.expBtnTxt}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const dayLabels = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  content:{padding:16,paddingBottom:50},
  pageTitle:{fontSize:28,fontWeight:'800',color:'#111',marginBottom:12},
  pill:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#ddd',marginRight:6},
  pillOn:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},
  pillTxt:{fontSize:12,fontWeight:'600',color:'#777'},
  pillTxtOn:{color:'#fff'},
  secTitle:{fontSize:15,fontWeight:'800',color:'#333',marginTop:20,marginBottom:10},
  summaryGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:4},
  sumCard:{width:'47%',flex:1,borderRadius:14,padding:14,minWidth:'47%'},
  sumLbl:{fontSize:11,fontWeight:'700',color:'#666',letterSpacing:0.5,marginBottom:4},
  sumVal:{fontSize:20,fontWeight:'900',color:'#111'},
  sumSub:{fontSize:11,color:'#888',marginTop:3},
  alertCard:{flexDirection:'row',alignItems:'flex-start',borderRadius:10,padding:12,marginBottom:6,gap:8},
  alertError:{backgroundColor:'#FFEBEE'},
  alertWarn:{backgroundColor:'#FFF8E1'},
  alertIcon:{fontSize:15,marginTop:1},
  alertTxt:{flex:1,fontSize:13,lineHeight:19,fontWeight:'500'},
  card:{backgroundColor:'#fff',borderRadius:14,padding:14,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:2,marginBottom:4},
  tableRow:{flexDirection:'row',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  tableHead:{borderBottomWidth:2,borderBottomColor:'#eee'},
  tc:{width:72,fontSize:11,color:'#333',paddingHorizontal:3},
  theadTxt:{fontWeight:'800',color:'#666',fontSize:10},
  branchCard:{backgroundColor:'#fff',borderRadius:14,padding:14,marginBottom:8,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:3,elevation:2},
  marginDot:{width:10,height:10,borderRadius:5,marginRight:8},
  branchName:{flex:1,fontSize:14,fontWeight:'700',color:'#111'},
  marginPct:{fontSize:12,fontWeight:'700',marginRight:6},
  chevron:{fontSize:12,color:'#aaa'},
  branchQuick:{flexDirection:'row',paddingTop:10,borderTopWidth:1,borderTopColor:'#f5f5f5'},
  bq:{flex:1,alignItems:'center'},
  bqVal:{fontSize:14,fontWeight:'800'},
  bqLbl:{fontSize:10,color:'#aaa',marginTop:2},
  expandedDetail:{marginTop:14,paddingTop:14,borderTopWidth:1,borderTopColor:'#f0f0f0'},
  detailSec:{fontSize:12,fontWeight:'800',color:'#555',marginTop:10,marginBottom:8},
  profitBox:{borderWidth:1.5,borderRadius:12,padding:12},
  pRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:5},
  pLbl:{fontSize:13,color:'#555'},
  pVal:{fontSize:13,fontWeight:'700',color:'#111'},
  labBox:{flex:1,backgroundColor:'#FFF8E1',borderRadius:10,padding:10,alignItems:'center'},
  labVal:{fontSize:14,fontWeight:'800',color:'#111'},
  labLbl:{fontSize:10,color:'#aaa',marginTop:2},
  expRow:{flexDirection:'row',alignItems:'center',paddingVertical:6,gap:8},
  expCat:{fontSize:12,color:'#555',width:80,fontWeight:'500'},
  expBarBg:{flex:1,height:6,backgroundColor:'#eee',borderRadius:3},
  expBarFill:{height:'100%',backgroundColor:'#EF9A9A',borderRadius:3},
  expAmt:{fontSize:12,fontWeight:'700',color:'#333',width:52,textAlign:'right'},
  expPct:{fontSize:11,color:'#aaa',width:38,textAlign:'right'},
  timelineToggle:{backgroundColor:'#fff',borderRadius:12,padding:14,alignItems:'center',marginTop:16,marginBottom:4,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:3,elevation:2},
  timelineTxt:{fontSize:14,fontWeight:'700',color:COLORS.primary},
  dayCard:{backgroundColor:'#fff',borderRadius:10,padding:12,marginBottom:6,shadowColor:'#000',shadowOpacity:0.03,shadowRadius:2,elevation:1},
  dayDate:{fontSize:13,fontWeight:'700',color:'#333'},
  dayAmt:{fontSize:13,fontWeight:'800'},
  daySub:{fontSize:11,color:'#aaa',marginTop:3},
  expBtn:{backgroundColor:'#E8F5E9',borderRadius:10,paddingHorizontal:12,paddingVertical:9},
  expBtnTxt:{fontSize:12,fontWeight:'700',color:COLORS.primary},
});
