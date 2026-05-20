import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function pad(n) { return String(n).padStart(2,'0'); }
function fmtK(n) { if (!n&&n!==0) return '0'; if (Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }
function fmtPct(n) { return n.toFixed(1)+'%'; }

// Safe month range — avoids invalid dates like Apr-31
function monthRange(y, m) {
  const lastDay = new Date(y, m, 0).getDate(); // last day of month m
  return { from:`${y}-${pad(m)}-01`, to:`${y}-${pad(m)}-${pad(lastDay)}` };
}
function lastMonthRange(y, m) {
  const lm = m===1 ? 12 : m-1;
  const ly = m===1 ? y-1 : y;
  const lastDay = new Date(ly, lm, 0).getDate();
  return { from:`${ly}-${pad(lm)}-01`, to:`${ly}-${pad(lm)}-${pad(lastDay)}` };
}

function extractItems(items) {
  if (!items) return {};
  let obj = items;
  if (typeof items === 'string') { try { obj = JSON.parse(items); } catch { return {}; } }
  if (Array.isArray(obj)) return obj.reduce((acc,i) => { const k=i.name||i.productName||i.product||'Item'; acc[k]=(acc[k]||0)+Number(i.qty??i.quantity??i.amount??0); return acc; }, {});
  if (typeof obj === 'object') return {...obj};
  return {};
}

function parseWorkersHours(raw) {
  if (!raw) return [];
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr.map(w => ({ name: w.name || 'Worker', hours: Number(w.hours) || 0 })).filter(w => w.hours > 0);
  } catch { return []; }
}

function buildAIAnalysis(sorted, daysElapsed, avgRev, avgRPH) {
  if (sorted.length === 0) return null;
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  const reasons = sorted.map((b, idx) => {
    const pts = [];
    if (b.revenue >= avgRev * 1.2) pts.push(`revenue ${Math.round((b.revenue/avgRev-1)*100)}% above chain avg`);
    else if (b.revenue >= avgRev * 0.9) pts.push(`revenue near chain avg`);
    else pts.push(`revenue ${Math.round((1-b.revenue/avgRev)*100)}% below chain avg`);

    if (b.missingReports > 3) pts.push(`${b.missingReports} missing reports`);
    else if (b.missingReports === 0) pts.push('full reporting compliance');

    if (b.rph > 0 && avgRPH > 0) {
      if (b.rph >= avgRPH * 1.1) pts.push(`high labor efficiency (${Math.round(b.rph)} PLN/hr)`);
      else if (b.rph < avgRPH * 0.85) pts.push(`low labor efficiency (${Math.round(b.rph)} PLN/hr)`);
    }
    if (b.specPct > 15) pts.push(`SPEC cost too high (${b.specPct.toFixed(1)}%)`);
    else if (b.specPct > 0 && b.specPct <= 10) pts.push(`lean SPEC cost (${b.specPct.toFixed(1)}%)`);

    if (b.estProfit < 0) pts.push('estimated loss this month');
    else if (b.revenue > 0 && b.estProfit / b.revenue > 0.25) pts.push(`strong margin (${Math.round(b.estProfit/b.revenue*100)}%)`);

    return { name: b.name, pts, rank: idx + 1 };
  });

  return { top, bottom, reasons };
}

