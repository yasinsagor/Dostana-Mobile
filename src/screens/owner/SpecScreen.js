import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

const PERIODS = [
  { label: 'Today', key: 'today' },
  { label: '7 Days', key: 'week' },
  { label: 'Month', key: 'month' },
  { label: 'All Time', key: 'all' },
];

function pad(n) { return String(n).padStart(2,'0'); }
function fmtK(n) { if (!n&&n!==0) return '0'; if (Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }
function fmtPct(n) { return n.toFixed(1)+'%'; }
function todayStr() { return new Date().toISOString().slice(0,10); }

function getRange(key) {
  const now = new Date();
  const to = todayStr();
  if (key==='today') return { from: to, to };
  if (key==='week') { const d=new Date(now); d.setDate(d.getDate()-6); return { from:d.toISOString().slice(0,10), to }; }
  if (key==='month') { const d=new Date(now.getFullYear(),now.getMonth(),1); return { from:d.toISOString().slice(0,10), to }; }
  return { from:'2020-01-01', to };
}

function extractItems(items) {
  if (!items) return {};
  let obj = items;
  if (typeof items==='string') { try { obj=JSON.parse(items); } catch { return {}; } }
  if (Array.isArray(obj)) return obj.reduce((acc,i) => { const k=i.name||i.productName||i.product||'Item'; acc[k]=(acc[k]||0)+Number(i.qty??i.quantity??i.amount??0); return acc; },{});
  if (typeof obj==='object') return {...obj};
  return {};
}

function lastWeekRange() {
  const now = new Date();
  const to = new Date(now); to.setDate(to.getDate()-7);
  const from = new Date(now); from.setDate(from.getDate()-13);
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export default function OwnerSpecScreen() {
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [specOrders, setSpecOrders] = useState([]);
  const [prevSpecOrders, setPrevSpecOrders] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [expandedBranch, setExpandedBranch] = useState(null);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [filterBranch, setFilterBranch] = useState('All');

  const load = useCallback(async (p=period) => {
    try {
      const { from, to } = getRange(p);
      const lw = lastWeekRange();
      const [spRes, prevRes, daily] = await Promise.all([
        supabase.from('spec_orders').select('*').gte('date',from).lte('date',to).order('date',{ascending:false}),
        supabase.from('spec_orders').select('*').gte('date',lw.from).lte('date',lw.to),
        fetchAllDailyReports(from, to),
      ]);
      setSpecOrders(spRes.data||[]);
      setPrevSpecOrders(prevRes.data||[]);
      setDailyReports(daily||[]);
    } catch(e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [period]);

  useEffect(() => { setLoading(true); load(period); }, [period]);

  const today = todayStr();

  // Aggregate all items
  const allItems = {};
  specOrders.forEach(o => {
    const items = extractItems(o.items);
    Object.entries(items).forEach(([k,v]) => { allItems[k]=(allItems[k]||0)+Number(v)||0; });
  });
  const prevItems = {};
  prevSpecOrders.forEach(o => {
    const items = extractItems(o.items);
    Object.entries(items).forEach(([k,v]) => { prevItems[k]=(prevItems[k]||0)+Number(v)||0; });
  });

  const totalSpecCost = specOrders.reduce((s,o) => s+(o.total_cost||o.total||0), 0);
  const totalRevenue = dailyReports.reduce((s,r) => s+(r.total_revenue||r.revenue||0), 0);
  const avgFoodCost = totalRevenue>0 ? totalSpecCost/totalRevenue*100 : 0;
  const branchesTodayOrdered = new Set(specOrders.filter(o=>o.date===today).map(o=>o.branch)).size;

  const chickenQty = Object.entries(allItems).filter(([k])=>/kurczak|chicken/i.test(k)).reduce((s,[,v])=>s+v,0);
  const lambQty = Object.entries(allItems).filter(([k])=>/baranina|lamb/i.test(k)).reduce((s,[,v])=>s+v,0);

  // Per-branch SPEC stats
  const branchSpec = BRANCHES.map(b => {
    const bOrders = specOrders.filter(o=>o.branch===b.name);
    const bPrev = prevSpecOrders.filter(o=>o.branch===b.name);
    const bRevenue = dailyReports.filter(r=>r.branch===b.name).reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
    const bCost = bOrders.reduce((s,o)=>s+(o.total_cost||o.total||0),0);
    const prevCost = bPrev.reduce((s,o)=>s+(o.total_cost||o.total||0),0);
    const bItems = {};
    bOrders.forEach(o => { const items=extractItems(o.items); Object.entries(items).forEach(([k,v])=>{bItems[k]=(bItems[k]||0)+Number(v);}); });
    const bChicken = Object.entries(bItems).filter(([k])=>/kurczak|chicken/i.test(k)).reduce((s,[,v])=>s+v,0);
    const bLamb = Object.entries(bItems).filter(([k])=>/baranina|lamb/i.test(k)).reduce((s,[,v])=>s+v,0);
    const foodPct = bRevenue>0 ? bCost/bRevenue*100 : 0;
    const orderedToday = bOrders.some(o=>o.date===today);
    const orderCount = bOrders.length;
    const costGrowth = prevCost>0 ? (bCost-prevCost)/prevCost*100 : null;
    return { name:b.name, bOrders, bCost, prevCost, costGrowth, bRevenue, foodPct, bChicken, bLamb, orderedToday, orderCount };
  }).filter(b=>b.orderCount>0||period==='today').sort((a,b)=>b.bCost-a.bCost);

  // SPEC Alerts
  const avgBranchCost = branchSpec.filter(b=>b.bCost>0).reduce((s,b)=>s+b.bCost,0)/Math.max(branchSpec.filter(b=>b.bCost>0).length,1);
  const alerts = [];
  if (period==='today'||period==='week') {
    const missing = BRANCHES.filter(b=>!specOrders.some(o=>o.branch===b.name&&o.date===today));
    if (missing.length>0) alerts.push({ kind:'warn', msg:`No order today: ${missing.slice(0,3).map(b=>b.name).join(', ')}${missing.length>3?` +${missing.length-3} more`:''}` });
  }
  branchSpec.forEach(b => {
    if (b.costGrowth!==null&&b.costGrowth>35) alerts.push({ kind:'error', msg:`${b.name}: SPEC cost +${b.costGrowth.toFixed(0)}% vs previous period` });
    if (b.foodPct>15&&b.bRevenue>0) alerts.push({ kind:'error', msg:`${b.name}: Food cost ${fmtPct(b.foodPct)} — above 15% threshold` });
  });
  // Duplicate orders same day
  const ordersByDay = {};
  specOrders.forEach(o => { const k=`${o.branch}_${o.date}`; ordersByDay[k]=(ordersByDay[k]||0)+1; });
  Object.entries(ordersByDay).filter(([,v])=>v>1).forEach(([k])=>{
    const [branch,date]=k.split('_');
    alerts.push({ kind:'warn', msg:`Duplicate order: ${branch} on ${date}` });
  });

  // Product analytics — top products
  const sortedProducts = Object.entries(allItems).sort((a,b)=>b[1]-a[1]);
  const prevTopItems = Object.entries(prevItems).sort((a,b)=>b[1]-a[1]);

  // Calendar — last 14 days
  const calDays = Array.from({length:14},(_,i)=>{
    const d=new Date(); d.setDate(d.getDate()-(13-i));
    return d.toISOString().slice(0,10);
  });
  const calOrders = {};
  specOrders.forEach(o => { if(!calOrders[o.date]) calOrders[o.date]=[]; calOrders[o.date].push(o.branch); });

  const filtered = filterBranch==='All' ? specOrders : specOrders.filter(o=>o.branch===filterBranch);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color="#7B1FA2"/></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);load(period);}} colors={['#7B1FA2']}/>}
      >
        <Text style={s.pageTitle}>SPEC Center</Text>

        {/* Period pills */}
        <View style={s.pillRow}>
          {PERIODS.map(p=>(
            <TouchableOpacity key={p.key} onPress={()=>setPeriod(p.key)} style={[s.pill, period===p.key&&s.pillOn]}>
              <Text style={[s.pillTxt, period===p.key&&s.pillTxtOn]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. SUMMARY CARDS */}
        <Text style={s.secTitle}>📦 SPEC Summary</Text>
        <View style={s.grid3}>
          <View style={[s.sumCard,{backgroundColor:'#F3E5F5'}]}><Text style={s.sumVal}>{specOrders.length}</Text><Text style={s.sumLbl}>Total Orders</Text></View>
          <View style={[s.sumCard,{backgroundColor:'#E8F5E9'}]}><Text style={s.sumVal}>{chickenQty>0?chickenQty+'kg':'—'}</Text><Text style={s.sumLbl}>Chicken</Text></View>
          <View style={[s.sumCard,{backgroundColor:'#FFF3E0'}]}><Text style={s.sumVal}>{lambQty>0?lambQty+'kg':'—'}</Text><Text style={s.sumLbl}>Lamb</Text></View>
          <View style={[s.sumCard,{backgroundColor:'#E3F2FD'}]}><Text style={[s.sumVal,{color:'#1565C0'}]}>{fmtK(totalSpecCost)} PLN</Text><Text style={s.sumLbl}>Total Cost</Text></View>
          <View style={[s.sumCard,{backgroundColor:avgFoodCost>15?'#FFEBEE':avgFoodCost>10?'#FFF8E1':'#E8F5E9'}]}>
            <Text style={[s.sumVal,{color:avgFoodCost>15?COLORS.danger:avgFoodCost>10?COLORS.warning:COLORS.primary}]}>{avgFoodCost>0?fmtPct(avgFoodCost):'—'}</Text>
            <Text style={s.sumLbl}>Avg Food Cost %</Text>
          </View>
          <View style={[s.sumCard,{backgroundColor:'#F3E5F5'}]}><Text style={[s.sumVal,{color:'#7B1FA2'}]}>{branchesTodayOrdered}/{BRANCHES.length}</Text><Text style={s.sumLbl}>Ordered Today</Text></View>
        </View>

        {/* 2. ALERTS */}
        {alerts.length>0&&(
          <>
            <Text style={s.secTitle}>🚨 SPEC Alerts</Text>
            {alerts.map((a,i)=>(
              <View key={i} style={[s.alertCard, a.kind==='error'?s.alertError:s.alertWarn]}>
                <Text style={s.alertIcon}>{a.kind==='error'?'🔴':'⚠️'}</Text>
                <Text style={[s.alertTxt, a.kind==='error'?{color:'#B71C1C'}:{color:'#E65100'}]} numberOfLines={2}>{a.msg}</Text>
              </View>
            ))}
          </>
        )}

        {/* 3. REVENUE vs SPEC TABLE */}
        <Text style={s.secTitle}>📈 Revenue vs SPEC Cost</Text>
        <View style={s.card}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View>
              <View style={[s.tableRow,s.tableHead]}>
                {['Branch','Revenue','SPEC Cost','Food %','Status'].map(h=>(
                  <Text key={h} style={[s.tcell,s.theadTxt]}>{h}</Text>
                ))}
              </View>
              {branchSpec.filter(b=>b.bRevenue>0||b.bCost>0).sort((a,b)=>b.bRevenue-a.bRevenue).map((b,i)=>{
                const flag = b.foodPct===0?'—':b.foodPct<=10?'✅':b.foodPct<=15?'⚠️':'🔴';
                return (
                  <View key={b.name} style={[s.tableRow,i%2===0&&{backgroundColor:'#FAFAFA'}]}>
                    <Text style={[s.tcell,{fontWeight:'700',fontSize:11}]} numberOfLines={1}>{b.name.split(' ')[0]}</Text>
                    <Text style={s.tcell}>{fmtK(b.bRevenue)}</Text>
                    <Text style={[s.tcell,{color:'#7B1FA2'}]}>{fmtK(b.bCost)}</Text>
                    <Text style={s.tcell}>{b.foodPct>0?fmtPct(b.foodPct):'—'}</Text>
                    <Text style={s.tcell}>{flag}</Text>
                  </View>
                );
              })}
              {branchSpec.filter(b=>b.bRevenue>0||b.bCost>0).length===0&&(
                <View style={{padding:16}}><Text style={{color:'#aaa',fontSize:13}}>No data for this period</Text></View>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 4. PRODUCT ANALYTICS */}
        {sortedProducts.length>0&&(
          <>
            <Text style={s.secTitle}>🍗 Product Consumption</Text>
            <View style={s.card}>
              {sortedProducts.slice(0,8).map(([name,qty],i)=>{
                const prev = prevItems[name]||0;
                const growth = prev>0?(qty-prev)/prev*100:null;
                const maxQty = sortedProducts[0][1]||1;
                return (
                  <View key={name} style={s.productRow}>
                    <View style={{width:22,alignItems:'center'}}><Text style={s.prodRank}>#{i+1}</Text></View>
                    <View style={{flex:1,marginLeft:8}}>
                      <View style={{flexDirection:'row',justifyContent:'space-between',marginBottom:4}}>
                        <Text style={s.prodName}>{name}</Text>
                        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                          {growth!==null&&<Text style={[s.growthBadge,{color:growth>=0?COLORS.primary:COLORS.danger}]}>{growth>=0?'+':''}{growth.toFixed(0)}%</Text>}
                          <Text style={s.prodQty}>{qty} units</Text>
                        </View>
                      </View>
                      <View style={s.prodBarBg}><View style={[s.prodBarFill,{width:(qty/maxQty*100)+'%'}]}/></View>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* 5. BRANCH COMPARISON */}
        <Text style={s.secTitle}>🏪 Branch SPEC Comparison</Text>
        {branchSpec.filter(b=>b.bCost>0).map(b=>{
          const effLabel = b.foodPct===0?'No data':b.foodPct<=8?'Excellent':b.foodPct<=12?'Efficient':b.foodPct<=15?'Monitor':'Over-ordering';
          const effColor = b.foodPct===0?'#aaa':b.foodPct<=8?COLORS.primary:b.foodPct<=12?'#43A047':b.foodPct<=15?COLORS.warning:COLORS.danger;
          return (
            <View key={b.name} style={s.branchCard}>
              <View style={{flexDirection:'row',alignItems:'center',marginBottom:8}}>
                <View style={[s.effDot,{backgroundColor:effColor}]}/>
                <Text style={s.branchName}>{b.name}</Text>
                <View style={[s.effBadge,{backgroundColor:effColor+'22'}]}>
                  <Text style={[s.effTxt,{color:effColor}]}>{effLabel}</Text>
                </View>
                {b.orderedToday&&<Text style={s.todayBadge}> ✅ Today</Text>}
              </View>
              <View style={s.bGrid}>
                <View style={s.bStat}><Text style={s.bStatVal}>{fmtK(b.bCost)} PLN</Text><Text style={s.bStatLbl}>SPEC Total</Text></View>
                <View style={s.bStat}><Text style={[s.bStatVal,{color:b.foodPct>15?COLORS.danger:b.foodPct>10?COLORS.warning:COLORS.primary}]}>{b.foodPct>0?fmtPct(b.foodPct):'—'}</Text><Text style={s.bStatLbl}>Food Cost %</Text></View>
                <View style={s.bStat}><Text style={s.bStatVal}>{b.bChicken>0?b.bChicken+'kg':'—'}</Text><Text style={s.bStatLbl}>Chicken</Text></View>
                <View style={s.bStat}><Text style={s.bStatVal}>{b.bLamb>0?b.bLamb+'kg':'—'}</Text><Text style={s.bStatLbl}>Lamb</Text></View>
              </View>
              {b.costGrowth!==null&&(
                <View style={[s.growthRow,{backgroundColor:b.costGrowth>20?'#FFEBEE':'#E8F5E9'}]}>
                  <Text style={[s.growthTxt,{color:b.costGrowth>20?COLORS.danger:COLORS.primary}]}>
                    {b.costGrowth>=0?'📈':'📉'} Cost {b.costGrowth>=0?'+':''}{b.costGrowth.toFixed(0)}% vs previous period
                  </Text>
                </View>
              )}
            </View>
          );
        })}
        {branchSpec.filter(b=>b.bCost>0).length===0&&<View style={s.empty}><Text style={s.emptyTxt}>No orders in this period</Text></View>}

        {/* 6. ORDERING CALENDAR (last 14 days) */}
        <Text style={s.secTitle}>📅 Ordering Calendar (Last 14 Days)</Text>
        <View style={s.card}>
          <View style={s.calGrid}>
            {calDays.map(date=>{
              const orders = calOrders[date]||[];
              const isToday = date===today;
              return (
                <View key={date} style={[s.calCell,isToday&&s.calCellToday]}>
                  <Text style={[s.calDay,isToday&&{color:'#7B1FA2',fontWeight:'800'}]}>{new Date(date+'T12:00:00').getDate()}</Text>
                  {orders.length>0
                    ? <View style={s.calDot}><Text style={s.calCount}>{orders.length}</Text></View>
                    : <View style={[s.calDot,{backgroundColor:'#eee'}]}><Text style={[s.calCount,{color:'#ccc'}]}>—</Text></View>
                  }
                </View>
              );
            })}
          </View>
          <Text style={{fontSize:11,color:'#aaa',textAlign:'center',marginTop:8}}>Number = branches that ordered that day</Text>
        </View>

        {/* 7. COST ANALYTICS */}
        {sortedProducts.length>0&&(
          <>
            <Text style={s.secTitle}>💵 Cost Analytics</Text>
            <View style={s.card}>
              <View style={[s.tableRow,s.tableHead]}>
                {['Product','Qty','Est. Cost'].map(h=>(
                  <Text key={h} style={[s.tcell,s.theadTxt,{flex:1}]}>{h}</Text>
                ))}
              </View>
              {sortedProducts.slice(0,6).map(([name,qty])=>{
                const isChicken = /kurczak|chicken/i.test(name);
                const isLamb = /baranina|lamb/i.test(name);
                const unitCost = isChicken?25:isLamb?50:5;
                const estCost = qty*unitCost;
                return (
                  <View key={name} style={s.tableRow}>
                    <Text style={[s.tcell,{flex:1,fontWeight:'600'}]} numberOfLines={1}>{name}</Text>
                    <Text style={[s.tcell,{flex:1}]}>{qty}</Text>
                    <Text style={[s.tcell,{flex:1,color:'#7B1FA2',fontWeight:'700'}]}>~{fmtK(estCost)} PLN</Text>
                  </View>
                );
              })}
              <View style={{marginTop:8,padding:8,backgroundColor:'#F3E5F5',borderRadius:8}}>
                <Text style={{fontSize:12,color:'#7B1FA2',fontWeight:'600'}}>Total SPEC cost: {fmtK(totalSpecCost)} PLN · Food cost: {avgFoodCost>0?fmtPct(avgFoodCost):'—'}</Text>
              </View>
            </View>
          </>
        )}

        {/* 8. SUPPLIER EXPORT */}
        <Text style={s.secTitle}>📤 Supplier Operations</Text>
        <View style={s.card}>
          <Text style={{fontSize:13,color:'#888',marginBottom:12}}>Export order summaries for your supplier.</Text>
          <View style={{flexDirection:'row',gap:10,flexWrap:'wrap'}}>
            {['📋 Daily Dispatch','📊 Weekly Summary','📦 Branch Report'].map(lbl=>(
              <TouchableOpacity key={lbl} style={s.exportBtn} onPress={()=>Alert.alert('Coming Soon','Export feature will be available in the next update.')}>
                <Text style={s.exportTxt}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 9. ORDER HISTORY with filter */}
        <Text style={s.secTitle}>🔍 Order History</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:10}}>
          {['All',...BRANCHES.map(b=>b.name)].map(br=>(
            <TouchableOpacity key={br} onPress={()=>setFilterBranch(br)} style={[s.pill,filterBranch===br&&s.pillOn,{marginBottom:0}]}>
              <Text style={[s.pillTxt,filterBranch===br&&s.pillTxtOn]} numberOfLines={1}>{br==='All'?'All':br.split(' ')[0]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {filtered.slice(0,20).map((o,i)=>{
          const items = extractItems(o.items);
          const isExp = expandedOrder===o.id;
          const cost = o.total_cost||o.total||0;
          return (
            <TouchableOpacity key={o.id||i} onPress={()=>setExpandedOrder(p=>p===o.id?null:o.id)} style={s.orderCard} activeOpacity={0.8}>
              <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
                <View>
                  <Text style={s.orderBranch}>{o.branch}</Text>
                  <Text style={s.orderDate}>{o.date}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                  {cost>0&&<Text style={s.orderCost}>{fmtK(cost)} PLN</Text>}
                  <Text style={s.chevron}>{isExp?'▲':'▼'}</Text>
                </View>
              </View>
              {isExp&&Object.entries(items).length>0&&(
                <View style={{marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:'#f0f0f0'}}>
                  {Object.entries(items).map(([k,v])=>(
                    <View key={k} style={{flexDirection:'row',justifyContent:'space-between',paddingVertical:3}}>
                      <Text style={{fontSize:13,color:'#333'}}>{k}</Text>
                      <Text style={{fontSize:13,fontWeight:'700',color:'#7B1FA2'}}>{v} units</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
        {filtered.length===0&&<View style={s.empty}><Text style={s.emptyTxt}>No orders found</Text></View>}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  content:{padding:16,paddingBottom:50},
  pageTitle:{fontSize:28,fontWeight:'800',color:'#111',marginBottom:12},
  pillRow:{flexDirection:'row',gap:8,marginBottom:4},
  pill:{paddingHorizontal:14,paddingVertical:7,borderRadius:20,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#ddd',marginRight:4},
  pillOn:{backgroundColor:'#7B1FA2',borderColor:'#7B1FA2'},
  pillTxt:{fontSize:12,fontWeight:'600',color:'#777'},
  pillTxtOn:{color:'#fff'},
  secTitle:{fontSize:15,fontWeight:'800',color:'#333',marginTop:20,marginBottom:10},
  grid3:{flexDirection:'row',flexWrap:'wrap',gap:10,marginBottom:4},
  sumCard:{width:'30%',flex:1,borderRadius:12,padding:12,alignItems:'center'},
  sumVal:{fontSize:17,fontWeight:'900',color:'#111',textAlign:'center'},
  sumLbl:{fontSize:10,color:'#777',marginTop:3,textAlign:'center'},
  alertCard:{flexDirection:'row',alignItems:'flex-start',borderRadius:10,padding:12,marginBottom:6,gap:8},
  alertError:{backgroundColor:'#FFEBEE'},
  alertWarn:{backgroundColor:'#FFF8E1'},
  alertIcon:{fontSize:15,marginTop:1},
  alertTxt:{flex:1,fontSize:13,lineHeight:19,fontWeight:'500'},
  card:{backgroundColor:'#fff',borderRadius:14,padding:14,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:4,elevation:2,marginBottom:4},
  tableRow:{flexDirection:'row',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  tableHead:{borderBottomWidth:2,borderBottomColor:'#eee'},
  tcell:{width:82,fontSize:12,color:'#333',paddingHorizontal:3},
  theadTxt:{fontWeight:'800',color:'#666',fontSize:11},
  productRow:{flexDirection:'row',alignItems:'center',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  prodRank:{fontSize:11,color:'#aaa',fontWeight:'700'},
  prodName:{fontSize:13,fontWeight:'600',color:'#222'},
  prodQty:{fontSize:13,fontWeight:'800',color:'#7B1FA2'},
  growthBadge:{fontSize:11,fontWeight:'700'},
  prodBarBg:{height:4,backgroundColor:'#eee',borderRadius:2,flex:1},
  prodBarFill:{height:'100%',backgroundColor:'#CE93D8',borderRadius:2},
  branchCard:{backgroundColor:'#fff',borderRadius:14,padding:14,marginBottom:8,shadowColor:'#000',shadowOpacity:0.05,shadowRadius:3,elevation:2},
  effDot:{width:10,height:10,borderRadius:5,marginRight:8},
  branchName:{flex:1,fontSize:14,fontWeight:'700',color:'#111'},
  effBadge:{borderRadius:6,paddingHorizontal:8,paddingVertical:3,marginLeft:6},
  effTxt:{fontSize:11,fontWeight:'700'},
  todayBadge:{fontSize:11,color:COLORS.primary,fontWeight:'700'},
  bGrid:{flexDirection:'row',marginTop:10,paddingTop:10,borderTopWidth:1,borderTopColor:'#f5f5f5'},
  bStat:{flex:1,alignItems:'center'},
  bStatVal:{fontSize:14,fontWeight:'800',color:'#111'},
  bStatLbl:{fontSize:10,color:'#aaa',marginTop:2},
  growthRow:{borderRadius:8,padding:8,marginTop:8},
  growthTxt:{fontSize:12,fontWeight:'600'},
  calGrid:{flexDirection:'row',flexWrap:'wrap',gap:6},
  calCell:{width:'12.5%',alignItems:'center',padding:4,borderRadius:8,backgroundColor:'#F8F8F8'},
  calCellToday:{backgroundColor:'#F3E5F5'},
  calDay:{fontSize:10,color:'#555',fontWeight:'600'},
  calDot:{width:22,height:22,borderRadius:11,backgroundColor:'#CE93D8',alignItems:'center',justifyContent:'center',marginTop:3},
  calCount:{fontSize:10,fontWeight:'800',color:'#7B1FA2'},
  exportBtn:{backgroundColor:'#F3E5F5',borderRadius:10,paddingHorizontal:14,paddingVertical:10},
  exportTxt:{fontSize:12,fontWeight:'700',color:'#7B1FA2'},
  orderCard:{backgroundColor:'#fff',borderRadius:12,padding:14,marginBottom:8,borderLeftWidth:3,borderLeftColor:'#CE93D8',shadowColor:'#000',shadowOpacity:0.04,shadowRadius:3,elevation:1},
  orderBranch:{fontSize:14,fontWeight:'700',color:'#111'},
  orderDate:{fontSize:11,color:'#aaa',marginTop:2},
  orderCost:{fontSize:13,fontWeight:'800',color:'#7B1FA2'},
  chevron:{fontSize:11,color:'#aaa',marginTop:2},
  empty:{padding:30,alignItems:'center'},
  emptyTxt:{color:'#aaa',fontSize:14},
});
