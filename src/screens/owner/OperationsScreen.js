import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

function todayStr() { return new Date().toISOString().slice(0,10); }
function daysAgoStr(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function fmtK(n) { if(!n&&n!==0) return '0'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return Math.round(n).toString(); }
function timeAgo(iso) {
  if (!iso) return '—';
  const diff = Math.floor((Date.now()-new Date(iso))/60000);
  if (diff<1) return 'just now'; if (diff<60) return diff+'m ago';
  const h=Math.floor(diff/60); if (h<24) return h+'h ago';
  return Math.floor(h/24)+'d ago';
}

function SectionHeader({ icon, title, open, onPress, color='#333' }) {
  return (
    <TouchableOpacity style={[sec.header,{borderLeftColor:color}]} onPress={onPress} activeOpacity={0.7}>
      <Text style={sec.icon}>{icon}</Text>
      <Text style={[sec.title,{color}]}>{title}</Text>
      <Text style={sec.chevron}>{open?'▲':'▼'}</Text>
    </TouchableOpacity>
  );
}
function ToolBtn({ icon, label, sub, onPress, color='#333', bg='#F5F5F5' }) {
  return (
    <TouchableOpacity style={[sec.toolBtn,{backgroundColor:bg}]} onPress={onPress} activeOpacity={0.75}>
      <Text style={sec.toolIcon}>{icon}</Text>
      <View style={{flex:1}}>
        <Text style={[sec.toolLabel,{color}]}>{label}</Text>
        {sub?<Text style={sec.toolSub}>{sub}</Text>:null}
      </View>
      <Text style={sec.toolArrow}>›</Text>
    </TouchableOpacity>
  );
}

const sec = StyleSheet.create({
  header:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',padding:16,borderRadius:14,marginBottom:2,borderLeftWidth:4,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:3,elevation:2},
  icon:{fontSize:20,marginRight:12},
  title:{flex:1,fontSize:15,fontWeight:'800',color:'#333'},
  chevron:{fontSize:12,color:'#aaa'},
  toolBtn:{flexDirection:'row',alignItems:'center',borderRadius:12,padding:14,marginBottom:6,gap:12},
  toolIcon:{fontSize:20,width:28},
  toolLabel:{fontSize:14,fontWeight:'700'},
  toolSub:{fontSize:11,color:'#999',marginTop:1},
  toolArrow:{fontSize:18,color:'#ccc',marginLeft:4},
});

export default function OwnerOperationsScreen() {
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [cfRecent, setCfRecent] = useState([]);
  const [specRecent, setSpecRecent] = useState([]);
  const [notif, setNotif] = useState(true);
  const [open, setOpen] = useState({ reports:false, supplier:false, branches:true, managers:false, data:false, automation:false, partners:false, exports:false, audit:false });
  const toggle = k => setOpen(p=>({...p,[k]:!p[k]}));
  const soon = (f='') => Alert.alert('Coming Soon', (f?f+' — ':'')+'This feature will be available in the next update.');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = daysAgoStr(29);
      const to = todayStr();
      const [dr, { data:cf }, { data:sp }] = await Promise.all([
        fetchAllDailyReports(from, to),
        supabase.from('cashflow_reports').select('id,branch,date,created_at,total_expenses').gte('date',from).lte('date',to).order('created_at',{ascending:false}),
        supabase.from('spec_orders').select('id,branch,date,created_at').gte('date',from).lte('date',to).order('created_at',{ascending:false}),
      ]);
      setRecentReports(dr||[]);
      setCfRecent(cf||[]);
      setSpecRecent(sp||[]);
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(()=>{ load(); },[load]);

  const mgr30 = BRANCHES.map(b => {
    const bDR = recentReports.filter(r=>r.branch===b.name);
    const last = bDR[0];
    return { name:b.name, pin:b.pin, count:bDR.length, lastDate:last?.date, lastAt:last?.created_at, revenue:bDR.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0) };
  });

  const auditLog = [
    ...recentReports.map(r=>({ type:'📋 Daily', branch:r.branch, date:r.date, at:r.created_at, detail:`Rev: ${fmtK(r.total_revenue||r.revenue||0)} PLN` })),
    ...cfRecent.map(r=>({ type:'💸 CF', branch:r.branch, date:r.date, at:r.created_at, detail:`Exp: ${fmtK(r.total_expenses||0)} PLN` })),
    ...specRecent.map(r=>({ type:'📦 SPEC', branch:r.branch, date:r.date, at:r.created_at, detail:'' })),
  ].sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,25);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.pageHeader}>
        <Text style={s.pageTitle}>🛠 Operations & Tools</Text>
        <Text style={s.pageSub}>Business management utilities for {BRANCHES.length} branches</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>

        {/* ── 1. REPORTS ── */}
        <SectionHeader icon="📄" title="Reports Center" color="#1565C0" open={open.reports} onPress={()=>toggle('reports')}/>
        {open.reports&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="📊" label="Monthly PDF Report" sub="Chain summary, branch breakdown, comparisons" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Monthly PDF')}/>
            <ToolBtn icon="📈" label="Weekly Performance Report" sub="Last 7 days across all branches" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Weekly Report')}/>
            <ToolBtn icon="🏪" label="Branch Report" sub="Individual branch deep-dive" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Branch Report')}/>
            <ToolBtn icon="📦" label="SPEC / Food Cost Report" sub="Supplier orders and food cost analysis" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('SPEC Report')}/>
            <ToolBtn icon="💰" label="Profit & Loss Report" sub="Revenue, expenses, estimated profit" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('P&L Report')}/>
            <ToolBtn icon="👨‍🍳" label="Labor Hours Report" sub="Hours by branch, PLN/hr efficiency" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Labor Report')}/>
          </View>
        )}

        {/* ── 2. SUPPLIER TOOLS ── */}
        <SectionHeader icon="📦" title="Supplier Tools" color="#6A1B9A" open={open.supplier} onPress={()=>toggle('supplier')}/>
        {open.supplier&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="🌐" label="Open Supplier Page" sub="Direct link to supplier portal" bg="#F3E5F5" color="#6A1B9A" onPress={()=>soon('Supplier Page')}/>
            <ToolBtn icon="📋" label="Export SPEC Summary" sub="Today's consolidated order list" bg="#F3E5F5" color="#6A1B9A" onPress={()=>soon('SPEC Export')}/>
            <ToolBtn icon="🚚" label="Generate Delivery Sheet" sub="Dispatch order for supplier" bg="#F3E5F5" color="#6A1B9A" onPress={()=>soon('Delivery Sheet')}/>
            <ToolBtn icon="📦" label="Consolidated Supplier Order" sub="All branches combined for bulk order" bg="#F3E5F5" color="#6A1B9A" onPress={()=>soon('Consolidated Order')}/>
            <ToolBtn icon="🖨️" label="Print Warehouse Order" sub="Formatted warehouse pick list" bg="#F3E5F5" color="#6A1B9A" onPress={()=>soon('Warehouse Order')}/>
          </View>
        )}

        {/* ── 3. BRANCH MANAGEMENT ── */}
        <SectionHeader icon="🏪" title="Branch Management" color={COLORS.primary} open={open.branches} onPress={()=>toggle('branches')}/>
        {open.branches&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="➕" label="Add New Branch" sub="Register a new location" bg="#E8F5E9" color={COLORS.primary} onPress={()=>soon('Add Branch')}/>
            <ToolBtn icon="🔑" label="Change Manager PIN" sub="Update branch manager access code" bg="#E8F5E9" color={COLORS.primary} onPress={()=>soon('Change PIN')}/>
            <ToolBtn icon="⏰" label="Branch Hours" sub="Set opening and closing times" bg="#E8F5E9" color={COLORS.primary} onPress={()=>soon('Branch Hours')}/>
            <View style={s.branchList}>
              {BRANCHES.map((b,i)=>(
                <View key={b.name} style={s.branchRow}>
                  <View style={[s.branchDot,{backgroundColor:COLORS.primary}]}/>
                  <View style={{flex:1}}>
                    <Text style={s.branchName}>{b.name}</Text>
                    <Text style={s.branchPin}>PIN: {b.pin}</Text>
                  </View>
                  <Text style={s.branchIdx}>#{i+1}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── 4. MANAGER PERFORMANCE ── */}
        <SectionHeader icon="👨‍🍳" title="Manager Performance (30 days)" color="#E65100" open={open.managers} onPress={()=>toggle('managers')}/>
        {open.managers&&(
          <View style={s.sectionBody}>
            {mgr30.sort((a,b)=>b.count-a.count).map(m=>(
              <View key={m.name} style={s.mgrCard}>
                <View style={{flexDirection:'row',alignItems:'center',marginBottom:6}}>
                  <View style={[s.branchDot,{backgroundColor:m.count>=20?COLORS.primary:m.count>=10?COLORS.warning:COLORS.danger}]}/>
                  <Text style={s.mgrName}>{m.name}</Text>
                  <Text style={s.mgrPin}>PIN {m.pin}</Text>
                </View>
                <View style={{flexDirection:'row'}}>
                  <View style={s.mgrStat}><Text style={s.mgrStatVal}>{m.count}</Text><Text style={s.mgrStatLbl}>Reports</Text></View>
                  <View style={s.mgrStat}><Text style={[s.mgrStatVal,{color:COLORS.primary}]}>{fmtK(m.revenue)} PLN</Text><Text style={s.mgrStatLbl}>Revenue</Text></View>
                  <View style={s.mgrStat}><Text style={s.mgrStatVal}>{m.lastDate||'—'}</Text><Text style={s.mgrStatLbl}>Last Report</Text></View>
                </View>
              </View>
            ))}
            <ToolBtn icon="🔁" label="Reset Manager PIN" sub="Requires owner confirmation" bg="#FFF3E0" color="#E65100" onPress={()=>soon('PIN Reset')}/>
          </View>
        )}

        {/* ── 5. DATA TOOLS ── */}
        <SectionHeader icon="📊" title="Data Tools" color="#00695C" open={open.data} onPress={()=>toggle('data')}/>
        {open.data&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="🔄" label="Sync with Supabase" sub="Force refresh all data from server" bg="#E0F2F1" color="#00695C" onPress={()=>{ load(); Alert.alert('Synced','Data refreshed from Supabase.'); }}/>
            <ToolBtn icon="💾" label="Backup Data" sub="Export full dataset snapshot" bg="#E0F2F1" color="#00695C" onPress={()=>soon('Backup')}/>
            <ToolBtn icon="🔍" label="Recover Missing CF" sub="Find daily reports without cashflow" bg="#E0F2F1" color="#00695C" onPress={()=>soon('CF Recovery')}/>
            <ToolBtn icon="📐" label="Recalculate Analytics" sub="Rebuild all performance scores" bg="#E0F2F1" color="#00695C" onPress={()=>soon('Recalculate')}/>
          </View>
        )}

        {/* ── 6. AUTOMATION ── */}
        <SectionHeader icon="🔔" title="Automation Tools" color="#F9A825" open={open.automation} onPress={()=>toggle('automation')}/>
        {open.automation&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="📨" label="Send Reminder to Managers" sub="Push notification to all active branches" bg="#FFFDE7" color="#F9A825" onPress={()=>soon('Send Reminder')}/>
            <ToolBtn icon="📦" label="SPEC Order Reminder" sub="Remind branches to submit SPEC" bg="#FFFDE7" color="#F9A825" onPress={()=>soon('SPEC Reminder')}/>
            <ToolBtn icon="📋" label="Missing Report Alert" sub="Notify branches with no daily report" bg="#FFFDE7" color="#F9A825" onPress={()=>soon('Missing Alert')}/>
            <ToolBtn icon="📊" label="Daily Summary Export" sub="Auto-generate end-of-day report" bg="#FFFDE7" color="#F9A825" onPress={()=>soon('Daily Export')}/>
            <View style={s.notifRow}>
              <Text style={s.notifLbl}>Push Notifications</Text>
              <Switch value={notif} onValueChange={setNotif} trackColor={{true:COLORS.primary}}/>
            </View>
          </View>
        )}

        {/* ── 7. PARTNER / INVESTOR ── */}
        <SectionHeader icon="💰" title="Partner & Investor" color="#AD1457" open={open.partners} onPress={()=>toggle('partners')}/>
        {open.partners&&(
          <View style={s.sectionBody}>
            <View style={s.partnerCard}>
              <Text style={s.partnerTitle}>Profit Share Calculator</Text>
              <Text style={s.partnerSub}>Configure partner share percentages per branch or chain-wide to estimate monthly payouts.</Text>
              <ToolBtn icon="⚙️" label="Configure Partners" sub="Set share % per investor/partner" bg="#FCE4EC" color="#AD1457" onPress={()=>soon('Partner Config')}/>
              <ToolBtn icon="📊" label="Monthly Payout Estimate" sub="Calculated from estimated profit" bg="#FCE4EC" color="#AD1457" onPress={()=>soon('Payout Report')}/>
              <ToolBtn icon="📤" label="Investor Report" sub="PDF summary for shareholders" bg="#FCE4EC" color="#AD1457" onPress={()=>soon('Investor Report')}/>
            </View>
          </View>
        )}

        {/* ── 8. ADVANCED EXPORTS ── */}
        <SectionHeader icon="📤" title="Advanced Exports" color="#1565C0" open={open.exports} onPress={()=>toggle('exports')}/>
        {open.exports&&(
          <View style={s.sectionBody}>
            <ToolBtn icon="📊" label="Excel Export" sub="Full data in spreadsheet format" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Excel Export')}/>
            <ToolBtn icon="📋" label="Accountant CSV" sub="Formatted for accounting software" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Accountant CSV')}/>
            <ToolBtn icon="🧾" label="Tax Preparation Export" sub="Expense and revenue for tax filing" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Tax Export')}/>
            <ToolBtn icon="📄" label="Full Chain Statement" sub="Complete financial statement PDF" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('Chain Statement')}/>
            <ToolBtn icon="🏦" label="ZUS / Accounting Export" sub="Polish accounting format" bg="#E3F2FD" color="#1565C0" onPress={()=>soon('ZUS Export')}/>
          </View>
        )}

        {/* ── 9. AUDIT LOG ── */}
        <SectionHeader icon="🚨" title="Audit & Activity Log (30 days)" color={COLORS.danger} open={open.audit} onPress={()=>toggle('audit')}/>
        {open.audit&&(
          <View style={s.sectionBody}>
            <Text style={s.auditNote}>All submissions in the last 30 days. Unusual patterns may indicate editing, duplicate entries, or missing data.</Text>
            {auditLog.map((a,i)=>(
              <View key={i} style={s.auditRow}>
                <Text style={s.auditType}>{a.type}</Text>
                <View style={{flex:1}}>
                  <Text style={s.auditBranch}>{a.branch}</Text>
                  <Text style={s.auditDetail}>{a.date} · {a.detail}</Text>
                </View>
                <Text style={s.auditTime}>{timeAgo(a.at)}</Text>
              </View>
            ))}
            {auditLog.length===0&&<Text style={s.emptyTxt}>No activity in the last 30 days</Text>}
            <ToolBtn icon="🔍" label="Deep Audit Report" sub="Flag suspicious edits and duplicates" bg="#FFEBEE" color={COLORS.danger} onPress={()=>soon('Deep Audit')}/>
          </View>
        )}

        <Text style={s.footer}>Dostana Kebab Management · v1.0.0 · Powered by Supabase</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'},
  center:{flex:1,justifyContent:'center',alignItems:'center'},
  pageHeader:{backgroundColor:COLORS.primary,paddingHorizontal:20,paddingTop:16,paddingBottom:18},
  pageTitle:{fontSize:20,fontWeight:'800',color:'#fff'},
  pageSub:{fontSize:12,color:'rgba(255,255,255,0.8)',marginTop:2},
  content:{padding:16,paddingBottom:50,gap:6},
  sectionBody:{backgroundColor:'#fff',borderRadius:14,padding:12,marginBottom:6,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:3,elevation:1},
  branchList:{marginTop:8,borderTopWidth:1,borderTopColor:'#f0f0f0',paddingTop:8},
  branchRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#f5f5f5'},
  branchDot:{width:8,height:8,borderRadius:4,marginRight:10},
  branchName:{fontSize:13,fontWeight:'700',color:'#222',flex:1},
  branchPin:{fontSize:11,color:'#aaa'},
  branchIdx:{fontSize:12,color:'#ccc',fontWeight:'700'},
  mgrCard:{backgroundColor:'#F8F8F8',borderRadius:10,padding:12,marginBottom:8},
  mgrName:{flex:1,fontSize:13,fontWeight:'700',color:'#222'},
  mgrPin:{fontSize:11,color:'#aaa',marginLeft:6},
  mgrStat:{flex:1,alignItems:'center'},
  mgrStatVal:{fontSize:13,fontWeight:'800',color:'#111'},
  mgrStatLbl:{fontSize:10,color:'#aaa',marginTop:1},
  notifRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10,marginTop:4},
  notifLbl:{fontSize:14,fontWeight:'700',color:'#333'},
  partnerCard:{gap:8},
  partnerTitle:{fontSize:14,fontWeight:'800',color:'#AD1457'},
  partnerSub:{fontSize:12,color:'#888',lineHeight:18,marginBottom:4},
  auditNote:{fontSize:12,color:'#888',lineHeight:18,marginBottom:10,padding:10,backgroundColor:'#FFF8E1',borderRadius:8},
  auditRow:{flexDirection:'row',alignItems:'flex-start',paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#f5f5f5',gap:8},
  auditType:{fontSize:11,fontWeight:'700',color:'#555',width:65},
  auditBranch:{fontSize:13,fontWeight:'700',color:'#222'},
  auditDetail:{fontSize:11,color:'#aaa',marginTop:1},
  auditTime:{fontSize:11,color:'#bbb',marginTop:1},
  emptyTxt:{color:'#aaa',fontSize:13,textAlign:'center',padding:16},
  footer:{textAlign:'center',color:'#bbb',fontSize:11,marginTop:8},
});
