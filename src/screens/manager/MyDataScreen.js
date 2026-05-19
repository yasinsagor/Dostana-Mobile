import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchDailyReports, fetchCashflowReports, fetchSpecOrders, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

/* ─── helpers ───────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2,'0'); }
function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtK(n) { if (!n&&n!==0) return '0'; return Math.abs(n)>=1000?(n/1000).toFixed(1)+'k':String(Math.round(n)); }
function monthRange() {
  const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
  return { from:`${y}-${pad(m)}-01`, to:`${y}-${pad(m)}-${pad(new Date(y,m,0).getDate())}`, y, m };
}
function lastMonthRange() {
  const d=new Date(), y=d.getFullYear(), m=d.getMonth()+1;
  const lm=m===1?12:m-1, ly=m===1?y-1:y;
  return { from:`${ly}-${pad(lm)}-01`, to:`${ly}-${pad(lm)}-${pad(new Date(ly,lm,0).getDate())}` };
}
function dayName(iso) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso).getDay()]; }
function extractItems(items) {
  if (!items) return [];
  if (typeof items==='string') { try { items=JSON.parse(items); } catch { return []; } }
  return Array.isArray(items) ? items : [];
}
function parseUnitKg(unit) {
  if (!unit) return 1;
  const m = String(unit).match(/(\d+)\s*kg/i);
  return m ? parseInt(m[1]) : (String(unit).toLowerCase()==='kg'?1:0);
}
function pct(a,b) { if(!b) return null; return Math.round((a-b)/b*100); }
function trendArrow(p) {
  if (p===null) return { arrow:'—', color:'#aaa' };
  if (p>0)  return { arrow:`↑${p}%`, color:COLORS.primary };
  if (p<0)  return { arrow:`↓${Math.abs(p)}%`, color:COLORS.danger };
  return { arrow:'=', color:'#aaa' };
}

/* ─── mini components ───────────────────────────────────────── */
function StatCard({ label, value, sub, color=COLORS.primary, bg='#E8F5E9' }) {
  return (
    <View style={[sc.card,{backgroundColor:bg}]}>
      <Text style={[sc.val,{color}]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      {sub?<Text style={[sc.sub,{color}]}>{sub}</Text>:null}
    </View>
  );
}
const sc=StyleSheet.create({
  card:{flex:1,borderRadius:12,padding:12,alignItems:'center',margin:3},
  val:{fontSize:17,fontWeight:'900',marginBottom:2,textAlign:'center'},
  label:{fontSize:10,color:'#888',textAlign:'center',fontWeight:'600'},
  sub:{fontSize:10,fontWeight:'800',marginTop:2,textAlign:'center'},
});

function SectionCard({ title, children, color=COLORS.primary }) {
  return (
    <View style={[card.wrap,{borderTopColor:color}]}>
      <Text style={[card.title,{color}]}>{title}</Text>
      {children}
    </View>
  );
}
const card=StyleSheet.create({
  wrap:{backgroundColor:'#fff',borderRadius:14,padding:14,marginBottom:10,borderTopWidth:3,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:2},
  title:{fontSize:11,fontWeight:'800',letterSpacing:1,textTransform:'uppercase',marginBottom:12},
});

function InnerTab({ label, active, onPress }) {
  return (
    <TouchableOpacity style={[it.tab,active&&it.active]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[it.txt,active&&{color:COLORS.primary,fontWeight:'800'}]}>{label}</Text>
    </TouchableOpacity>
  );
}
const it=StyleSheet.create({
  tab:{flex:1,paddingVertical:10,alignItems:'center',borderBottomWidth:2,borderBottomColor:'transparent'},
  active:{borderBottomColor:COLORS.primary},
  txt:{fontSize:13,color:'#aaa',fontWeight:'600'},
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerMyDataScreen() {
  const { user } = useAuth();
  const branch = user?.branch || '';
  const [tab, setTab]  = useState('Reports');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [dr,     setDr]     = useState([]);
  const [cf,     setCf]     = useState([]);
  const [spec,   setSpec]   = useState([]);
  const [drLast, setDrLast] = useState([]);
  const [allDr,  setAllDr]  = useState([]);

  const { from, to } = monthRange();
  const { from:lfrom, to:lto } = lastMonthRange();

  const load = useCallback(async () => {
    try {
      const [d, c, s, dl, all] = await Promise.all([
        fetchDailyReports(branch, from, to),
        fetchCashflowReports(branch, from, to),
        fetchSpecOrders(branch, from, to),
        fetchDailyReports(branch, lfrom, lto),
        fetchAllDailyReports(from, to),
      ]);
      setDr(d||[]); setCf(c||[]); setSpec(s||[]);
      setDrLast(dl||[]); setAllDr(all||[]);
    } catch(e) { console.error(e); }
    setLoading(false); setRefreshing(false);
  }, [branch, from, to, lfrom, lto]);

  useEffect(()=>{ load(); },[load]);

  /* ── derived ── */
  const rev        = dr.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
  const revLast    = drLast.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
  const totalCF    = cf.reduce((s,r)=>s+(r.total_expenses||0),0);
  const totalHours = dr.reduce((s,r)=>s+(r.total_hours||r.hours||0),0);
  const revPct     = pct(rev, revLast);
  const revPerHr   = totalHours>0 ? Math.round(rev/totalHours) : 0;
  const avgDay     = dr.length>0 ? Math.round(rev/dr.length) : 0;
  const bestDay    = dr.reduce((best,r)=>{
    const v=r.total_revenue||r.revenue||0; return v>(best?.val||0)?{val:v,date:r.date}:best;
  }, null);
  const deliveryRev = dr.reduce((s,r)=>s+(['wolt','glovo','uber_eats','bolt','pyszne'].reduce((d,k)=>d+(r[k]||0),0)),0);
  const delivPct    = rev>0 ? Math.round(deliveryRev/rev*100) : 0;

  // SPEC chicken/lamb
  let chickenKg=0, lambKg=0, specCost=0;
  spec.forEach(o => {
    extractItems(o.items).forEach(it => {
      const qty = parseFloat(it.qty||0);
      const kgPerUnit = parseUnitKg(it.unit);
      const totalKg = qty * (kgPerUnit||1);
      const nm = (it.name||'').toLowerCase();
      if (nm.includes('kurczak')) chickenKg += totalKg;
      else if (nm.includes('baran')) lambKg += totalKg;
      specCost += qty * (it.price||0);
    });
  });
  const foodCostPct = rev>0 && specCost>0 ? (specCost/rev*100).toFixed(1) : null;

  // CF expenses "Inne" %
  const inneTotal = cf.reduce((s,r)=>{
    const exps = Array.isArray(r.expenses)?r.expenses:[];
    return s+exps.filter(e=>e.name==='Inne').reduce((x,e)=>x+parseFloat(e.amount||0),0);
  },0);
  const innePct = totalCF>0 ? Math.round(inneTotal/totalCF*100) : 0;

  // Warnings
  const warnings = [];
  if (delivPct>40) warnings.push({ icon:'🚚', txt:`High delivery: ${delivPct}% of revenue (target <40%)` });
  if (totalCF>0 && totalCF/rev>0.5) warnings.push({ icon:'💸', txt:`CF expenses ${Math.round(totalCF/rev*100)}% of revenue — check costs` });
  if (innePct>20) warnings.push({ icon:'⚠️', txt:`"Inne" is ${innePct}% of expenses — add descriptions` });
  if (foodCostPct && parseFloat(foodCostPct)>15) warnings.push({ icon:'📦', txt:`Food cost ${foodCostPct}% — reduce SPEC ordering` });
  if (dr.length < new Date().getDate()-3) warnings.push({ icon:'📋', txt:`Only ${dr.length} reports this month — improve consistency` });

  // Ranking
  const branchRevMap = {};
  allDr.forEach(r => { const b=r.branch||''; branchRevMap[b]=(branchRevMap[b]||0)+(r.total_revenue||r.revenue||0); });
  const sorted = Object.entries(branchRevMap).sort((a,b)=>b[1]-a[1]);
  const myRank = sorted.findIndex(([b])=>b===branch)+1 || '?';
  const chainAvg = sorted.length>0 ? Math.round(sorted.reduce((s,[,v])=>s+v,0)/sorted.length) : 0;
  const topBranch = sorted[0];

  // Monthly target (last month + 5%)
  const target = revLast>0 ? Math.round(revLast*1.05) : null;
  const targetPct = target && rev>0 ? Math.min(100,Math.round(rev/target*100)) : null;

  // Hours bar (last 7 days)
  const last7Hours = Array.from({length:7},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-6+i);
    const iso=d.toISOString().slice(0,10);
    const r=dr.find(x=>x.date===iso);
    return { iso, hrs:r?.total_hours||r?.hours||0, day:dayName(iso) };
  });
  const maxHrs = Math.max(...last7Hours.map(d=>d.hrs),1);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  const { arrow:revArrow, color:arrowColor } = trendArrow(revPct);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📊 {branch}</Text>
          <Text style={s.headerSub}>{new Date().toLocaleString('en-GB',{month:'long',year:'numeric'})}</Text>
        </View>
        <View style={[s.rankBadge,{backgroundColor:myRank<=3?'#FFF8E1':'#F5F5F5'}]}>
          <Text style={[s.rankTxt,{color:myRank<=3?'#E65100':COLORS.primary}]}>#{myRank}</Text>
          <Text style={s.rankLbl}>in chain</Text>
        </View>
      </View>

      {/* Inner tabs */}
      <View style={s.tabBar}>
        {['Reports','Rank','Staff'].map(t=>(
          <InnerTab key={t} label={t} active={tab===t} onPress={()=>setTab(t)}/>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load();}} tintColor={COLORS.primary}/>}
      >

        {/* ══ REPORTS TAB ══════════════════════════════════════ */}
        {tab==='Reports'&&(<>

          {/* Summary */}
          <SectionCard title="This Month Summary" color={COLORS.primary}>
            <View style={{flexDirection:'row'}}>
              <StatCard label="Revenue"   value={`${fmtK(rev)} PLN`}       color={COLORS.primary} bg="#E8F5E9"/>
              <StatCard label="CF Expenses" value={`${fmtK(totalCF)} PLN`} color="#D32F2F"        bg="#FFEBEE"/>
            </View>
            <View style={{flexDirection:'row',marginTop:0}}>
              <StatCard label="Hours"    value={`${totalHours}h`}    color="#555"         bg="#F5F5F5"/>
              <StatCard label="vs Last Month" value={revArrow}       color={arrowColor}   bg={revPct&&revPct>0?'#E8F5E9':revPct&&revPct<0?'#FFEBEE':'#F5F5F5'}/>
            </View>
            {bestDay&&<View style={s.bestDay}><Text style={s.bestDayTxt}>🏆 Best day: {bestDay.date} — {fmtK(bestDay.val)} PLN</Text></View>}
            {target&&(
              <View style={{marginTop:10}}>
                <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                  <Text style={{fontSize:11,fontWeight:'700',color:'#555'}}>🎯 Monthly Target</Text>
                  <Text style={{fontSize:11,fontWeight:'800',color:COLORS.primary}}>{targetPct}% of {fmtK(target)} PLN</Text>
                </View>
                <View style={s.targetBarWrap}>
                  <View style={[s.targetBar,{width:`${targetPct}%`,backgroundColor:targetPct>=100?'#2E7D32':COLORS.primary}]}/>
                </View>
              </View>
            )}
          </SectionCard>

          {/* Warnings */}
          {warnings.length>0&&(
            <SectionCard title="⚠️ Warnings" color={COLORS.danger}>
              {warnings.map((w,i)=>(
                <View key={i} style={s.warnRow}>
                  <Text style={{fontSize:16}}>{w.icon}</Text>
                  <Text style={s.warnTxt}>{w.txt}</Text>
                </View>
              ))}
            </SectionCard>
          )}

          {/* SPEC Summary */}
          <SectionCard title="📦 SPEC This Month" color="#6A1B9A">
            <View style={{flexDirection:'row'}}>
              <StatCard label="Chicken" value={`${Math.round(chickenKg)}kg`} color="#D32F2F" bg="#FFEBEE"/>
              <StatCard label="Lamb"    value={`${Math.round(lambKg)}kg`}    color="#E65100" bg="#FFF3E0"/>
              <StatCard label="Orders"  value={String(spec.length)}           color="#6A1B9A" bg="#F3E5F5"/>
            </View>
            {foodCostPct&&(
              <View style={[s.bestDay,{backgroundColor:parseFloat(foodCostPct)>15?'#FFEBEE':'#F3E5F5'}]}>
                <Text style={[s.bestDayTxt,{color:parseFloat(foodCostPct)>15?COLORS.danger:'#6A1B9A'}]}>
                  📊 Estimated food cost: {foodCostPct}% of revenue {parseFloat(foodCostPct)>15?'⚠️':'✅'}
                </Text>
              </View>
            )}
          </SectionCard>

          {/* Hours efficiency */}
          <SectionCard title="👨‍🍳 Hours Efficiency" color="#1565C0">
            <View style={{flexDirection:'row'}}>
              <StatCard label="Total Hours" value={`${totalHours}h`}          color="#1565C0" bg="#E3F2FD"/>
              <StatCard label="Rev / Hour"  value={`${fmtK(revPerHr)} PLN`}   color="#1565C0" bg="#E3F2FD"/>
              <StatCard label="Avg / Day"   value={`${fmtK(avgDay)} PLN`}     color="#555"    bg="#F5F5F5"/>
            </View>
            <View style={s.hoursBar}>
              {last7Hours.map((d,i)=>{
                const h=maxHrs>0?Math.max(4,(d.hrs/maxHrs)*70):4;
                return (
                  <View key={i} style={s.hourCol}>
                    <Text style={s.hourVal}>{d.hrs>0?d.hrs:''}</Text>
                    <View style={[s.hourBar,{height:h,backgroundColor:d.hrs>0?'#1565C0':'#EEE'}]}/>
                    <Text style={s.hourDay}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
          </SectionCard>

        </>)}

        {/* ══ RANK TAB ════════════════════════════════════════ */}
        {tab==='Rank'&&(<>

          <SectionCard title="Your Position" color={COLORS.primary}>
            <View style={s.rankBig}>
              <Text style={s.rankNumber}>#{myRank}</Text>
              <Text style={s.rankOf}>out of {sorted.length} branches</Text>
              <Text style={[s.rankRev,{color:COLORS.primary}]}>{fmtK(rev)} PLN this month</Text>
            </View>
            <View style={{flexDirection:'row',marginTop:8}}>
              <StatCard label="Chain Avg"  value={`${fmtK(chainAvg)} PLN`} color="#555"    bg="#F5F5F5"/>
              <StatCard label="vs Avg"     value={rev>0?`${rev>chainAvg?'+':''}${Math.round((rev-chainAvg)/chainAvg*100)}%`:'—'}
                color={rev>=chainAvg?COLORS.primary:COLORS.danger}
                bg={rev>=chainAvg?'#E8F5E9':'#FFEBEE'}/>
              <StatCard label="vs Last Mo" value={revArrow} color={arrowColor} bg="#F5F5F5"/>
            </View>
          </SectionCard>

          <SectionCard title="🏆 Chain Leaderboard" color="#E65100">
            {sorted.slice(0,10).map(([b,v],i)=>{
              const isMe = b===branch;
              const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
              return (
                <View key={b} style={[s.rankRow,isMe&&s.rankRowMe]}>
                  <Text style={s.rankPos}>{medal||`#${i+1}`}</Text>
                  <View style={{flex:1}}>
                    <Text style={[s.rankBranchName,isMe&&{color:COLORS.primary}]}>
                      {b}{isMe?' ← You':''}
                    </Text>
                    <View style={s.rankBarWrap}>
                      <View style={[s.rankBarFill,{width:`${Math.round(v/(sorted[0]?.[1]||1)*100)}%`,backgroundColor:isMe?COLORS.primary:'#E0E0E0'}]}/>
                    </View>
                  </View>
                  <Text style={[s.rankVal,isMe&&{color:COLORS.primary}]}>{fmtK(v)}</Text>
                </View>
              );
            })}
          </SectionCard>

        </>)}

        {/* ══ STAFF TAB ════════════════════════════════════════ */}
        {tab==='Staff'&&(<>

          <SectionCard title="👨‍🍳 Staff Overview" color="#1B5E20">
            <View style={{flexDirection:'row'}}>
              <StatCard label="Total Hours" value={`${totalHours}h`}              color="#1B5E20" bg="#E8F5E9"/>
              <StatCard label="Est. Salary" value={`${fmtK(totalHours*22)} PLN`}  color="#D32F2F" bg="#FFEBEE"/>
              <StatCard label="Avg/Day"     value={`${dr.length>0?Math.round(totalHours/dr.length):0}h`} color="#555" bg="#F5F5F5"/>
            </View>
            <View style={[s.bestDay,{marginTop:10}]}>
              <Text style={s.bestDayTxt}>💡 Estimated at 22 PLN/hr · {dr.length} working days this month</Text>
            </View>
          </SectionCard>

          <SectionCard title="📈 Labor Efficiency" color="#1565C0">
            <View style={{flexDirection:'row'}}>
              <StatCard label="Rev / Hour"    value={`${fmtK(revPerHr)} PLN`}         color="#1565C0" bg="#E3F2FD"/>
              <StatCard label="Labor % Rev"   value={totalHours>0&&rev>0?`${Math.round(totalHours*22/rev*100)}%`:'—'}
                color={totalHours>0&&rev>0&&(totalHours*22/rev)>0.25?COLORS.danger:'#1565C0'}
                bg={totalHours>0&&rev>0&&(totalHours*22/rev)>0.25?'#FFEBEE':'#E3F2FD'}/>
            </View>
          </SectionCard>

          <SectionCard title="📅 Daily Hours This Month" color="#1565C0">
            {dr.length===0
              ? <Text style={s.emptyTxt}>No reports yet this month</Text>
              : dr.slice(0,14).map(r=>{
                  const h=r.total_hours||r.hours||0;
                  const v=r.total_revenue||r.revenue||0;
                  return (
                    <View key={r.date} style={s.staffRow}>
                      <Text style={s.staffDate}>{r.date}</Text>
                      <View style={s.staffBarWrap}>
                        <View style={[s.staffBar,{width:`${Math.min(100,h/12*100)}%`}]}/>
                      </View>
                      <Text style={s.staffHrs}>{h}h</Text>
                      <Text style={s.staffRev}>{fmtK(v)}</Text>
                    </View>
                  );
                })
            }
          </SectionCard>

        </>)}

      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor:'#F4F6F8' },
  center:       { flex:1, justifyContent:'center', alignItems:'center' },
  header:       { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:'#EEE' },
  headerTitle:  { fontSize:17, fontWeight:'900', color:'#222' },
  headerSub:    { fontSize:11, color:'#aaa', marginTop:2 },
  rankBadge:    { borderRadius:10, padding:8, alignItems:'center', minWidth:52 },
  rankTxt:      { fontSize:18, fontWeight:'900' },
  rankLbl:      { fontSize:9, color:'#aaa', marginTop:1 },
  tabBar:       { flexDirection:'row', backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#EEE' },
  content:      { padding:14, paddingBottom:30 },
  bestDay:      { marginTop:10, backgroundColor:'#F0FFF4', borderRadius:8, padding:10 },
  bestDayTxt:   { fontSize:12, color:'#2E7D32', fontWeight:'700' },
  targetBarWrap:{ height:8, backgroundColor:'#E0E0E0', borderRadius:4, overflow:'hidden' },
  targetBar:    { height:8, borderRadius:4 },
  warnRow:      { flexDirection:'row', alignItems:'flex-start', gap:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  warnTxt:      { flex:1, fontSize:12, color:'#555', lineHeight:18 },
  hoursBar:     { flexDirection:'row', alignItems:'flex-end', height:100, marginTop:12, gap:4 },
  hourCol:      { flex:1, alignItems:'center', gap:2 },
  hourBar:      { width:'80%', borderRadius:3, minHeight:4 },
  hourVal:      { fontSize:9, color:'#888' },
  hourDay:      { fontSize:9, color:'#aaa', marginTop:2 },
  rankBig:      { alignItems:'center', paddingVertical:12 },
  rankNumber:   { fontSize:52, fontWeight:'900', color:COLORS.primary },
  rankOf:       { fontSize:13, color:'#888', marginTop:2 },
  rankRev:      { fontSize:16, fontWeight:'800', marginTop:4 },
  rankRow:      { flexDirection:'row', alignItems:'center', paddingVertical:8, gap:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  rankRowMe:    { backgroundColor:'#E8F5E9', borderRadius:8, paddingHorizontal:6 },
  rankPos:      { fontSize:16, width:30 },
  rankBranchName:{ fontSize:12, fontWeight:'700', color:'#333' },
  rankBarWrap:  { height:4, backgroundColor:'#EEE', borderRadius:2, marginTop:3, overflow:'hidden' },
  rankBarFill:  { height:4, borderRadius:2 },
  rankVal:      { fontSize:12, fontWeight:'800', color:'#555', width:50, textAlign:'right' },
  staffRow:     { flexDirection:'row', alignItems:'center', paddingVertical:6, gap:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  staffDate:    { fontSize:11, color:'#888', width:80 },
  staffBarWrap: { flex:1, height:8, backgroundColor:'#EEE', borderRadius:4, overflow:'hidden' },
  staffBar:     { height:8, backgroundColor:'#1565C0', borderRadius:4 },
  staffHrs:     { fontSize:12, fontWeight:'700', color:'#333', width:28, textAlign:'right' },
  staffRev:     { fontSize:11, color:COLORS.primary, fontWeight:'700', width:45, textAlign:'right' },
  emptyTxt:     { color:'#aaa', fontSize:13, textAlign:'center', padding:16 },
});