export default function OwnerPerformanceScreen() {
  const now = new Date();
  const [selM, setSelM] = useState(now.getMonth()+1);
  const [selY, setSelY] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState([]);
  const [todayReports, setTodayReports] = useState([]);
  const [cfReports, setCfReports] = useState([]);
  const [specOrders, setSpecOrders] = useState([]);
  const [lastReports, setLastReports] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [showTable, setShowTable] = useState(false);

  const load = useCallback(async () => {
    try {
      const { from, to } = monthRange(selY, selM);
      const lm = lastMonthRange(selY, selM);
      const today = new Date().toISOString().slice(0,10);
      const [daily, cfRes, spRes, lastDaily, todayData] = await Promise.all([
        fetchAllDailyReports(from, to),
        supabase.from('cashflow_reports').select('*').gte('date',from).lte('date',to),
        supabase.from('spec_orders').select('*').gte('date',from).lte('date',to),
        fetchAllDailyReports(lm.from, lm.to),
        fetchAllDailyReports(today, today),
      ]);
      setReports(daily||[]);
      setCfReports(cfRes.data||[]);
      setSpecOrders(spRes.data||[]);
      setLastReports(lastDaily||[]);
      setTodayReports(todayData||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [selM, selY]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const isCurrentMonth = now.getMonth()+1===selM && now.getFullYear()===selY;
  const daysElapsed = isCurrentMonth ? now.getDate() : new Date(selY, selM, 0).getDate();

  const branchStats = BRANCHES.map(b => {
    const bR = reports.filter(r => r.branch===b.name);
    const todayR = todayReports.find(r => r.branch===b.name);
    const bCF = cfReports.filter(r => r.branch===b.name);
    const bSpec = specOrders.filter(r => r.branch===b.name);
    const bLast = lastReports.filter(r => r.branch===b.name);

    const revenue = bR.reduce((s,r) => s+(r.total_revenue||r.revenue||0), 0);
    const todayRev = todayR ? (todayR.total_revenue||todayR.revenue||0) : 0;
    const lastRev = bLast.reduce((s,r) => s+(r.total_revenue||r.revenue||0), 0);
    const revGrowth = lastRev>0 ? (revenue-lastRev)/lastRev*100 : null;
    const cfExpenses = bCF.reduce((s,r) => s+(r.total_expenses||r.total||0), 0);
    const netProfit = bR.reduce((s,r) => s+(r.net_profit||0), 0);

    // Aggregate per-worker hours from workers_hours JSON; fall back to legacy hours field
    const workerHoursMap = {};
    bR.forEach(r => {
      const wh = parseWorkersHours(r.workers_hours);
      if (wh.length > 0) {
        wh.forEach(w => { workerHoursMap[w.name] = (workerHoursMap[w.name] || 0) + w.hours; });
      }
    });
    const workerHours = Object.entries(workerHoursMap).map(([name, hours]) => ({ name, hours })).sort((a,b) => b.hours - a.hours);
    const hoursFromWorkers = workerHours.reduce((s, w) => s + w.hours, 0);
    const hours = hoursFromWorkers > 0 ? hoursFromWorkers : bR.reduce((s,r) => s+(r.hours||0), 0);
    const rph = hours>0 ? revenue/hours : 0;
    const delivery = bR.reduce((s,r) => s+(r.total_delivery||0), 0);
    const deliveryPct = revenue>0 ? delivery/revenue*100 : 0;

    let specCost=0, chickenQty=0, lambQty=0;
    bSpec.forEach(order => {
      specCost += order.total_cost||order.total||0;
      const items = extractItems(order.items);
      Object.entries(items).forEach(([k,v]) => {
        if (/kurczak|chicken/i.test(k)) chickenQty += Number(v)||0;
        if (/baranina|lamb/i.test(k)) lambQty += Number(v)||0;
      });
    });
    const specPct = revenue>0 ? specCost/revenue*100 : 0;
    const reportCount = bR.length;
    const missingReports = Math.max(0, daysElapsed - reportCount);

    const warnings = [];
    if (missingReports > 2) warnings.push(`${missingReports} missing reports this month`);
    if (specPct > 12) warnings.push(`SPEC cost ${fmtPct(specPct)} — above 12% threshold`);
    if (hours===0 && reportCount>0) warnings.push('No hours logged — labor data missing');
    if (netProfit<0) warnings.push('Negative profit this month');
    if (cfExpenses===0 && reportCount>0) warnings.push('No cash flow records submitted');

    return { name:b.name, revenue, todayRev, lastRev, revGrowth, cfExpenses, netProfit, estProfit:revenue-cfExpenses-specCost, hours, workerHours, rph, delivery, deliveryPct, specCost, specPct, chickenQty, lambQty, reportCount, missingReports, warnings, score:0 };
  });

  const active = branchStats.filter(b => b.reportCount>0);
  const n = active.length||1;
  const avgRev = active.reduce((s,b) => s+b.revenue,0)/n;
  const avgRPH = active.reduce((s,b) => s+b.rph,0)/n;

  branchStats.forEach(b => {
    let sc=0;
    if (avgRev>0) sc+=Math.min(30,Math.round(b.revenue/avgRev*30));
    if (avgRPH>0&&b.rph>0) sc+=Math.min(25,Math.round(b.rph/avgRPH*25));
    else if (b.reportCount>0&&b.hours>0) sc+=10;
    if (b.specPct===0) sc+=15; else if (b.specPct<=10) sc+=20; else if (b.specPct<=15) sc+=10;
    const repRate = daysElapsed>0 ? b.reportCount/daysElapsed : 0;
    sc+=Math.round(repRate*15);
    const expR = b.revenue>0 ? b.cfExpenses/b.revenue : 0;
    if (expR<=0.3) sc+=10; else if (expR<=0.5) sc+=5;
    b.score=Math.min(100,sc);
  });

  const sorted = [...branchStats].filter(b=>b.reportCount>0).sort((a,b)=>b.revenue-a.revenue);
  const totalRev = active.reduce((s,b)=>s+b.revenue,0);
  const medals=['🥇','🥈','🥉'];
  const toggle = name => setExpanded(p => p===name ? null : name);

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
        <Text style={s.pageTitle}>Performance</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
          {MONTHS.map((m,i) => (
            <TouchableOpacity key={m} onPress={()=>setSelM(i+1)} style={[s.pill, selM===i+1&&s.pillOn]}>
              <Text style={[s.pillTxt, selM===i+1&&s.pillTxtOn]}>{m.slice(0,3)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={{flexDirection:'row',gap:8,marginBottom:16}}>
          {[now.getFullYear(), now.getFullYear()-1].map(y=>(
            <TouchableOpacity key={y} onPress={()=>setSelY(y)} style={[s.pill, selY===y&&s.pillOn]}>
              <Text style={[s.pillTxt, selY===y&&s.pillTxtOn]}>{y}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.chainCard}>
          <Text style={s.chainLbl}>CHAIN — {MONTHS[selM-1].toUpperCase()} {selY}</Text>
          <View style={{flexDirection:'row'}}>
            <View style={s.chainStat}><Text style={s.chainVal}>{fmtK(totalRev)} PLN</Text><Text style={s.chainStatLbl}>Total Revenue</Text></View>
            <View style={s.chainStat}><Text style={s.chainVal}>{sorted.length}</Text><Text style={s.chainStatLbl}>Active Branches</Text></View>
            <View style={s.chainStat}><Text style={s.chainVal}>{sorted.length>0?fmtK(totalRev/sorted.length):'0'}</Text><Text style={s.chainStatLbl}>Avg / Branch</Text></View>
          </View>
        </View>

        {sorted.length===0 && <View style={s.empty}><Text style={s.emptyTxt}>No data for {MONTHS[selM-1]} {selY}</Text></View>}

        {sorted.length > 0 && (() => {
          const ai = buildAIAnalysis(sorted, daysElapsed, avgRev, avgRPH);
          if (!ai) return null;
          return (
            <View style={s.aiCard}>
              <View style={s.aiHeader}>
                <View style={s.aiBadge}><Text style={s.aiBadgeTxt}>AI</Text></View>
                <Text style={s.aiTitle}>Ranking Analysis</Text>
              </View>

              <View style={s.aiSection}>
                <Text style={s.aiSectionLabel}>TOP PERFORMER</Text>
                <View style={s.aiRankLine}>
                  <Text style={s.aiRankNum}>#1</Text>
                  <View style={{flex:1}}>
                    <Text style={s.aiRankBranch}>🥇 {ai.top.name}</Text>
                    <Text style={s.aiRankReason}>{ai.reasons[0].pts.join(' · ')}</Text>
                  </View>
                </View>
              </View>

              {ai.reasons.length > 1 && (
                <>
                  <View style={s.aiDivider}/>
                  <View style={s.aiSection}>
                    <Text style={s.aiSectionLabel}>FULL RANKING</Text>
                    {ai.reasons.map((r, i) => (
                      <View key={r.name} style={[s.aiRankLine, {marginBottom:6}]}>
                        <Text style={s.aiRankNum}>#{r.rank}</Text>
                        <View style={{flex:1}}>
                          <Text style={s.aiRankBranch}>{r.name}</Text>
                          <Text style={s.aiRankReason}>{r.pts.join(' · ')}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {ai.reasons.length > 1 && (
                <>
                  <View style={s.aiDivider}/>
                  <View style={s.aiSection}>
                    <Text style={s.aiSectionLabel}>NEEDS ATTENTION</Text>
                    <View style={s.aiRankLine}>
                      <Text style={[s.aiRankNum, {color:'#FF6B6B'}]}>#{ai.bottom.reportCount>0?sorted.length:'?'}</Text>
                      <View style={{flex:1}}>
                        <Text style={[s.aiRankBranch, {color:'#FF6B6B'}]}>⚠️ {ai.bottom.name}</Text>
                        <Text style={s.aiRankReason}>{ai.reasons[ai.reasons.length-1].pts.join(' · ')}</Text>
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          );
        })()}

        {sorted.map((b, idx) => {
          const medal = medals[idx]||(idx<sorted.length/2?'📈':'📉');
          const isExp = expanded===b.name;
          const topRev = sorted[0]?.revenue || 1;
          const barPct = Math.round(b.revenue / topRev * 100);
          const scoreColor = b.score>=75?COLORS.primary:b.score>=50?COLORS.warning:COLORS.danger;
          const revColor = idx===0?COLORS.primary:idx===1?'#757575':idx===2?'#795548':COLORS.warning;
          const specStatus = b.specPct===0?null:b.specPct<=10?{c:'#2E7D32',lbl:'Good'}:b.specPct<=15?{c:COLORS.warning,lbl:'High'}:{c:COLORS.danger,lbl:'Too High'};
          const rphVsAvg = avgRPH>0&&b.rph>0 ? (b.rph-avgRPH)/avgRPH*100 : null;

          return (
            <View key={b.name} style={s.card}>
              <TouchableOpacity onPress={()=>toggle(b.name)} activeOpacity={0.8}>
                <View style={{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8}}>
                  <Text style={s.medal}>{medal}</Text>
                  <View style={{flex:1}}>
                    <Text style={s.cardName}>#{idx+1} {b.name}</Text>
                    <Text style={s.cardSub}>{b.reportCount} reports · Score {b.score}/100</Text>
                  </View>
                  <View style={{alignItems:'flex-end'}}>
                    <Text style={[s.cardRev,{color:revColor}]}>{fmtK(b.revenue)} PLN</Text>
                    {b.todayRev>0&&<Text style={s.cardToday}>{fmtK(b.todayRev)} today</Text>}
                  </View>
                  <Text style={s.chevron}>{isExp?'▲':'▼'}</Text>
                </View>
                <View style={s.barBg}><View style={[s.barFill,{width:barPct+'%',backgroundColor:revColor}]}/></View>
              </TouchableOpacity>

              {isExp&&(
                <View style={s.detail}>
                  <Text style={s.secLbl}>💰 Revenue</Text>
                  <View style={s.grid4}>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.revenue)}</Text><Text style={s.statLbl}>This Month</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{b.todayRev>0?fmtK(b.todayRev):'—'}</Text><Text style={s.statLbl}>Today</Text></View>
                    <View style={s.statBox}>
                      {b.revGrowth!==null?<Text style={[s.statVal,{color:b.revGrowth>=0?COLORS.primary:COLORS.danger}]}>{b.revGrowth>=0?'+':''}{fmtPct(b.revGrowth)}</Text>:<Text style={s.statVal}>—</Text>}
                      <Text style={s.statLbl}>vs Last Month</Text>
                    </View>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.lastRev)}</Text><Text style={s.statLbl}>Last Month</Text></View>
                  </View>

                  <Text style={s.secLbl}>📦 SPEC Usage</Text>
                  <View style={s.grid4}>
                    <View style={s.statBox}><Text style={s.statVal}>{b.chickenQty>0?b.chickenQty+'kg':'—'}</Text><Text style={s.statLbl}>Chicken</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{b.lambQty>0?b.lambQty+'kg':'—'}</Text><Text style={s.statLbl}>Lamb</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.specCost)}</Text><Text style={s.statLbl}>SPEC Cost</Text></View>
                    <View style={[s.statBox,specStatus&&{backgroundColor:specStatus.c+'22'}]}>
                      <Text style={[s.statVal,{color:specStatus?specStatus.c:'#999'}]}>{b.specPct>0?fmtPct(b.specPct):'—'}</Text>
                      <Text style={s.statLbl}>{specStatus?specStatus.lbl:'Food Cost %'}</Text>
                    </View>
                  </View>

                  <Text style={s.secLbl}>👨‍🍳 Labor Efficiency</Text>
                  <View style={s.grid4}>
                    <View style={s.statBox}><Text style={s.statVal}>{b.hours>0?b.hours+'h':'—'}</Text><Text style={s.statLbl}>Total Hours</Text></View>
                    <View style={s.statBox}><Text style={[s.statVal,{color:COLORS.primary}]}>{b.rph>0?Math.round(b.rph)+' PLN':'—'}</Text><Text style={s.statLbl}>PLN / hr</Text></View>
                    <View style={s.statBox}>
                      {rphVsAvg!==null?<Text style={[s.statVal,{color:rphVsAvg>=0?COLORS.primary:COLORS.danger}]}>{rphVsAvg>=0?'+':''}{fmtPct(rphVsAvg)}</Text>:<Text style={s.statVal}>—</Text>}
                      <Text style={s.statLbl}>vs Chain Avg</Text>
                    </View>
                    <View style={s.statBox}><Text style={s.statVal}>{avgRPH>0?Math.round(avgRPH)+' PLN':'—'}</Text><Text style={s.statLbl}>Chain Avg</Text></View>
                  </View>
                  {b.workerHours.length > 0 && (
                    <View style={s.workerHoursBox}>
                      <Text style={s.workerHoursTitle}>Hours by Worker</Text>
                      {b.workerHours.map((w, wi) => (
                        <View key={wi} style={s.workerHoursRow}>
                          <Text style={s.workerHoursName}>{w.name}</Text>
                          <Text style={s.workerHoursVal}>{w.hours}h</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={s.secLbl}>🚚 Delivery</Text>
                  <View style={s.grid4}>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.delivery)}</Text><Text style={s.statLbl}>Delivery Rev</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{b.deliveryPct>0?fmtPct(b.deliveryPct):'—'}</Text><Text style={s.statLbl}>Delivery %</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.revenue-b.delivery)}</Text><Text style={s.statLbl}>Direct Rev</Text></View>
                    <View style={s.statBox}><Text style={s.statVal}>{fmtK(b.cfExpenses)}</Text><Text style={s.statLbl}>CF Expenses</Text></View>
                  </View>

                  <Text style={s.secLbl}>💵 Estimated Profit</Text>
                  <View style={[s.profitBox,{borderColor:b.estProfit>=0?COLORS.primary:COLORS.danger}]}>
                    <View style={s.profitRow}><Text style={s.profitLbl}>Revenue</Text><Text style={s.profitVal}>+{fmtK(b.revenue)} PLN</Text></View>
                    <View style={s.profitRow}><Text style={s.profitLbl}>CF Expenses</Text><Text style={[s.profitVal,{color:COLORS.danger}]}>-{fmtK(b.cfExpenses)} PLN</Text></View>
                    <View style={s.profitRow}><Text style={s.profitLbl}>SPEC Cost</Text><Text style={[s.profitVal,{color:COLORS.danger}]}>-{fmtK(b.specCost)} PLN</Text></View>
                    <View style={[s.profitRow,{borderTopWidth:1,borderTopColor:'#eee',marginTop:6,paddingTop:8}]}>
                      <Text style={[s.profitLbl,{fontWeight:'800'}]}>Est. Profit</Text>
                      <Text style={[s.profitVal,{fontSize:16,fontWeight:'900',color:b.estProfit>=0?COLORS.primary:COLORS.danger}]}>{b.estProfit>=0?'+':''}{fmtK(b.estProfit)} PLN</Text>
                    </View>
                  </View>

                  {b.warnings.length>0&&(
                    <View style={s.warnBox}>
                      {b.warnings.map((w,i)=><Text key={i} style={s.warnTxt}>⚠️ {w}</Text>)}
                    </View>
                  )}

                  {b.revGrowth!==null&&(
                    <View style={[s.trendBadge,{backgroundColor:b.revGrowth>=0?'#E8F5E9':'#FFEBEE'}]}>
                      <Text style={[s.trendTxt,{color:b.revGrowth>=0?COLORS.primary:COLORS.danger}]}>
                        {b.revGrowth>=0?'📈':'📉'} {b.revGrowth>=0?'+':''}{fmtPct(b.revGrowth)} vs last month ({fmtK(b.lastRev)} → {fmtK(b.revenue)} PLN)
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}

        {sorted.length>0&&(
          <>
            <TouchableOpacity style={s.tableToggle} onPress={()=>setShowTable(p=>!p)}>
              <Text style={s.tableToggleTxt}>📊 {showTable?'Hide':'Show'} Comparison Table</Text>
            </TouchableOpacity>
            {showTable&&(
              <View style={s.tableCard}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    <View style={[s.tableRow,{borderBottomWidth:2,borderBottomColor:'#ddd'}]}>
                      {['Branch','Revenue','SPEC%','PLN/hr','Margin'].map(h=>(
                        <Text key={h} style={[s.tableCell,{fontWeight:'800',color:'#555',fontSize:11}]}>{h}</Text>
                      ))}
                    </View>
                    {sorted.map((b,i)=>{
                      const margin = b.revenue>0 ? b.estProfit/b.revenue*100 : null;
                      const specFlag = b.specPct===0?'—':b.specPct<=10?'✅':b.specPct<=15?'⚠️':'🔴';
                      const marginFlag = margin===null?'—':margin>=20?'✅':margin>=0?'⚠️':'🔴';
                      return (
                        <View key={b.name} style={[s.tableRow,i%2===0&&{backgroundColor:'#F9F9F9'}]}>
                          <Text style={[s.tableCell,{fontWeight:'700'}]} numberOfLines={1}>{b.name.split(' ')[0]}</Text>
                          <Text style={s.tableCell}>{fmtK(b.revenue)}</Text>
                          <Text style={s.tableCell}>{specFlag} {b.specPct>0?fmtPct(b.specPct):''}</Text>
                          <Text style={s.tableCell}>{b.rph>0?Math.round(b.rph):'—'}</Text>
                          <Text style={s.tableCell}>{marginFlag} {margin!==null?fmtPct(margin):''}</Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  content:{padding:16,paddingBottom:50},
  pageTitle:{fontSize:28,fontWeight:'800',color:'#111',marginBottom:12},
  pill:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#ddd',marginRight:6},
  pillOn:{backgroundColor:COLORS.primary,borderColor:COLORS.primary},
  pillTxt:{fontSize:12,fontWeight:'600',color:'#777'},
  pillTxtOn:{color:'#fff'},
  chainCard:{backgroundColor:COLORS.primary,borderRadius:16,padding:16,marginBottom:16},
  chainLbl:{fontSize:10,fontWeight:'800',color:'rgba(255,255,255,0.7)',letterSpacing:1,marginBottom:10},
  chainStat:{flex:1,alignItems:'center'},
  chainVal:{fontSize:18,fontWeight:'900',color:'#fff'},
  chainStatLbl:{fontSize:10,color:'rgba(255,255,255,0.7)',marginTop:2},
  empty:{padding:40,alignItems:'center'},
  emptyTxt:{color:'#aaa',fontSize:14},
  card:{backgroundColor:'#fff',borderRadius:16,padding:14,marginBottom:10,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:2},
  medal:{fontSize:24},
  cardName:{fontSize:14,fontWeight:'800',color:'#111'},
  cardSub:{fontSize:11,color:'#999',marginTop:1},
  cardRev:{fontSize:15,fontWeight:'900'},
  cardToday:{fontSize:11,color:'#888',marginTop:1},
  chevron:{fontSize:12,color:'#aaa',marginLeft:4},
  barBg:{backgroundColor:'#eee',borderRadius:4,height:6},
  barFill:{height:'100%',borderRadius:4},
  detail:{marginTop:14,paddingTop:14,borderTopWidth:1,borderTopColor:'#f0f0f0'},
  secLbl:{fontSize:12,fontWeight:'800',color:'#555',letterSpacing:0.5,marginTop:12,marginBottom:8},
  grid4:{flexDirection:'row',flexWrap:'wrap',gap:8},
  statBox:{width:'47%',backgroundColor:'#F8F8F8',borderRadius:10,padding:10},
  statVal:{fontSize:16,fontWeight:'800',color:'#111'},
  statLbl:{fontSize:10,color:'#999',marginTop:2},
  profitBox:{borderWidth:1.5,borderRadius:12,padding:12,marginTop:4},
  profitRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:5},
  profitLbl:{fontSize:13,color:'#555'},
  profitVal:{fontSize:13,fontWeight:'700',color:'#111'},
  warnBox:{backgroundColor:'#FFF8E1',borderRadius:10,padding:12,marginTop:10,gap:6},
  warnTxt:{fontSize:12,color:'#E65100',lineHeight:18},
  trendBadge:{borderRadius:10,padding:12,marginTop:10},
  trendTxt:{fontSize:13,fontWeight:'600',lineHeight:20},
  tableToggle:{backgroundColor:'#fff',borderRadius:12,padding:14,alignItems:'center',marginTop:8,marginBottom:4,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:3,elevation:2},
  tableToggleTxt:{fontSize:14,fontWeight:'700',color:COLORS.primary},
  tableCard:{backgroundColor:'#fff',borderRadius:12,padding:12,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:3,elevation:2},
  tableRow:{flexDirection:'row',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  tableCell:{width:85,fontSize:12,color:'#333',paddingHorizontal:4},
  workerHoursBox:{backgroundColor:'#F0F4FF',borderRadius:10,padding:10,marginTop:8},
  workerHoursTitle:{fontSize:11,fontWeight:'800',color:'#3949AB',marginBottom:6,letterSpacing:0.3},
  workerHoursRow:{flexDirection:'row',justifyContent:'space-between',paddingVertical:3,borderBottomWidth:1,borderBottomColor:'#E3E8FF'},
  workerHoursName:{fontSize:12,color:'#333'},
  workerHoursVal:{fontSize:12,fontWeight:'700',color:'#3949AB'},
  aiCard:{backgroundColor:'#1A1A2E',borderRadius:16,padding:16,marginBottom:16},
  aiHeader:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:12},
  aiTitle:{fontSize:13,fontWeight:'800',color:'#fff',letterSpacing:0.5},
  aiBadge:{backgroundColor:'#6C63FF',borderRadius:6,paddingHorizontal:8,paddingVertical:2},
  aiBadgeTxt:{fontSize:10,fontWeight:'800',color:'#fff'},
  aiSection:{marginBottom:10},
  aiSectionLabel:{fontSize:11,fontWeight:'800',color:'rgba(255,255,255,0.5)',letterSpacing:0.8,marginBottom:4},
  aiRankLine:{flexDirection:'row',alignItems:'flex-start',gap:6,marginBottom:4},
  aiRankNum:{fontSize:13,fontWeight:'900',color:'#6C63FF',width:24},
  aiRankBranch:{fontSize:13,fontWeight:'700',color:'#fff'},
  aiRankReason:{fontSize:12,color:'rgba(255,255,255,0.65)',lineHeight:17,marginTop:1},
  aiDivider:{height:1,backgroundColor:'rgba(255,255,255,0.1)',marginVertical:8},
});
