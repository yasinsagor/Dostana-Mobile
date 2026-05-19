import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchDailyReports, fetchCashflowReports, fetchSpecOrders } from '../../lib/supabase';
import { COLORS } from '../../constants';

function todayStr() { return new Date().toISOString().slice(0,10); }
function yesterdayStr() { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function daysAgoStr(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function fmtK(n) { if(!n&&n!==0) return '0'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1)+'k'; return String(Math.round(n)); }
function pct(a,b) { if(!b) return null; return Math.round((a-b)/b*100); }
function dayName(iso) {
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return days[new Date(iso).getDay()];
}

/* ─── status badge ──────────────────────────────────────────── */
function StatusBadge({ label, done }) {
  return (
    <View style={[sb.wrap, done ? sb.done : sb.pending]}>
      <Text style={sb.icon}>{done ? '✅' : '❌'}</Text>
      <Text style={[sb.txt, { color: done ? '#2E7D32' : '#C62828' }]}>{label}</Text>
    </View>
  );
}
const sb = StyleSheet.create({
  wrap:    { flexDirection:'row', alignItems:'center', paddingHorizontal:12, paddingVertical:8, borderRadius:10, gap:6, flex:1, margin:3 },
  done:    { backgroundColor:'#E8F5E9', borderWidth:1, borderColor:'#A5D6A7' },
  pending: { backgroundColor:'#FFEBEE', borderWidth:1, borderColor:'#EF9A9A' },
  icon:    { fontSize:14 },
  txt:     { fontSize:12, fontWeight:'700' },
});

/* ─── metric card ───────────────────────────────────────────── */
function MetricCard({ label, value, sub, color='#333', bg='#F5F5F5' }) {
  return (
    <View style={[mc.card, { backgroundColor: bg }]}>
      <Text style={[mc.val, { color }]}>{value}</Text>
      <Text style={mc.label}>{label}</Text>
      {sub ? <Text style={mc.sub}>{sub}</Text> : null}
    </View>
  );
}
const mc = StyleSheet.create({
  card:  { flex:1, borderRadius:12, padding:12, alignItems:'center', margin:4 },
  val:   { fontSize:18, fontWeight:'800', marginBottom:2 },
  label: { fontSize:11, color:'#888', textAlign:'center' },
  sub:   { fontSize:11, fontWeight:'700', marginTop:3, textAlign:'center' },
});

/* ─── quick action button ───────────────────────────────────── */
function QBtn({ icon, label, onPress, color=COLORS.primary }) {
  return (
    <TouchableOpacity style={[qb.btn, { borderColor: color+'40', backgroundColor: color+'10' }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={{ fontSize:22 }}>{icon}</Text>
      <Text style={[qb.txt, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}
const qb = StyleSheet.create({
  btn: { flex:1, alignItems:'center', justifyContent:'center', borderRadius:14, borderWidth:1.5, paddingVertical:14, margin:4, gap:6 },
  txt: { fontSize:12, fontWeight:'700', textAlign:'center' },
});

/* ─── section card ──────────────────────────────────────────── */
function Card({ children, style }) {
  return <View style={[crd.card, style]}>{children}</View>;
}
const crd = StyleSheet.create({
  card: { backgroundColor:'#fff', borderRadius:16, padding:16, marginBottom:10, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerHomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const branch = user?.branch || '';

  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefresh] = useState(false);
  const [daily,   setDaily]     = useState([]);
  const [cf,      setCf]        = useState([]);
  const [spec,    setSpec]      = useState([]);
  const [note,    setNote]      = useState('');
  const [notes,   setNotes]     = useState([]);
  const [saving,  setSaving]    = useState(false);

  const load = useCallback(async () => {
    try {
      const from = daysAgoStr(13);
      const to   = todayStr();
      const [d, c, s] = await Promise.all([
        fetchDailyReports(branch, from, to),
        fetchCashflowReports(branch, from, to),
        fetchSpecOrders(branch, from, to),
      ]);
      setDaily(d  || []);
      setCf(c    || []);
      setSpec(s  || []);
    } catch(e) { console.error(e); }
    setLoading(false);
    setRefresh(false);
  }, [branch]);

  useEffect(() => { load(); }, [load]);

  const today     = todayStr();
  const yesterday = yesterdayStr();

  /* ── derived state ── */
  const todayDR   = daily.find(r => r.date === today);
  const todayCF   = cf.find(r   => r.date === today);
  const todaySPEC = spec.find(r  => r.date === today);

  const todayRev     = todayDR?.total_revenue || todayDR?.revenue || 0;
  const todayHours   = todayDR?.total_hours   || todayDR?.hours   || 0;
  const yesterdayRev = (daily.find(r => r.date === yesterday)?.total_revenue) || 0;
  const diffPct      = pct(todayRev, yesterdayRev);

  /* last 7 days for mini bar chart */
  const last7 = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    const iso = d.toISOString().slice(0,10);
    const r = daily.find(x => x.date === iso);
    return { iso, rev: r?.total_revenue || r?.revenue || 0, day: dayName(iso) };
  });
  const maxRev = Math.max(...last7.map(d => d.rev), 1);

  /* weekly total */
  const weekRev = last7.reduce((s,d) => s+d.rev, 0);
  const weekDays = last7.filter(d => d.rev > 0).length;

  /* delivery % from today */
  const deliveryRev = ['wolt','glovo','uber_eats','bolt','pyszne'].reduce(
    (s,k) => s+(todayDR?.[k]||0), 0
  );
  const deliveryPct = todayRev > 0 ? Math.round(deliveryRev/todayRev*100) : 0;

  /* revenue target (placeholder 5000 PLN) */
  const TARGET = 5000;
  const targetPct = Math.min(100, Math.round(todayRev/TARGET*100));

  /* handover notes stored in local state (future: Supabase table) */
  const saveNote = () => {
    if (!note.trim()) return;
    setNotes(n => [{ text:note.trim(), time: new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}), id: Date.now() }, ...n]);
    setNote('');
    Alert.alert('Note Saved', 'Handover note added successfully.');
  };

  const onRefresh = () => { setRefresh(true); load(); };

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  const allDone = !!(todayDR && todayCF && todaySPEC);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: allDone ? '#2E7D32' : COLORS.primary }]}>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>👨‍🍳 {branch}</Text>
          <Text style={s.headerSub}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})}</Text>
        </View>
        <View style={[s.statusPill, { backgroundColor: allDone ? '#fff' : 'rgba(255,255,255,0.25)' }]}>
          <Text style={[s.statusPillTxt, { color: allDone ? '#2E7D32' : '#fff' }]}>
            {allDone ? '✅ All Done' : '⚠️ Pending'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary}/>}
      >

        {/* ── 1. DAILY CHECKLIST ──────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>🚨 Today's Checklist</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:4 }}>
            <StatusBadge label="Daily Report"  done={!!todayDR}   />
            <StatusBadge label="Cash Flow"     done={!!todayCF}   />
            <StatusBadge label="SPEC Order"    done={!!todaySPEC} />
            <StatusBadge label="Hours Logged"  done={todayHours>0}/>
          </View>
          {!allDone && (
            <View style={s.alertBanner}>
              <Text style={s.alertTxt}>
                {[!todayDR&&'Daily Report',!todayCF&&'Cash Flow',!todaySPEC&&'SPEC Order'].filter(Boolean).join(' · ')} still pending
              </Text>
            </View>
          )}
        </Card>

        {/* ── 2. TODAY PERFORMANCE ────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>💰 Today's Performance</Text>
          <View style={{ flexDirection:'row', marginTop:4 }}>
            <MetricCard label="Today"      value={`${fmtK(todayRev)} PLN`}      color={COLORS.primary} bg="#E8F5E9"/>
            <MetricCard label="Yesterday"  value={`${fmtK(yesterdayRev)} PLN`}  color="#555"           bg="#F5F5F5"/>
            <MetricCard
              label="vs Yesterday"
              value={diffPct===null ? '—' : `${diffPct>0?'+':''}${diffPct}%`}
              color={diffPct===null?'#aaa':diffPct>=0?COLORS.primary:COLORS.danger}
              bg={diffPct===null?'#F5F5F5':diffPct>=0?'#E8F5E9':'#FFEBEE'}
              sub={diffPct===null?'no data':undefined}
            />
          </View>
          <View style={{flexDirection:'row',marginTop:4}}>
            <MetricCard label="This Week"    value={`${fmtK(weekRev)} PLN`}   color="#1565C0" bg="#E3F2FD"/>
            <MetricCard label="Active Days"  value={`${weekDays}/7`}           color="#555"    bg="#F5F5F5"/>
            <MetricCard label="Delivery %"   value={`${deliveryPct}%`}
              color={deliveryPct>40?COLORS.danger:COLORS.primary}
              bg={deliveryPct>40?'#FFEBEE':'#E8F5E9'}
              sub={deliveryPct>40?'⚠️ High':undefined}
            />
          </View>
        </Card>

        {/* ── 3. SPEC REMINDER ────────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>📦 SPEC Status</Text>
          {todaySPEC ? (
            <View style={s.specDone}>
              <Text style={s.specDoneTxt}>✅ SPEC order submitted for today</Text>
            </View>
          ) : (
            <View style={s.specPending}>
              <Text style={s.specPendingTxt}>❌ SPEC order not yet submitted today</Text>
              <TouchableOpacity style={s.specBtn} onPress={() => navigation.navigate('SPEC Order')} activeOpacity={0.8}>
                <Text style={s.specBtnTxt}>Submit SPEC Now →</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={s.specTips}>
            {[
              { icon:'🚚', txt:'Check if delivery is arriving today' },
              { icon:'📋', txt:'Review tomorrow\'s stock needs' },
              { icon:'⚠️', txt:'Flag any low-stock items in notes' },
            ].map((t,i)=>(
              <View key={i} style={s.specTip}>
                <Text>{t.icon}</Text>
                <Text style={s.specTipTxt}>{t.txt}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* ── 4. SHIFT / STAFF ────────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>👨‍🍳 Shift & Staff</Text>
          <View style={{flexDirection:'row',marginTop:4}}>
            <MetricCard label="Hours Today"  value={todayHours > 0 ? `${todayHours}h` : '—'} color={COLORS.primary} bg="#E8F5E9"/>
            <MetricCard label="Est. Labor"   value={todayHours > 0 ? `${fmtK(todayHours*22)} PLN` : '—'} color="#555" bg="#F5F5F5"/>
            <MetricCard label="Labor %"
              value={todayRev>0&&todayHours>0 ? `${Math.round(todayHours*22/todayRev*100)}%` : '—'}
              color={todayRev>0&&todayHours>0&&(todayHours*22/todayRev)>0.25?COLORS.danger:COLORS.primary}
              bg={todayRev>0&&todayHours>0&&(todayHours*22/todayRev)>0.25?'#FFEBEE':'#E8F5E9'}
            />
          </View>
          {todayHours===0&&(
            <View style={s.alertBanner}>
              <Text style={s.alertTxt}>⚠️ No hours logged — add hours in Daily Report</Text>
            </View>
          )}
          <TouchableOpacity style={s.shiftBtn} onPress={() => navigation.navigate('Submit')} activeOpacity={0.8}>
            <Text style={s.shiftBtnTxt}>📝 Log Hours in Daily Report →</Text>
          </TouchableOpacity>
        </Card>

        {/* ── 5. HANDOVER NOTES ───────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>📝 Handover Notes</Text>
          <View style={s.noteInput}>
            <TextInput
              style={s.noteField}
              placeholder='e.g. "Fridge making noise", "Need sauce tomorrow"...'
              placeholderTextColor="#bbb"
              value={note}
              onChangeText={setNote}
              multiline
              numberOfLines={2}
            />
            <TouchableOpacity style={[s.noteBtn,{opacity:note.trim()?1:0.4}]} onPress={saveNote} disabled={!note.trim()}>
              <Text style={s.noteBtnTxt}>Save</Text>
            </TouchableOpacity>
          </View>
          {notes.length > 0 && (
            <View style={{marginTop:10}}>
              <Text style={s.noteHistLabel}>Today's Notes</Text>
              {notes.map(n=>(
                <View key={n.id} style={s.noteRow}>
                  <Text style={s.noteDot}>●</Text>
                  <Text style={s.noteRowTxt} numberOfLines={2}>{n.text}</Text>
                  <Text style={s.noteTime}>{n.time}</Text>
                </View>
              ))}
            </View>
          )}
          {notes.length === 0 && (
            <Text style={s.noteEmpty}>No notes yet today. Add shift handover notes above.</Text>
          )}
        </Card>

        {/* ── 6. WEEKLY PROGRESS ──────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>📈 This Week's Revenue</Text>
          <View style={s.barChart}>
            {last7.map((d,i) => {
              const h = maxRev > 0 ? Math.max(4, (d.rev/maxRev)*80) : 4;
              const isToday = d.iso === today;
              return (
                <View key={i} style={s.barCol}>
                  <Text style={s.barVal}>{d.rev>0?fmtK(d.rev):''}</Text>
                  <View style={[s.bar, { height:h, backgroundColor: isToday?COLORS.primary:COLORS.primary+'55' }]}/>
                  <Text style={[s.barLabel,{fontWeight:isToday?'800':'400',color:isToday?COLORS.primary:'#aaa'}]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={{flexDirection:'row',marginTop:8,gap:4}}>
            <MetricCard label="Week Total"   value={`${fmtK(weekRev)} PLN`}                     color="#1565C0" bg="#E3F2FD"/>
            <MetricCard label="Avg / Day"    value={weekDays>0?`${fmtK(Math.round(weekRev/weekDays))} PLN`:'—'} color="#555" bg="#F5F5F5"/>
          </View>
        </Card>

        {/* ── 7. DAILY TARGETS ────────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>🎯 Daily Targets</Text>
          {[
            { label:'Revenue Target (5,000 PLN)',    value:`${targetPct}%`, ok: targetPct>=100, bar:targetPct },
            { label:'Delivery below 40%',            value:`${deliveryPct}%`, ok: deliveryPct<=40||deliveryPct===0, bar:deliveryPct, invert:true },
            { label:'Daily Report submitted',        value:todayDR?'✅':'❌', ok:!!todayDR, bar:null },
            { label:'Cash Flow submitted',           value:todayCF?'✅':'❌', ok:!!todayCF, bar:null },
            { label:'SPEC Order submitted',          value:todaySPEC?'✅':'❌', ok:!!todaySPEC, bar:null },
          ].map((t,i)=>(
            <View key={i} style={s.targetRow}>
              <Text style={s.targetLabel}>{t.label}</Text>
              <Text style={[s.targetVal,{color:t.ok?COLORS.primary:COLORS.danger}]}>{t.value}</Text>
            </View>
          ))}
          {todayRev > 0 && (
            <View style={s.targetBarWrap}>
              <View style={[s.targetBar,{width:`${Math.min(100,targetPct)}%`}]}/>
            </View>
          )}
        </Card>

        {/* ── 8. QUICK ACTIONS ────────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>⚡ Quick Actions</Text>
          <View style={{flexDirection:'row',flexWrap:'wrap',marginTop:4}}>
            <QBtn icon="📝" label="Daily Report"  onPress={()=>navigation.navigate('Submit')}  color={COLORS.primary}/>
            <QBtn icon="💸" label="Cash Flow"     onPress={()=>navigation.navigate('Submit')}     color="#1565C0"/>
            <QBtn icon="📦" label="SPEC Order"    onPress={()=>navigation.navigate('SPEC Order')}    color="#6A1B9A"/>
            <QBtn icon="🗂️" label="History"       onPress={()=>navigation.navigate('History')}       color="#E65100"/>
          </View>
        </Card>

        {/* ── 9. ANNOUNCEMENTS ────────────────────────────── */}
        <Card>
          <Text style={s.cardTitle}>💡 Announcements & Tips</Text>
          {[
            { icon:'🧼', txt:'Daily hygiene checklist must be completed before closing.', type:'hygiene' },
            { icon:'📦', txt:'Submit SPEC order before 18:00 for next-day delivery.', type:'reminder' },
            { icon:'📝', txt:'Remember: daily report + cash flow must match. Double check before submitting.', type:'tip' },
          ].map((a,i)=>(
            <View key={i} style={s.annoRow}>
              <Text style={{fontSize:18}}>{a.icon}</Text>
              <Text style={s.annoTxt}>{a.txt}</Text>
            </View>
          ))}
        </Card>

      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:           { flex:1, backgroundColor:'#F4F6F8' },
  center:         { flex:1, justifyContent:'center', alignItems:'center' },
  header:         { paddingHorizontal:20, paddingTop:16, paddingBottom:18, flexDirection:'row', alignItems:'center' },
  headerTitle:    { fontSize:18, fontWeight:'800', color:'#fff' },
  headerSub:      { fontSize:12, color:'rgba(255,255,255,0.8)', marginTop:2 },
  statusPill:     { borderRadius:20, paddingHorizontal:12, paddingVertical:6 },
  statusPillTxt:  { fontSize:12, fontWeight:'800' },
  content:        { padding:14, paddingBottom:50 },
  cardTitle:      { fontSize:14, fontWeight:'800', color:'#222', marginBottom:2 },
  alertBanner:    { marginTop:10, backgroundColor:'#FFF3E0', borderRadius:8, padding:10, borderLeftWidth:3, borderLeftColor:'#F9A825' },
  alertTxt:       { fontSize:12, color:'#E65100', fontWeight:'700' },
  specDone:       { backgroundColor:'#E8F5E9', borderRadius:10, padding:12, marginTop:8 },
  specDoneTxt:    { fontSize:13, color:'#2E7D32', fontWeight:'700' },
  specPending:    { backgroundColor:'#FFEBEE', borderRadius:10, padding:12, marginTop:8 },
  specPendingTxt: { fontSize:13, color:'#C62828', fontWeight:'700', marginBottom:8 },
  specBtn:        { backgroundColor:COLORS.primary, borderRadius:8, paddingVertical:9, alignItems:'center' },
  specBtnTxt:     { color:'#fff', fontWeight:'800', fontSize:13 },
  specTips:       { marginTop:12, gap:6 },
  specTip:        { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:4 },
  specTipTxt:     { fontSize:12, color:'#666' },
  shiftBtn:       { marginTop:10, backgroundColor:'#F0F0F0', borderRadius:8, padding:10, alignItems:'center' },
  shiftBtnTxt:    { fontSize:12, color:'#555', fontWeight:'700' },
  noteInput:      { flexDirection:'row', alignItems:'flex-end', gap:8, marginTop:8 },
  noteField:      { flex:1, backgroundColor:'#F5F5F5', borderRadius:10, padding:12, fontSize:13, color:'#222', minHeight:52, textAlignVertical:'top' },
  noteBtn:        { backgroundColor:COLORS.primary, borderRadius:10, paddingHorizontal:16, paddingVertical:14 },
  noteBtnTxt:     { color:'#fff', fontWeight:'800', fontSize:13 },
  noteHistLabel:  { fontSize:11, fontWeight:'800', color:'#aaa', textTransform:'uppercase', marginBottom:6 },
  noteRow:        { flexDirection:'row', alignItems:'center', paddingVertical:7, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  noteDot:        { fontSize:8, color:COLORS.primary },
  noteRowTxt:     { flex:1, fontSize:13, color:'#222' },
  noteTime:       { fontSize:11, color:'#bbb' },
  noteEmpty:      { fontSize:12, color:'#bbb', textAlign:'center', marginTop:10, fontStyle:'italic' },
  barChart:       { flexDirection:'row', alignItems:'flex-end', height:120, marginTop:12, gap:4 },
  barCol:         { flex:1, alignItems:'center', gap:2 },
  bar:            { width:'80%', borderRadius:4, minHeight:4 },
  barVal:         { fontSize:9, color:'#888', textAlign:'center' },
  barLabel:       { fontSize:10, color:'#aaa', marginTop:2 },
  targetRow:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:9, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  targetLabel:    { fontSize:12, color:'#444', flex:1 },
  targetVal:      { fontSize:13, fontWeight:'800' },
  targetBarWrap:  { height:6, backgroundColor:'#EEE', borderRadius:3, marginTop:10, overflow:'hidden' },
  targetBar:      { height:6, backgroundColor:COLORS.primary, borderRadius:3 },
  annoRow:        { flexDirection:'row', alignItems:'flex-start', gap:10, paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  annoTxt:        { flex:1, fontSize:12, color:'#555', lineHeight:18 },
});
