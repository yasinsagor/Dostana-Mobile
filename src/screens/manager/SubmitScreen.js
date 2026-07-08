import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import {
  supabase, insertDailyReport, fetchDailyReports, fetchSpecOrders,
  fetchBranchWorkers, saveBranchWorkers, updateDailyReport, fetchHaccpCompletion,
} from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── constants ─────────────────────────────────────────────── */
const PLATFORMS = ['wolt','glovo','uber_eats','bolt','pyszne','repos'];
const PLATFORM_LABELS = { wolt:'Wolt', glovo:'Glovo', uber_eats:'Uber Eats', bolt:'Bolt Food', pyszne:'Pyszne.pl', repos:'Restaumatic' };
const CF_CATS = ['Warzywa','Cola/Pepsi','Gaz','C2C','Spec','Wynajem','Pracownicy','Inne'];

function todayStr() { return new Date().toISOString().slice(0,10); }
function yesterdayStr() { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function prevDayOf(dateStr) { const d=new Date(dateStr); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); }
function fmtN(n) { return Math.round(n).toLocaleString(); }
function n(v) { return parseFloat(v)||0; }
function blankCfCats() { return CF_CATS.map(name=>({name,amount:''})); }
function fmtDisplayDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}

/* ─── Calendar modal ────────────────────────────────────────── */
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function CalendarModal({ visible, selected, onSelect, onClose }) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    const now = new Date();
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  // build grid: first day of month (Mon=0 offset)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const lastDay  = new Date(viewYear, viewMonth + 1, 0);
  // Monday-based offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);

  function isoFor(day) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    return `${viewYear}-${mm}-${dd}`;
  }

  function isFuture(day) {
    return new Date(isoFor(day)) > today;
  }

  const isNextDisabled = viewYear > today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth >= today.getMonth());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={cal.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={cal.box}>
          {/* Month nav */}
          <View style={cal.nav}>
            <TouchableOpacity onPress={prevMonth} style={cal.navBtn} activeOpacity={0.7}>
              <Text style={cal.navArrow}>‹</Text>
            </TouchableOpacity>
            <Text style={cal.monthLabel}>{MONTHS[viewMonth]} {viewYear}</Text>
            <TouchableOpacity onPress={nextMonth} style={cal.navBtn} activeOpacity={0.7} disabled={isNextDisabled}>
              <Text style={[cal.navArrow, isNextDisabled && {color:'#ccc'}]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={cal.row}>
            {DAYS.map(d => (
              <View key={d} style={cal.cell}>
                <Text style={cal.dayHeader}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Date grid */}
          {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
            <View key={row} style={cal.row}>
              {cells.slice(row * 7, row * 7 + 7).map((day, col) => {
                if (!day) return <View key={col} style={cal.cell} />;
                const iso = isoFor(day);
                const isSelected = iso === selected;
                const isToday = iso === todayStr();
                const future = isFuture(day);
                return (
                  <TouchableOpacity
                    key={col}
                    style={cal.cell}
                    onPress={() => { if (!future) { onSelect(iso); onClose(); } }}
                    activeOpacity={future ? 1 : 0.7}
                    disabled={future}
                  >
                    <View style={[
                      cal.dayCircle,
                      isSelected && cal.daySelected,
                      isToday && !isSelected && cal.dayToday,
                    ]}>
                      <Text style={[
                        cal.dayTxt,
                        isSelected && cal.dayTxtSelected,
                        isToday && !isSelected && { color: COLORS.primary },
                        future && { color: '#DDD' },
                      ]}>{day}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <TouchableOpacity style={cal.todayBtn} onPress={() => { onSelect(todayStr()); onClose(); }} activeOpacity={0.8}>
            <Text style={cal.todayBtnTxt}>Go to Today</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const cal = StyleSheet.create({
  overlay:      { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'center', alignItems:'center', padding:20 },
  box:          { backgroundColor:'#fff', borderRadius:20, padding:16, width:'100%', maxWidth:340, shadowColor:'#000', shadowOpacity:0.2, shadowRadius:16, elevation:12 },
  nav:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:12 },
  navBtn:       { padding:8 },
  navArrow:     { fontSize:26, color:'#333', fontWeight:'300', lineHeight:30 },
  monthLabel:   { fontSize:15, fontWeight:'800', color:'#222' },
  row:          { flexDirection:'row', marginBottom:2 },
  cell:         { flex:1, alignItems:'center', paddingVertical:3 },
  dayHeader:    { fontSize:10, fontWeight:'700', color:'#aaa', textTransform:'uppercase' },
  dayCircle:    { width:34, height:34, borderRadius:17, alignItems:'center', justifyContent:'center' },
  daySelected:  { backgroundColor:COLORS.primary },
  dayToday:     { borderWidth:2, borderColor:COLORS.primary },
  dayTxt:       { fontSize:13, fontWeight:'600', color:'#333' },
  dayTxtSelected:{ color:'#fff', fontWeight:'900' },
  todayBtn:     { marginTop:10, backgroundColor:'#F4F6F8', borderRadius:10, padding:12, alignItems:'center' },
  todayBtnTxt:  { fontSize:13, fontWeight:'700', color:COLORS.primary },
});

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

  /* ── date selection ── */
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const isToday = selectedDate === todayStr();

  const draftKey = `submit_draft_${branch}_${selectedDate}`;

  /* ── existing record IDs (set when editing) ── */
  const [drId, setDrId] = useState(null);
  const [cfId, setCfId] = useState(null);

  /* ── form state ── */
  const [revenue,   setRevenue]   = useState('');
  const [card,      setCard]      = useState('');
  const [cash,      setCash]      = useState('');
  const [workers,   setWorkers]   = useState([{ name: '', hours: '' }]);
  const [platforms, setPlatforms] = useState({ wolt:'', glovo:'', uber_eats:'', bolt:'', pyszne:'', repos:'' });
  const [cfCats,    setCfCats]    = useState(blankCfCats());
  const [noteType,  setNoteType]  = useState('general');
  const [notes,     setNotes]     = useState('');

  /* ── status ── */
  const [drSubmitted,  setDrSubmitted]  = useState(false);
  const [cfSubmitted,  setCfSubmitted]  = useState(false);
  const [specDone,     setSpecDone]     = useState(false);
  const [prevDayRev,   setPrevDayRev]   = useState(0);
  const [saving,       setSaving]       = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [draftLoaded,  setDraftLoaded]  = useState(false);
  const [showCal,      setShowCal]      = useState(false);
  const [haccpRequirements, setHaccpRequirements] = useState([]);
  const [haccpLoading, setHaccpLoading] = useState(false);
  const autoSaveTimer = useRef(null);

  /* ── reset form when date changes ── */
  function resetForm() {
    setRevenue(''); setCard(''); setCash('');
    setWorkers([{ name: '', hours: '' }]);
    setPlatforms({ wolt:'', glovo:'', uber_eats:'', bolt:'', pyszne:'', repos:'' });
    setCfCats(blankCfCats());
    setNotes(''); setNoteType('general');
    setDrId(null); setCfId(null);
    setDrSubmitted(false); setCfSubmitted(false); setSpecDone(false);
    setHaccpRequirements([]);
    setDraftLoaded(false);
  }

  function switchDate(date) {
    resetForm();
    setSelectedDate(date);
  }

  /* save worker names to DB whenever they change (names only, not hours) */
  useEffect(() => {
    const names = workers.map(w => w.name).filter(Boolean);
    if (!names.length) return;
    saveBranchWorkers(branch, names);
    AsyncStorage.setItem(`workers_${branch}`, JSON.stringify(names)).catch(() => {});
  }, [workers, branch]);

  /* ── load data for selected date ── */
  useEffect(() => {
    async function init() {
      // 1. Load worker names from DB (canonical list for branch)
      let workerList = [];
      try {
        const names = await fetchBranchWorkers(branch);
        if (names.length > 0) workerList = names.map(name => ({ name, hours: '' }));
      } catch {
        try {
          const raw = await AsyncStorage.getItem(`workers_${branch}`);
          if (raw) workerList = JSON.parse(raw).map(name => ({ name, hours: '' }));
        } catch {}
      }

      // 2. Fetch existing reports for selectedDate
      let drRecord = null, cfRecord = null;
      try {
        const [{ data:dr }, { data:cf }, { data:sp }] = await Promise.all([
          supabase.from('daily_reports').select('*').eq('branch',branch).eq('date',selectedDate).limit(1),
          supabase.from('daily_reports').select('*').eq('branch',branch).eq('date',selectedDate).limit(1),
          supabase.from('spec_orders').select('id').eq('branch',branch).eq('date',selectedDate).limit(1),
        ]);
        drRecord = dr && dr[0] ? dr[0] : null;
        cfRecord = cf && cf[0] ? { ...cf[0], expenses: cf[0].cashflow_expenses || [] } : null;
        setDrSubmitted(!!drRecord);
        setCfSubmitted(!!cfRecord);
        setSpecDone(!!(sp && sp.length));
      } catch {}

      try {
        setHaccpLoading(true);
        const requirements = await fetchHaccpCompletion(branch, selectedDate);
        setHaccpRequirements(requirements);
      } catch {
        setHaccpRequirements([]);
      } finally {
        setHaccpLoading(false);
      }

      if (drRecord) {
        // Editing existing daily report — populate form from DB
        setDrId(drRecord.id);
        setRevenue(String(drRecord.utarg || drRecord.total_revenue || drRecord.revenue || ''));
        setCard(String(drRecord.card || ''));
        setCash(String(drRecord.cash || ''));

        // Merge existing report hours into worker list
        try {
          const wh = Array.isArray(drRecord.worker_hours)
            ? drRecord.worker_hours
            : (typeof drRecord.worker_hours === 'string' ? JSON.parse(drRecord.worker_hours) : []);
          if (Array.isArray(wh) && wh.length > 0) {
            // Update hours for known workers
            let merged = workerList.map(w => {
              const found = wh.find(x => x.name === w.name);
              return found ? { ...w, hours: String(found.hours || '') } : w;
            });
            // Add workers from report not in branch list
            wh.forEach(x => {
              if (x.name && !merged.find(w => w.name === x.name)) {
                merged.push({ name: x.name, hours: String(x.hours || '') });
              }
            });
            workerList = merged;
          }
        } catch {}

        // Populate platforms
        const pObj = {};
        PLATFORMS.forEach(p => { pObj[p] = String(p === 'repos' ? (drRecord.restaumatic || 0) : (drRecord[p] || '')); });
        setPlatforms(pObj);

        if (drRecord.notes) {
          const noteMatch = drRecord.notes.match(/^\[(\w+)\] ([\s\S]*)$/);
          if (noteMatch) { setNoteType(noteMatch[1].toLowerCase()); setNotes(noteMatch[2]); }
          else setNotes(drRecord.notes);
        }
      } else {
        // New report — try to restore draft
        try {
          const raw = await AsyncStorage.getItem(draftKey);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.revenue)   setRevenue(d.revenue);
            if (d.card)      setCard(d.card);
            if (d.cash)      setCash(d.cash);
            if (d.workers)   workerList = d.workers;
            else if (d.hours) workerList = [{ name: '', hours: d.hours }];
            if (d.platforms) setPlatforms(d.platforms);
            if (d.cfCats)    setCfCats(d.cfCats);
            if (d.notes)     setNotes(d.notes);
            if (d.noteType)  setNoteType(d.noteType);
          }
        } catch {}
      }

      if (cfRecord) {
        setCfId(cfRecord.id);
        try {
          const expenses = typeof cfRecord.expenses === 'string'
            ? JSON.parse(cfRecord.expenses)
            : cfRecord.expenses;
          if (Array.isArray(expenses) && expenses.length > 0) {
            const base = CF_CATS.map(name => {
              const found = expenses.find(e => e.name === name);
              return { name, amount: found ? String(found.amount || '') : '' };
            });
            const custom = expenses
              .filter(e => !CF_CATS.includes(e.name))
              .map(e => ({ name: e.name || '', amount: String(e.amount || '') }));
            setCfCats([...base, ...custom]);
          }
        } catch {}
        if (!drRecord && cfRecord.notes) setNotes(cfRecord.notes);
      }

      if (workerList.length > 0) setWorkers(workerList);
      else setWorkers([{ name: '', hours: '' }]);

      // Previous day's revenue for comparison
      try {
        const prevDate = prevDayOf(selectedDate);
        const { data } = await supabase.from('daily_reports')
          .select('total_revenue,revenue').eq('branch',branch).eq('date',prevDate).limit(1);
        if (data && data[0]) setPrevDayRev(data[0].total_revenue || data[0].revenue || 0);
        else setPrevDayRev(0);
      } catch {}

      setDraftLoaded(true);
    }
    init();
  }, [branch, selectedDate]);

  /* ── auto-save draft (only for new reports, not edits) ── */
  const autoSave = useCallback(() => {
    if (drId) return; // don't auto-save drafts when editing existing record
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(draftKey, JSON.stringify({ revenue, card, cash, workers, platforms, cfCats, notes, noteType }));
      } catch {}
    }, 800);
  }, [revenue, card, cash, workers, platforms, cfCats, notes, noteType, draftKey, drId]);

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
  const diffPct       = prevDayRev>0 && rev>0 ? Math.round((rev-prevDayRev)/prevDayRev*100) : null;

  const cfFilled   = cfCats.filter(e=>e.name&&n(e.amount)>0);
  const totalCF    = cfFilled.reduce((s,e)=>s+n(e.amount),0);
  const netProfit  = rev - totalCF;
  const laborCost  = hoursN * 22;
  const revPerHour = hoursN > 0 ? Math.round(rev/hoursN) : 0;
  const missingHaccp = haccpRequirements.filter(item => !item.is_complete);
  const haccpConfigured = haccpRequirements.length > 0;
  const haccpComplete = haccpConfigured && missingHaccp.length === 0;

  const bigPlatform = PLATFORMS.find(p => rev>0 && n(platforms[p])/rev > 0.35);
  const inneRow  = cfCats.find(e=>e.name==='Inne');
  const inneWarn = inneRow && n(inneRow.amount) > 100;

  const isEditMode = !!(drId || cfId);

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
    // No "already submitted" block — edit mode allows updating
    return errs;
  }

  /* ── submit ── */
  async function handleSubmit() {
    if (haccpLoading) {
      Alert.alert('HACCP check loading', 'Please wait a moment while the app checks today\'s required HACCP records.');
      return;
    }
    if (!haccpConfigured) {
      Alert.alert(
        'HACCP setup required',
        'Add this branch\'s fridges, freezers, bemars, rooms/tools/cold units and pest areas before submitting the daily report.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open HACCP', onPress: () => navigation.navigate('HACCP') },
        ]
      );
      return;
    }
    if (!haccpComplete) {
      const names = missingHaccp.slice(0, 6).map(item => `• ${item.requirement_name} (${item.completed_count}/${item.required_count})`).join('\n');
      Alert.alert(
        'Complete HACCP first',
        `${names}${missingHaccp.length > 6 ? '\n• ...' : ''}\n\nDaily report cannot be submitted until these checks are saved.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open HACCP', onPress: () => navigation.navigate('HACCP') },
        ]
      );
      return;
    }
    const errs = validate();
    if (errs.length) {
      Alert.alert('⚠️ Check Before Submit', errs.join('\n'), [
        { text:'Fix Issues', style:'cancel' },
        { text: isEditMode ? 'Update Anyway' : 'Submit Anyway', style:'destructive', onPress: doSubmit },
      ]);
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setSaving(true);
    try {
      const reportData = {
        branch, date: selectedDate,
        utarg: rev, card: cardN, cash: cashN, working_hours: hoursN,
        worker_hours: workers.filter(w => n(w.hours) > 0),
        total_delivery: totalDelivery,
        total_revenue: rev,
        total_expenses: totalCF,
        net_profit: netProfit,
        ...Object.fromEntries(PLATFORMS.map(p=>[p,n(platforms[p])])),
        restaumatic: n(platforms.repos),
        cashflow_expenses: cfFilled,
      };

      // 1. Daily report — update if exists, insert if new
      if (drId) {
        await updateDailyReport(drId, reportData);
      } else {
        const inserted = await insertDailyReport(reportData);
        if (inserted) setDrId(inserted.id);
      }
      setDrSubmitted(true);

      // Cash flow lives inside the daily report, so every tab reads one record.
      setCfId(drId || `${branch}_${selectedDate}`);
      setCfSubmitted(true);

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
        <View style={[s.successHeader, isEditMode && { backgroundColor: '#1565C0' }]}>
          <Text style={s.successEmoji}>{isEditMode ? '✏️' : '🎉'}</Text>
          <Text style={s.successTitle}>{isEditMode ? 'Report Updated!' : 'Report Submitted!'}</Text>
          <Text style={s.successBranch}>{branch} · {selectedDate}</Text>
        </View>
        <ScrollView contentContainerStyle={{padding:20,gap:12}}>
          {[
            { label:'Revenue',     value:`${fmtN(rev)} PLN`,     color:COLORS.primary },
            { label:'CF Expenses', value:`${fmtN(totalCF)} PLN`, color:COLORS.danger  },
            { label:'Net Profit',  value:`${fmtN(netProfit)} PLN`, color: netProfit>=0?'#2E7D32':COLORS.danger },
            { label:'Margin',      value:`${margin}%`,            color:margin>15?'#2E7D32':margin>8?COLORS.warning:COLORS.danger },
            { label:'Hours',       value:hoursN>0?`${hoursN}h (${workers.filter(w=>n(w.hours)>0).length} workers)`:'—', color:'#555' },
            { label:'vs Prev Day', value:diffPct!==null?`${diffPct>0?'+':''}${diffPct}%`:'—', color:diffPct>=0?COLORS.primary:COLORS.danger },
          ].map((r,i)=>(
            <View key={i} style={s.succRow}>
              <Text style={s.succLabel}>{r.label}</Text>
              <Text style={[s.succVal,{color:r.color}]}>{r.value}</Text>
            </View>
          ))}
          {!specDone && isToday && (
            <TouchableOpacity style={s.specReminder} onPress={()=>navigation.navigate('Submit', { tab: 'spec' })} activeOpacity={0.8}>
              <Text style={s.specReminderTxt}>📦 SPEC order not submitted yet — tap to submit now →</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.newBtn} onPress={()=>{
            setSubmitted(false);
            setRevenue(''); setCard(''); setCash('');
            setWorkers(w=>w.map(x=>({...x,hours:''})));
            setNotes('');
            setPlatforms({wolt:'',glovo:'',uber_eats:'',bolt:'',pyszne:'',repos:''});
            setCfCats(blankCfCats());
          }}>
            <Text style={s.newBtnTxt}>Submit New Report</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── main form ── */
  const submitLabel = isEditMode
    ? (saving ? null : '✏️ Update Report')
    : (saving ? null : (drSubmitted && cfSubmitted ? '✅ Already Submitted' : 'Submit Report'));

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <Text style={s.headerTitle}>📤 {branch}</Text>
          <TouchableOpacity style={s.datePickerBtn} onPress={() => setShowCal(true)} activeOpacity={0.75}>
            <Text style={s.datePickerIcon}>📅</Text>
            <View style={{flex:1}}>
              <Text style={s.datePickerTxt}>{fmtDisplayDate(selectedDate)}</Text>
              <Text style={s.datePickerSub}>{isToday ? 'Today' : selectedDate === yesterdayStr() ? 'Yesterday' : 'Past date'} · tap to change</Text>
            </View>
            {isEditMode && (
              <View style={s.editBadge}>
                <Text style={s.editBadgeTxt}>EDIT</Text>
              </View>
            )}
          </TouchableOpacity>
          <Text style={s.headerSub}>{draftLoaded ? (isEditMode ? 'Loaded from DB' : 'Draft restored') : 'Loading...'}</Text>
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
          <SectionCard title="HACCP / GMP status" color={haccpComplete ? COLORS.primary : COLORS.danger}>
            {haccpLoading ? (
              <View style={s.haccpStatusRow}>
                <ActivityIndicator color={COLORS.primary} size="small" />
                <Text style={s.haccpText}>Checking required register records...</Text>
              </View>
            ) : !haccpConfigured ? (
              <>
                <Text style={s.haccpBad}>Branch HACCP setup is not configured yet.</Text>
                <Text style={s.haccpText}>Add fridges, freezers, bemars, rooms/tools/cold units and pest areas in the HACCP tab before submitting reports.</Text>
                <TouchableOpacity style={s.haccpBtn} onPress={() => navigation.navigate('HACCP')}>
                  <Text style={s.haccpBtnTxt}>Open HACCP setup</Text>
                </TouchableOpacity>
              </>
            ) : haccpComplete ? (
              <Text style={s.haccpGood}>All required HACCP/GMP records are complete for {selectedDate}.</Text>
            ) : (
              <>
                <Text style={s.haccpBad}>Complete these before submitting:</Text>
                {missingHaccp.slice(0, 5).map(item => (
                  <Text key={item.equipment_id} style={s.haccpMissing}>• {item.requirement_name}: {item.completed_count}/{item.required_count}</Text>
                ))}
                {missingHaccp.length > 5 && <Text style={s.haccpText}>And {missingHaccp.length - 5} more item(s).</Text>}
                <TouchableOpacity style={s.haccpBtn} onPress={() => navigation.navigate('HACCP')}>
                  <Text style={s.haccpBtnTxt}>Open HACCP register</Text>
                </TouchableOpacity>
              </>
            )}
          </SectionCard>

          {/* ── REVENUE ── */}
          <SectionCard title="💰 Revenue" color={COLORS.primary}>
            <NumInput label="Total Revenue (PLN)" value={revenue} onChange={setRevenue}
              warning={rev>0&&diffPct!==null?`${diffPct>0?'+':''}${diffPct}% vs prev day (${fmtN(prevDayRev)} PLN)`:undefined}/>
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
          {isToday && (
            <SectionCard title="📦 SPEC Status" color="#6A1B9A">
              {specDone ? (
                <View style={s.specDone}><Text style={s.specDoneTxt}>✅ SPEC order submitted for today</Text></View>
              ) : (
                <View>
                  <View style={s.specPending}><Text style={s.specPendingTxt}>❌ SPEC order not yet submitted today</Text></View>
                  <TouchableOpacity style={s.specBtn} onPress={()=>navigation.navigate('Submit', { tab: 'spec' })} activeOpacity={0.8}>
                    <Text style={s.specBtnTxt}>Go to SPEC Order →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SectionCard>
          )}

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

          <View style={{height:100}}/>
        </ScrollView>
      </KeyboardAvoidingView>

      <CalendarModal
        visible={showCal}
        selected={selectedDate}
        onSelect={switchDate}
        onClose={() => setShowCal(false)}
      />

      {/* ── STICKY BOTTOM BAR ── */}
      <View style={[s.stickyBar, isEditMode && {backgroundColor:'#1A237E'}]}>
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
        <TouchableOpacity
          style={[s.submitBtn, isEditMode && s.updateBtn, {opacity:saving?0.7:1}]}
          onPress={handleSubmit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={s.submitTxt}>{submitLabel}</Text>
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
  datePickerBtn:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F4F6F8', borderRadius:12, paddingHorizontal:12, paddingVertical:8, marginTop:6, borderWidth:1.5, borderColor:'#E0E0E0' },
  datePickerIcon:  { fontSize:18 },
  datePickerTxt:   { fontSize:13, fontWeight:'800', color:'#222' },
  datePickerSub:   { fontSize:10, color:'#aaa', marginTop:1 },
  editBadge:       { backgroundColor:'#1565C0', borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  editBadgeTxt:    { fontSize:9, fontWeight:'900', color:'#fff', letterSpacing:1 },
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
  haccpStatusRow:  { flexDirection:'row', alignItems:'center', gap:8 },
  haccpText:       { color:'#666', fontSize:12, lineHeight:18 },
  haccpGood:       { color:COLORS.primary, fontSize:13, fontWeight:'900', lineHeight:18 },
  haccpBad:        { color:COLORS.danger, fontSize:13, fontWeight:'900', lineHeight:18 },
  haccpMissing:    { color:'#333', fontSize:12, lineHeight:19, fontWeight:'700' },
  haccpBtn:        { alignSelf:'flex-start', backgroundColor:COLORS.primary, borderRadius:10, paddingHorizontal:12, paddingVertical:9, marginTop:6 },
  haccpBtnTxt:     { color:'#fff', fontSize:12, fontWeight:'900' },
  submitBtn:       { backgroundColor:COLORS.primary, borderRadius:12, paddingHorizontal:18, paddingVertical:13 },
  updateBtn:       { backgroundColor:'#1565C0' },
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
