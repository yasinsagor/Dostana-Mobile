import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import { supabase, insertDailyReport, fetchDailyReports, fetchSpecOrders, fetchBranchWorkers, saveBranchWorkers } from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── constants ─────────────────────────────────────────────── */
const PLATFORMS = ['wolt','glovo','uber_eats','bolt','pyszne','restaumatic'];
const PLATFORM_LABELS = { wolt:'Wolt', glovo:'Glovo', uber_eats:'Uber Eats', bolt:'Bolt Food', pyszne:'Pyszne.pl', restaumatic:'Restaumatic' };
const CF_CATS = ['Warzywa','Cola/Pepsi','Gaz','C2C','Spec','Wynajem','Pracownicy','Inne'];

function todayStr() { return new Date().toISOString().slice(0,10); }
function yesterdayStr() { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function fmtN(n) { return Math.round(n).toLocaleString(); }
function n(v) { return parseFloat(v)||0; }

/* ─── sub-components ────────────────────────────────────────── */
function SectionCard({ title, color=COLORS.primary, children }) {
  return (
    <View style={[sc.card,{borderTopColor:color}]}>
      <Text style={[sc.title,{color}]}>{title}</Text>
      {children}
    </View>
  );
}
const sc = StyleSheet.create({
  card:  { backgroundColor:'#fff', borderRadius:14, padding:16, marginBottom:12, borderTopWidth:3, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  title: { fontSize:11, fontWeight:'800', letterSpacing:1, marginBottom:14, textTransform:'uppercase' },
});

function NumInput({ label, value, onChange, warning, placeholder='0', right }) {
  return (
    <View style={ni.wrap}>
      <View style={{flex:1}}>
        <Text style={ni.label}>{label}</Text>
        {warning ? <Text style={ni.warn}>{warning}</Text> : null}
      </View>
      <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
        {right ? <Text style={ni.right}>{right}</Text> : null}
        <TextInput
          style={[ni.input, warning ? ni.inputWarn : null]}
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder={placeholder}
          placeholderTextColor="#ccc"
        />
      </View>
    </View>
  );
}
const ni = StyleSheet.create({
  wrap:      { flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  label:     { fontSize:13, fontWeight:'600', color:'#333' },
  warn:      { fontSize:10, color:COLORS.danger, marginTop:1 },
  right:     { fontSize:11, color:'#aaa' },
  input:     { width:110, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:8, paddingHorizontal:10, paddingVertical:8, fontSize:14, color:'#111', backgroundColor:'#FAFAFA', textAlign:'right' },
  inputWarn: { borderColor:COLORS.danger, backgroundColor:'#FFF5F5' },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerSubmitScreen() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const branch = user?.branch || '';
  const today = todayStr();
  const draftKey = `submit_draft_${branch}_${today}`;

  /* ── form state ── */
  const [revenue,   setRevenue]   = useState('');
  const [card,      setCard]      = useState('');
  const [cash,      setCash]      = useState('');
  const [workers,   setWorkers]   = useState([{ name: '', hours: '' }]);
  const [platforms, setPlatforms] = useState({ wolt:'', glovo:'', uber_eats:'', bolt:'', pyszne:'', restaumatic:'' });
  const [cfCats,    setCfCats]    = useState(CF_CATS.map(name=>({name,amount:''})));
  const [noteType,  setNoteType]  = useState('general');
  const [notes,     setNotes]     = useState('');

  /* ── status ── */
  const [drSubmitted,  setDrSubmitted]  = useState(false);
  const [cfSubmitted,  setCfSubmitted]  = useState(false);
  const [specDone,     setSpecDone]     = useState(false);
  const [yesterdayRev, setYesterdayRev] = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [draftLoaded,  setDraftLoaded]  = useState(false);
  const autoSaveTimer = useRef(null);

  /* ── load worker names from DB (persisted across days & devices) ── */
  useEffect(() => {
    fetchBranchWorkers(branch).then(names => {
      if (names.length > 0) setWorkers(names.map(name => ({ name, hours: '' })));
    }).catch(() => {
      // fallback to AsyncStorage
      AsyncStorage.getItem(`workers_${branch}`).then(raw => {
        if (raw) setWorkers(JSON.parse(raw).map(name => ({ name, hours: '' })));
      }).catch(() => {});
    });
  }, [branch]);

  /* save worker names to DB + AsyncStorage whenever they change */
  useEffect(() => {
    const names = workers.map(w => w.name).filter(Boolean);
    if (!names.length) return;
    saveBranchWorkers(branch, names);
    AsyncStorage.setItem(`workers_${branch}`, JSON.stringify(names)).catch(() => {});
  }, [workers, branch]);

  /* ── load draft + check existing submissions ── */
  useEffect(() => {
    async function init() {
      // load draft
      try {
        const raw = await AsyncStorage.getItem(draftKey);
        if (raw) {
          const d = JSON.parse(raw);
          if (d.revenue)   setRevenue(d.revenue);
          if (d.card)      setCard(d.card);
          if (d.cash)      setCash(d.cash);
          if (d.workers)   setWorkers(d.workers);
          else if (d.hours) setWorkers([{ name: '', hours: d.hours }]);
          if (d.platforms) setPlatforms(d.platforms);
          if (d.cfCats)    setCfCats(d.cfCats);
          if (d.notes)     setNotes(d.notes);
          if (d.noteType)  setNoteType(d.noteType);
        }
      } catch {}
      setDraftLoaded(true);

      // check existing submissions
      try {
        const [{ data:dr }, { data:cf }, { data:sp }] = await Promise.all([
          supabase.from('daily_reports').select('id').eq('branch',branch).eq('date',today).limit(1),
          supabase.from('cashflow_reports').select('id').eq('branch',branch).eq('date',today).limit(1),
          supabase.from('spec_orders').select('id').eq('branch',branch).eq('date',today).limit(1),
        ]);
        setDrSubmitted(!!(dr && dr.length));
        setCfSubmitted(!!(cf && cf.length));
        setSpecDone(!!(sp && sp.length));
      } catch {}

      // yesterday revenue
      try {
        const { data } = await supabase.from('daily_reports')
          .select('total_revenue,revenue').eq('branch',branch).eq('date',yesterdayStr()).limit(1);
        if (data && data[0]) setYesterdayRev(data[0].total_revenue || data[0].revenue || 0);
      } catch {}
    }
    init();
  }, [branch, today, draftKey]);

  /* ── auto-save draft ── */
  const autoSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(draftKey, JSON.stringify({ revenue, card, cash, workers, platforms, cfCats, notes, noteType }));
      } catch {}
    }, 800);
  }, [revenue, card, cash, workers, platforms, cfCats, notes, noteType, draftKey]);

  useEffect(() => { if (draftLoaded) autoSave(); }, [revenue, card, cash, workers, platforms, cfCats, notes, noteType, draftLoaded]);

  /* ── derived values ── */
  const totalDelivery = PLATFORMS.reduce((s,p)=>s+n(platforms[p]),0);
  const rev           = n(revenue);
  const cardN         = n(card);
  const cashN         = n(cash);
  const hoursN        = workers.reduce((s, w) => s + n(w.hours), 0);
  const splitSum      = cardN + cashN + totalDelivery;
  const splitMismatch = rev > 0 && Math.abs(rev - splitSum) > 50;
  const deliveryPct   = rev > 0 ? Math.round(totalDelivery/rev*100) : 0;
  const diffPct       = yesterdayRev>0 && rev>0 ? Math.round((rev-yesterdayRev)/yesterdayRev*100) : null;

  const cfFilled   = cfCats.filter(e=>e.name&&n(e.amount)>0);
  const totalCF    = cfFilled.reduce((s,e)=>s+n(e.amount),0);
  const netProfit  = rev - totalCF;
  const laborCost  = hoursN * 22;
  const revPerHour = hoursN > 0 ? Math.round(rev/hoursN) : 0;

  /* big platform for concentration warning */
  const bigPlatform = PLATFORMS.find(p => rev>0 && n(platforms[p])/rev > 0.35);

  /* inne > 100 without description check */
  const inneRow  = cfCats.find(e=>e.name==='Inne');
  const inneWarn = inneRow && n(inneRow.amount) > 100;

  /* ── quick add CF expense ── */
  const quickAdd = (name) => {
    setCfCats(prev => {
      const exists = prev.find(e=>e.name===name);
      if (exists) return prev;
      return [...prev, {name, amount:''}];
    });
  };
  const updateCF = (i, field, val) => setCfCats(p=>p.map((r,idx)=>idx===i?{...r,[field]:val}:r));
  const removeCF = (i) => setCfCats(p=>p.filter((_,idx)=>idx!==i));
  const setPlatform = (k,v) => setPlatforms(p=>({...p,[k]:v}));

  /* ── validation ── */
  function validate() {
    const errs = [];
    if (!revenue || rev === 0) errs.push('• Total revenue is required');
    if (splitMismatch) errs.push(`• Revenue split mismatch: ${fmtN(rev)} ≠ ${fmtN(splitSum)} (Card+Cash+Delivery)`);
    if (cfFilled.length === 0) errs.push('• Cash Flow: enter at least one expense');
    if (inneWarn) errs.push('• "Inne" expense >100 PLN — add a description in Notes');
    if (hoursN > workers.length * 14) errs.push(`• Total hours (${hoursN}h) seem high for ${workers.length} worker(s) — double check`);
    if (drSubmitted) errs.push('• Daily report already submitted today');
    if (cfSubmitted) errs.push('• Cash flow already submitted today');
    return errs;
  }

  /* ── submit ── */
  async function handleSubmit() {
    const errs = validate();
    if (errs.length) {
      Alert.alert('⚠️ Check Before Submit', errs.join('\n'), [
        { text:'Fix Issues', style:'cancel' },
        { text:'Submit Anyway', style:'destructive', onPress: doSubmit },
      ]);
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setSaving(true);
    try {
      // 1. Daily report
      if (!drSubmitted) {
        const report = {
          branch, date:today,
          revenue: rev, card: cardN, cash: cashN, hours: hoursN, total_hours: hoursN,
          workers_hours: JSON.stringify(workers.filter(w => n(w.hours) > 0)),
          total_delivery: totalDelivery,
          total_revenue: rev,
          total_expenses: totalCF,
          net_profit: netProfit,
          notes: `[${noteType.toUpperCase()}] ${notes}`,
          ...Object.fromEntries(PLATFORMS.map(p=>[p,n(platforms[p])])),
          wydatki: JSON.stringify(cfFilled),
        };
        await insertDailyReport(report);
      }

      // 2. Cash flow
      if (!cfSubmitted) {
        await supabase.from('cashflow_reports').insert([{
          branch, date:today,
          expenses: cfFilled,
          total_expenses: totalCF,
          balance: rev - totalCF,
          notes: notes || null,
        }]);
      }

      // clear draft
      await AsyncStorage.removeItem(draftKey);
      setSubmitted(true);
    } catch(e) {
      Alert.alert('Error', e.message || 'Submission failed. Try again.');
    }
    setSaving(false);
  }

  /* ── success screen ── */
  if (submitted) {
    const margin = rev > 0 ? Math.round((rev-totalCF)/rev*100) : 0;
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successHeader}>
          <Text style={s.successEmoji}>🎉</Text>
          <Text style={s.successTitle}>Report Submitted!</Text>
          <Text style={s.successBranch}>{branch} · {today}</Text>
        </View>
        <ScrollView contentContainerStyle={{padding:20,gap:12}}>
          {[
            { label:'Revenue',     value:`${fmtN(rev)} PLN`,     color:COLORS.primary },
            { label:'CF Expenses', value:`${fmtN(totalCF)} PLN`, color:COLORS.danger  },
            { label:'Net Profit',  value:`${fmtN(netProfit)} PLN`, color: netProfit>=0?'#2E7D32':COLORS.danger },
            { label:'Margin',      value:`${margin}%`,            color:margin>15?'#2E7D32':margin>8?COLORS.warning:COLORS.danger },
            { label:'Hours',       value:hoursN>0?`${hoursN}h (${workers.filter(w=>n(w.hours)>0).length} workers)`:'—', color:'#555' },
            { label:'vs Yesterday',value:diffPct!==null?`${diffPct>0?'+':''}${diffPct}%`:'—', color:diffPct>=0?COLORS.primary:COLORS.danger },
          ].map((r,i)=>(
            <View key={i} style={s.succRow}>
              <Text style={s.succLabel}>{r.label}</Text>
              <Text style={[s.succVal,{color:r.color}]}>{r.value}</Text>
            </View>
          ))}
          {!specDone && (
            <TouchableOpacity style={s.specReminder} onPress={()=>navigation.navigate('SPEC Order')} activeOpacity={0.8}>
              <Text style={s.specReminderTxt}>📦 SPEC order not submitted yet — tap to submit now →</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.newBtn} onPress={()=>{ setSubmitted(false); setRevenue(''); setCard(''); setCash(''); setWorkers(w=>w.map(x=>({...x,hours:''}))); setNotes(''); setPlatforms({wolt:'',glovo:'',uber_eats:'',bolt:'',pyszne:'',restaumatic:''}); setCfCats(CF_CATS.map(n=>({name:n,amount:''}))); }}>
            <Text style={s.newBtnTxt}>Submit New Report</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── main form ── */
  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>📤 {branch}</Text>
          <Text style={s.headerSub}>{new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'short'})} · {draftLoaded?'Draft restored':'Ready'}</Text>
        </View>
        {/* submission status chips */}
        <View style={{gap:3}}>
          {[
            { label:'Daily', done:drSubmitted },
            { label:'CF',    done:cfSubmitted },
            { label:'SPEC',  done:specDone    },
          ].map(({label,done})=>(
            <View key={label} style={[s.chip, done ? s.chipDone : s.chipPending]}>
              <Text style={[s.chipTxt,{color:done?'#2E7D32':'#C62828'}]}>{done?'✅':'❌'} {label}</Text>
            </View>
          ))}
        </View>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* ── REVENUE ── */}
          <SectionCard title="💰 Revenue" color={COLORS.primary}>
            <NumInput label="Total Revenue (PLN)" value={revenue} onChange={setRevenue}
              warning={rev>0&&diffPct!==null?`${diffPct>0?'+':''}${diffPct}% vs yesterday (${fmtN(yesterdayRev)} PLN)`:undefined}/>
            <NumInput label="Card Payments" value={card} onChange={setCard}/>
            <NumInput label="Cash Payments" value={cash} onChange={setCash}/>
            {splitMismatch && (
              <View style={s.mismatchBanner}>
                <Text style={s.mismatchTxt}>⚠️ Mismatch: {fmtN(rev)} PLN ≠ Card {fmtN(cardN)} + Cash {fmtN(cashN)} + Delivery {fmtN(totalDelivery)} = {fmtN(splitSum)} PLN</Text>
              </View>
            )}
            {/* ── Workers & Hours ── */}
            <View style={s.workersHeader}>
              <Text style={s.workersLbl}>👷 Workers & Hours</Text>
              {hoursN > 0 && <Text style={s.workersTot}>{hoursN}h total · {fmtN(revPerHour)} PLN/hr</Text>}
            </View>
            {workers.map((w, i) => (
              <View key={i} style={s.workerRow}>
                <TextInput
                  style={s.workerName}
                  value={w.name}
                  onChangeText={v => setWorkers(p => p.map((x, j) => j===i ? {...x, name:v} : x))}
                  placeholder={`Worker ${i+1}`}
                  placeholderTextColor="#ccc"
                />
                <TextInput
                  style={s.workerHours}
                  value={w.hours}
                  onChangeText={v => setWorkers(p => p.map((x, j) => j===i ? {...x, hours:v} : x))}
                  keyboardType="decimal-pad"
                  placeholder="0h"
                  placeholderTextColor="#ccc"
                />
                {workers.length > 1 && (
                  <TouchableOpacity onPress={() => setWorkers(p => p.filter((_,j) => j!==i))} style={s.workerDel}>
                    <Text style={{fontSize:16,color:'#E53935'}}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={s.addWorkerBtn} onPress={() => setWorkers(p => [...p, {name:'', hours:''}])}>
              <Text style={s.addWorkerTxt}>+ Add Worker</Text>
            </TouchableOpacity>
          </SectionCard>

          {/* ── DELIVERY PLATFORMS ── */}
          <SectionCard title="🚚 Delivery Platforms" color="#6A1B9A">
            {PLATFORMS.map(p=>{
              const pct = rev>0&&n(platforms[p])>0 ? Math.round(n(platforms[p])/rev*100) : 0;
              return (
                <NumInput key={p} label={PLATFORM_LABELS[p]} value={platforms[p]} onChange={v=>setPlatform(p,v)}
                  right={pct>0?`${pct}%`:undefined}
                  warning={bigPlatform===p?`⚠️ ${pct}% of revenue — high concentration`:undefined}/>
              );
            })}
            <View style={s.deliveryTotal}>
              <Text style={s.deliveryTotalLbl}>Total Delivery</Text>
              <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                <Text style={[s.deliveryPct,{color:deliveryPct>40?COLORS.danger:COLORS.primary}]}>{deliveryPct}%</Text>
                <Text style={s.deliveryTotalVal}>{fmtN(totalDelivery)} PLN</Text>
              </View>
            </View>
            {deliveryPct>40&&<View style={s.mismatchBanner}><Text style={s.mismatchTxt}>⚠️ Delivery is {deliveryPct}% of revenue — high platform dependency</Text></View>}
          </SectionCard>

          {/* ── CASH FLOW EXPENSES ── */}
          <SectionCard title="🧾 Cash Flow Expenses" color="#D32F2F">
            {/* Quick add chips */}
            <Text style={s.quickLabel}>Quick Add:</Text>
            <View style={s.quickRow}>
              {['Warzywa','Cola/Pepsi','Gaz','C2C','Cleaning','Naprawy'].map(q=>(
                <TouchableOpacity key={q} style={s.quickChip} onPress={()=>quickAdd(q)} activeOpacity={0.7}>
                  <Text style={s.quickChipTxt}>+ {q}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {cfCats.map((e,i)=>{
              const pctOfRev = rev>0&&n(e.amount)>0 ? Math.round(n(e.amount)/rev*100) : 0;
              const isCustom = !CF_CATS.includes(e.name);
              return (
                <View key={i} style={s.cfRow}>
                  {isCustom ? (
                    <TextInput style={[s.cfNameInput]} value={e.name} onChangeText={v=>updateCF(i,'name',v)} placeholder="Category" placeholderTextColor="#bbb"/>
                  ) : (
                    <Text style={s.cfName}>{e.name}</Text>
                  )}
                  <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                    {pctOfRev>0&&<Text style={[s.cfPct,{color:pctOfRev>20?COLORS.danger:COLORS.warning}]}>{pctOfRev}%</Text>}
                    <TextInput
                      style={[s.cfInput, e.name==='Inne'&&n(e.amount)>100?s.cfInputWarn:null]}
                      value={e.amount} onChangeText={v=>updateCF(i,'amount',v)}
                      keyboardType="numeric" placeholder="0" placeholderTextColor="#ccc"
                    />
                    {isCustom&&<TouchableOpacity onPress={()=>removeCF(i)} hitSlop={{top:8,bottom:8,left:8,right:8}}><Text style={{color:'#ccc',fontSize:16}}>✕</Text></TouchableOpacity>}
                  </View>
                </View>
              );
            })}
            {inneWarn&&<View style={s.mismatchBanner}><Text style={s.mismatchTxt}>⚠️ "Inne" >100 PLN — please add a description in Notes below</Text></View>}
            <TouchableOpacity style={s.addCustom} onPress={()=>setCfCats(p=>[...p,{name:'',amount:''}])} activeOpacity={0.7}>
              <Text style={s.addCustomTxt}>+ Add Custom Expense</Text>
            </TouchableOpacity>
            <View style={s.deliveryTotal}>
              <Text style={s.deliveryTotalLbl}>Total CF Expenses</Text>
              <Text style={s.deliveryTotalVal}>{fmtN(totalCF)} PLN</Text>
            </View>
          </SectionCard>

          {/* ── SPEC STATUS ── */}
          <SectionCard title="📦 SPEC Status" color="#6A1B9A">
            {specDone ? (
              <View style={s.specDone}><Text style={s.specDoneTxt}>✅ SPEC order submitted for today</Text></View>
            ) : (
              <View>
                <View style={s.specPending}><Text style={s.specPendingTxt}>❌ SPEC order not yet submitted today</Text></View>
                <TouchableOpacity style={s.specBtn} onPress={()=>navigation.navigate('SPEC Order')} activeOpacity={0.8}>
                  <Text style={s.specBtnTxt}>Go to SPEC Order →</Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          {/* ── NOTES ── */}
          <SectionCard title="📝 Notes & Handover" color="#E65100">
            <View style={s.noteTypes}>
              {[{k:'general',l:'General'},{k:'maintenance',l:'🔧 Maintenance'},{k:'supplier',l:'📦 Supplier'},{k:'urgent',l:'🚨 Urgent'}].map(({k,l})=>(
                <TouchableOpacity key={k} style={[s.noteChip,noteType===k?s.noteChipOn:null]} onPress={()=>setNoteType(k)} activeOpacity={0.7}>
                  <Text style={[s.noteChipTxt,noteType===k?{color:'#fff'}:null]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={s.notesInput}
              placeholder={noteType==='maintenance'?"e.g. Fridge making noise, needs service...":noteType==='supplier'?"e.g. Need extra sauce tomorrow...":noteType==='urgent'?"Describe urgent issue...":"Shift handover notes, observations..."}
              placeholderTextColor="#bbb"
              multiline numberOfLines={3}
              value={notes} onChangeText={setNotes}
            />
          </SectionCard>

          {/* spacer for sticky bar */}
          <View style={{height:100}}/>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── STICKY BOTTOM BAR ── */}
      <View style={s.stickyBar}>
        <View style={s.stickyStats}>
          <View style={s.stickyStat}>
            <Text style={s.stickyStatLbl}>Revenue</Text>
            <Text style={s.stickyStatVal}>{fmtN(rev)}</Text>
          </View>
          <View style={s.stickySeparator}/>
          <View style={s.stickyStat}>
            <Text style={s.stickyStatLbl}>Expenses</Text>
            <Text style={[s.stickyStatVal,{color:'#EF9A9A'}]}>{fmtN(totalCF)}</Text>
          </View>
          <View style={s.stickySeparator}/>
          <View style={s.stickyStat}>
            <Text style={s.stickyStatLbl}>Profit</Text>
            <Text style={[s.stickyStatVal,{color:netProfit>=0?'#A5D6A7':'#EF9A9A'}]}>{fmtN(netProfit)}</Text>
          </View>
        </View>
        <TouchableOpacity style={[s.submitBtn,{opacity:saving?0.7:1}]} onPress={handleSubmit} disabled={saving} activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={s.submitTxt}>{drSubmitted&&cfSubmitted?'✅ Already Submitted':'Submit Report'}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:            { flex:1, backgroundColor:'#F4F6F8' },
  header:          { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#EEE' },
  headerTitle:     { fontSize:16, fontWeight:'800', color:'#222' },
  headerSub:       { fontSize:11, color:'#aaa', marginTop:2 },
  chip:            { borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  chipDone:        { backgroundColor:'#E8F5E9' },
  chipPending:     { backgroundColor:'#FFEBEE' },
  chipTxt:         { fontSize:10, fontWeight:'700' },
  content:         { padding:14 },
  mismatchBanner:  { backgroundColor:'#FFF3E0', borderRadius:8, padding:10, marginTop:8, borderLeftWidth:3, borderLeftColor:COLORS.warning },
  mismatchTxt:     { fontSize:12, color:'#E65100', fontWeight:'600', lineHeight:18 },
  deliveryTotal:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTopWidth:1, borderTopColor:'#F0F0F0', marginTop:6 },
  deliveryTotalLbl:{ fontSize:13, fontWeight:'800', color:'#333' },
  deliveryTotalVal:{ fontSize:15, fontWeight:'900', color:'#6A1B9A' },
  deliveryPct:     { fontSize:13, fontWeight:'800' },
  quickLabel:      { fontSize:11, fontWeight:'700', color:'#aaa', marginBottom:6, textTransform:'uppercase' },
  quickRow:        { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:12 },
  quickChip:       { backgroundColor:'#FFF3E0', borderRadius:20, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:'#FFCC80' },
  quickChipTxt:    { fontSize:11, color:'#E65100', fontWeight:'700' },
  cfRow:           { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  cfName:          { flex:1, fontSize:13, fontWeight:'600', color:'#333' },
  cfNameInput:     { flex:1, fontSize:13, color:'#333', borderWidth:1, borderColor:'#E0E0E0', borderRadius:6, paddingHorizontal:8, paddingVertical:5 },
  cfInput:         { width:90, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:8, paddingHorizontal:10, paddingVertical:7, fontSize:14, color:'#111', backgroundColor:'#FAFAFA', textAlign:'right' },
  cfInputWarn:     { borderColor:COLORS.danger },
  cfPct:           { fontSize:11, fontWeight:'700', width:30, textAlign:'right' },
  addCustom:       { borderWidth:1.5, borderColor:'#D32F2F', borderRadius:8, padding:10, alignItems:'center', marginTop:8, borderStyle:'dashed' },
  addCustomTxt:    { color:'#D32F2F', fontWeight:'700', fontSize:13 },
  specDone:        { backgroundColor:'#E8F5E9', borderRadius:10, padding:12 },
  specDoneTxt:     { fontSize:13, color:'#2E7D32', fontWeight:'700' },
  specPending:     { backgroundColor:'#FFEBEE', borderRadius:10, padding:12, marginBottom:8 },
  specPendingTxt:  { fontSize:13, color:'#C62828', fontWeight:'700' },
  specBtn:         { backgroundColor:'#6A1B9A', borderRadius:10, padding:12, alignItems:'center' },
  specBtnTxt:      { color:'#fff', fontWeight:'800', fontSize:13 },
  noteTypes:       { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:10 },
  noteChip:        { paddingHorizontal:10, paddingVertical:6, borderRadius:20, borderWidth:1.5, borderColor:COLORS.primary+'60' },
  noteChipOn:      { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  noteChipTxt:     { fontSize:11, fontWeight:'700', color:COLORS.primary },
  notesInput:      { backgroundColor:'#F8F8F8', borderRadius:10, padding:12, fontSize:13, color:'#222', minHeight:70, textAlignVertical:'top', borderWidth:1, borderColor:'#E0E0E0' },
  stickyBar:       { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#1B1B2F', paddingHorizontal:16, paddingVertical:12, paddingBottom:Platform.OS==='ios'?24:12, flexDirection:'row', alignItems:'center', gap:12, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:8, elevation:12 },
  stickyStats:     { flex:1, flexDirection:'row', alignItems:'center' },
  stickyStat:      { flex:1, alignItems:'center' },
  stickyStatLbl:   { fontSize:9, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:0.5 },
  stickyStatVal:   { fontSize:15, fontWeight:'900', color:'#fff', marginTop:1 },
  stickySeparator: { width:1, height:30, backgroundColor:'rgba(255,255,255,0.15)', marginHorizontal:4 },
  submitBtn:       { backgroundColor:COLORS.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:13 },
  submitTxt:       { color:'#fff', fontWeight:'900', fontSize:13 },
  successHeader:   { backgroundColor:COLORS.primary, padding:30, alignItems:'center' },
  successEmoji:    { fontSize:50, marginBottom:10 },
  successTitle:    { fontSize:22, fontWeight:'900', color:'#fff', marginBottom:4 },
  successBranch:   { fontSize:13, color:'rgba(255,255,255,0.8)' },
  succRow:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', backgroundColor:'#fff', borderRadius:12, padding:14, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:3, elevation:1 },
  succLabel:       { fontSize:13, fontWeight:'600', color:'#555' },
  succVal:         { fontSize:16, fontWeight:'900' },
  specReminder:    { backgroundColor:'#F3E5F5', borderRadius:12, padding:14, borderLeftWidth:3, borderLeftColor:'#6A1B9A' },
  specReminderTxt: { fontSize:13, color:'#6A1B9A', fontWeight:'700' },
  newBtn:          { backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center' },
  newBtnTxt:       { color:'#fff', fontWeight:'900', fontSize:15 },
  workersHeader:   { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  workersLbl:      { fontSize:13, fontWeight:'700', color:'#333' },
  workersTot:      { fontSize:12, fontWeight:'700', color:COLORS.primary },
  workerRow:       { flexDirection:'row', alignItems:'center', paddingVertical:8, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  workerName:      { flex:1, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:8, paddingHorizontal:10, paddingVertical:7, fontSize:13, color:'#111', backgroundColor:'#FAFAFA' },
  workerHours:     { width:70, borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:8, paddingHorizontal:10, paddingVertical:7, fontSize:13, fontWeight:'800', color:'#111', backgroundColor:'#FAFAFA', textAlign:'center' },
  workerDel:       { width:28, alignItems:'center' },
  addWorkerBtn:    { marginTop:8, paddingVertical:8, alignItems:'center', borderWidth:1.5, borderColor:COLORS.primary, borderRadius:8, borderStyle:'dashed' },
  addWorkerTxt:    { fontSize:13, fontWeight:'700', color:COLORS.primary },
});
