import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, ActivityIndicator, RefreshControl, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── helpers ───────────────────────────────────────────────── */
const DAY_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function getMonday(d = new Date()) {
  const dt = new Date(d);
  const day = dt.getDay();
  dt.setDate(dt.getDate() - day + (day === 0 ? -6 : 1));
  dt.setHours(0,0,0,0);
  return dt;
}
function addDays(d, n) { const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt; }
function isoDate(d) { return d.toISOString().slice(0,10); }
function fmtShort(iso) { const [,m,d]=iso.split('-'); return `${d}.${m}`; }
function calcHours(s,e) {
  if(!s||!e) return 0;
  const [sh,sm]=s.split(':').map(Number);
  const [eh,em]=e.split(':').map(Number);
  return Math.max(0,((eh*60+em)-(sh*60+sm))/60);
}
function fmtHrs(h) { return h===Math.floor(h)?`${h}h`:`${Math.floor(h)}h${Math.round((h%1)*60)}m`; }
function staffKey(branch) { return `staff_${branch}`; }

/* ─── sub-components ───────────────────────────────────────── */
function ShiftCard({ shift, onEdit, onDelete }) {
  const hrs = calcHours(shift.shift_start, shift.shift_end);
  return (
    <View style={sc.card}>
      <View style={sc.left}>
        <Text style={sc.name}>{shift.staff_name}</Text>
        <Text style={sc.time}>{shift.shift_start} – {shift.shift_end}
          <Text style={sc.hrs}>  {fmtHrs(hrs)}</Text>
        </Text>
        {shift.role ? <Text style={sc.role}>{shift.role}</Text> : null}
        {shift.note ? <Text style={sc.note}>📝 {shift.note}</Text> : null}
      </View>
      <View style={sc.actions}>
        <TouchableOpacity onPress={onEdit} style={sc.editBtn}><Text style={{fontSize:14}}>✏️</Text></TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={sc.delBtn}><Text style={{fontSize:14}}>🗑️</Text></TouchableOpacity>
      </View>
    </View>
  );
}
const sc = StyleSheet.create({
  card:    { backgroundColor:'#fff', borderRadius:10, padding:12, marginBottom:6, flexDirection:'row', alignItems:'flex-start', borderLeftWidth:3, borderLeftColor:COLORS.primary, elevation:1, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:3 },
  left:    { flex:1 },
  name:    { fontSize:13, fontWeight:'800', color:'#222', marginBottom:2 },
  time:    { fontSize:12, color:'#555' },
  hrs:     { fontSize:11, color:COLORS.primary, fontWeight:'700' },
  role:    { fontSize:11, color:'#888', marginTop:2 },
  note:    { fontSize:11, color:'#aaa', marginTop:1, fontStyle:'italic' },
  actions: { flexDirection:'row', gap:6 },
  editBtn: { padding:6, backgroundColor:'#E3F2FD', borderRadius:8 },
  delBtn:  { padding:6, backgroundColor:'#FFEBEE', borderRadius:8 },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerScheduleScreen() {
  const { user } = useAuth();
  const branch = user?.branch || '';

  const [weekStart, setWeekStart] = useState(() => getMonday());
  const [shifts,    setShifts]    = useState([]);
  const [staff,     setStaff]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [refreshing,setRefreshing]= useState(false);
  const [modal,     setModal]     = useState(null); // null | {mode:'add'|'edit', dayIndex, shift?}

  // modal form state
  const [fStaff,  setFStaff]  = useState('');
  const [fStart,  setFStart]  = useState('');
  const [fEnd,    setFEnd]    = useState('');
  const [fRole,   setFRole]   = useState('');
  const [fNote,   setFNote]   = useState('');
  const [saving,  setSaving]  = useState(false);

  const ws = isoDate(weekStart);
  const days = Array.from({length:7}, (_,i) => ({ index:i, iso: isoDate(addDays(weekStart,i)), short:DAY_SHORT[i], full:DAY_FULL[i] }));

  const loadStaff = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(staffKey(branch));
      setStaff(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [branch]);

  const loadShifts = useCallback(async () => {
    try {
      const { data } = await supabase.from('schedules').select('*').eq('branch', branch).eq('week_start', ws).order('shift_start');
      setShifts(data || []);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, [branch, ws]);

  useFocusEffect(useCallback(() => {
    loadStaff();
    setLoading(true);
    loadShifts();
  }, [loadStaff, loadShifts]));

  function prevWeek() { setWeekStart(d => addDays(d, -7)); }
  function nextWeek() { setWeekStart(d => addDays(d,  7)); }

  function openAdd(dayIndex) {
    setFStaff(''); setFStart('09:00'); setFEnd('17:00'); setFRole(''); setFNote('');
    setModal({ mode:'add', dayIndex });
  }
  function openEdit(shift) {
    setFStaff(shift.staff_name); setFStart(shift.shift_start); setFEnd(shift.shift_end);
    setFRole(shift.role||''); setFNote(shift.note||'');
    setModal({ mode:'edit', dayIndex: shift.day_index, shift });
  }

  async function saveShift() {
    if (!fStaff.trim()) { Alert.alert('Missing', 'Please enter a staff name.'); return; }
    if (!fStart.match(/^\d{2}:\d{2}$/) || !fEnd.match(/^\d{2}:\d{2}$/)) {
      Alert.alert('Invalid time', 'Use HH:MM format (e.g. 09:00).'); return;
    }
    if (calcHours(fStart, fEnd) <= 0) { Alert.alert('Invalid time', 'End time must be after start.'); return; }
    setSaving(true);
    const payload = {
      branch, week_start: ws, day_index: modal.dayIndex,
      staff_name: fStaff.trim(), shift_start: fStart, shift_end: fEnd,
      role: fRole.trim()||null, note: fNote.trim()||null,
    };
    try {
      if (modal.mode === 'add') {
        await supabase.from('schedules').insert(payload);
      } else {
        await supabase.from('schedules').update(payload).eq('id', modal.shift.id);
      }
      setModal(null);
      loadShifts();
    } catch(e) { Alert.alert('Error', e.message); }
    setSaving(false);
  }

  function confirmDelete(id) {
    Alert.alert('Delete shift?', 'This cannot be undone.', [
      { text:'Cancel', style:'cancel' },
      { text:'Delete', style:'destructive', onPress: async () => {
          await supabase.from('schedules').delete().eq('id', id);
          loadShifts();
        }},
    ]);
  }

  /* share schedule */
  async function shareSchedule() {
    if (shifts.length === 0) { Alert.alert('No shifts', 'Add shifts before sharing.'); return; }
    const lines = [];
    lines.push(`📅 *DOSTANA KEBAB — ${branch}*`);
    lines.push(`Week: ${fmtShort(days[0].iso)} – ${fmtShort(days[6].iso)} ${weekStart.getFullYear()}`);
    lines.push('━━━━━━━━━━━━━━━━━━━━');
    days.forEach(day => {
      const dayShifts = shifts.filter(sh => sh.day_index === day.index);
      if (dayShifts.length === 0) return;
      lines.push(`\n*${day.full} ${fmtShort(day.iso)}*`);
      dayShifts.forEach(sh => {
        const hrs = calcHours(sh.shift_start, sh.shift_end);
        let line = `  • ${sh.staff_name}: ${sh.shift_start}–${sh.shift_end} (${fmtHrs(hrs)})`;
        if (sh.role) line += ` · ${sh.role}`;
        if (sh.note) line += `\n    📝 ${sh.note}`;
        lines.push(line);
      });
    });
    lines.push('\n━━━━━━━━━━━━━━━━━━━━');
    // staff totals
    const totals = {};
    shifts.forEach(sh => { totals[sh.staff_name] = (totals[sh.staff_name]||0) + calcHours(sh.shift_start, sh.shift_end); });
    const totalLines = Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([n,h])=>`  ${n}: ${fmtHrs(h)}`);
    if (totalLines.length > 0) {
      lines.push('*Weekly Hours:*');
      lines.push(...totalLines);
    }
    const message = lines.join('\n');
    try {
      await Share.share({ message, title: `Schedule — ${branch}` });
    } catch (e) { Alert.alert('Share failed', e.message); }
  }

  /* export PDF */
  async function exportSchedulePDF() {
    if (shifts.length === 0) { Alert.alert('No shifts', 'Add shifts before exporting.'); return; }

    const staffTotals = {};
    shifts.forEach(sh => { staffTotals[sh.staff_name] = (staffTotals[sh.staff_name]||0) + calcHours(sh.shift_start, sh.shift_end); });

    const dayRows = days.map(day => {
      const dayShifts = shifts.filter(sh => sh.day_index === day.index).sort((a,b)=>a.shift_start.localeCompare(b.shift_start));
      if (dayShifts.length === 0) {
        return `<tr><td class="day-cell"><b>${day.full}</b><br/><span class="date">${fmtShort(day.iso)}</span></td><td class="empty-cell">— no shifts —</td></tr>`;
      }
      const shiftHtml = dayShifts.map(sh => {
        const hrs = calcHours(sh.shift_start, sh.shift_end);
        return `<div class="shift-row">
          <span class="staff-name">${sh.staff_name}</span>
          <span class="shift-time">${sh.shift_start} – ${sh.shift_end}</span>
          <span class="shift-hrs">${fmtHrs(hrs)}</span>
          ${sh.role ? `<span class="shift-role">${sh.role}</span>` : ''}
          ${sh.note ? `<span class="shift-note">📝 ${sh.note}</span>` : ''}
        </div>`;
      }).join('');
      const dayTotal = dayShifts.reduce((s,sh)=>s+calcHours(sh.shift_start,sh.shift_end),0);
      const isToday = day.iso === isoDate(new Date());
      return `<tr${isToday?' class="today-row"':''}>
        <td class="day-cell"><b>${day.full}</b><br/><span class="date">${fmtShort(day.iso)}</span><br/><span class="day-total">${fmtHrs(dayTotal)} total</span></td>
        <td>${shiftHtml}</td>
      </tr>`;
    }).join('');

    const summaryRows = Object.entries(staffTotals).sort((a,b)=>b[1]-a[1])
      .map(([name,hrs]) => `<tr><td>${name}</td><td>${fmtHrs(hrs)}</td><td>${Math.round(hrs*22)} PLN est.</td></tr>`).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #222; font-size: 12px; }
      h1 { color: #2E7D32; font-size: 20px; margin-bottom: 2px; }
      .meta { color: #888; font-size: 11px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th { background: #2E7D32; color: #fff; padding: 8px 10px; text-align: left; font-size: 12px; }
      td { padding: 10px; border-bottom: 1px solid #EEE; vertical-align: top; }
      .day-cell { width: 110px; background: #F9F9F9; font-size: 12px; }
      .date { color: #aaa; font-size: 10px; }
      .day-total { color: #2E7D32; font-weight: bold; font-size: 10px; margin-top: 4px; display: block; }
      .today-row td { background: #E8F5E9 !important; }
      .empty-cell { color: #ccc; font-style: italic; font-size: 11px; }
      .shift-row { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-bottom: 1px solid #F5F5F5; flex-wrap: wrap; }
      .shift-row:last-child { border-bottom: none; }
      .staff-name { font-weight: bold; min-width: 90px; color: #222; }
      .shift-time { color: #555; min-width: 100px; }
      .shift-hrs { color: #2E7D32; font-weight: bold; min-width: 40px; }
      .shift-role { background: #E8F5E9; color: #2E7D32; border-radius: 4px; padding: 1px 6px; font-size: 10px; }
      .shift-note { color: #aaa; font-size: 10px; font-style: italic; width: 100%; }
      h2 { color: #1565C0; font-size: 13px; border-bottom: 2px solid #1565C0; padding-bottom: 4px; margin-top: 0; }
      .sum-table th { background: #1565C0; }
      .sum-table td { padding: 7px 10px; }
      tr:nth-child(even) td { background: #F9F9F9; }
    </style></head><body>
      <h1>📅 Staff Schedule — ${branch}</h1>
      <div class="meta">Week: ${fmtShort(days[0].iso)} – ${fmtShort(days[6].iso)} ${weekStart.getFullYear()} &nbsp;|&nbsp; Generated: ${fmtShort(isoDate(new Date()))}</div>

      <table>
        <thead><tr><th style="width:110px">Day</th><th>Shifts</th></tr></thead>
        <tbody>${dayRows}</tbody>
      </table>

      <h2>Weekly Summary</h2>
      <table class="sum-table">
        <thead><tr><th>Staff Member</th><th>Total Hours</th><th>Est. Labor</th></tr></thead>
        <tbody>${summaryRows}</tbody>
      </table>
    </body></html>`;

    try {
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const dest = FileSystem.cacheDirectory + `schedule_${branch}_${ws}.pdf`.replace(/\s/g,'_');
      await FileSystem.moveAsync({ from: uri, to: dest });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(dest, { mimeType:'application/pdf', dialogTitle:'Export Schedule PDF', UTI:'com.adobe.pdf' });
      } else {
        await Print.printAsync({ uri: dest });
      }
    } catch (e) { Alert.alert('PDF Export Failed', e.message); }
  }

  /* weekly summary */
  const staffHours = {};
  shifts.forEach(sh => {
    const h = calcHours(sh.shift_start, sh.shift_end);
    staffHours[sh.staff_name] = (staffHours[sh.staff_name]||0) + h;
  });
  const sortedStaff = Object.entries(staffHours).sort((a,b)=>b[1]-a[1]);
  const totalWeekHours = sortedStaff.reduce((s,[,h])=>s+h,0);
  const today = isoDate(new Date());

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.weekNav}>
          <TouchableOpacity onPress={prevWeek} style={s.navBtn}><Text style={s.navTxt}>‹</Text></TouchableOpacity>
          <View style={{alignItems:'center'}}>
            <Text style={s.weekTxt}>{fmtShort(days[0].iso)} – {fmtShort(days[6].iso)}</Text>
            <Text style={s.yearTxt}>{branch} · {weekStart.getFullYear()}</Text>
          </View>
          <TouchableOpacity onPress={nextWeek} style={s.navBtn}><Text style={s.navTxt}>›</Text></TouchableOpacity>
        </View>
        <View style={{flexDirection:'row',gap:8}}>
          <TouchableOpacity onPress={exportSchedulePDF} style={[s.shareBtn,{backgroundColor:'#1B5E20'}]} activeOpacity={0.8}>
            <Text style={{fontSize:15}}>📄</Text>
            <Text style={s.shareTxt}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareSchedule} style={s.shareBtn} activeOpacity={0.8}>
            <Text style={{fontSize:15}}>📤</Text>
            <Text style={s.shareTxt}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);loadShifts();}} tintColor={COLORS.primary}/>}
      >
        {/* Weekly summary */}
        {sortedStaff.length > 0 && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>Week Total — {fmtHrs(totalWeekHours)}</Text>
            <View style={s.summaryRow}>
              {sortedStaff.map(([name, hrs]) => (
                <View key={name} style={s.summaryChip}>
                  <Text style={s.summaryName}>{name}</Text>
                  <Text style={s.summaryHrs}>{fmtHrs(hrs)}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Days */}
        {days.map(day => {
          const dayShifts = shifts.filter(sh => sh.day_index === day.index);
          const isToday = day.iso === today;
          const totalDayHrs = dayShifts.reduce((s,sh)=>s+calcHours(sh.shift_start,sh.shift_end),0);
          return (
            <View key={day.index} style={[s.daySection, isToday && s.daySectionToday]}>
              <View style={s.dayHeader}>
                <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                  <Text style={[s.dayName, isToday && {color:COLORS.primary}]}>{day.full}</Text>
                  <Text style={s.dayDate}>{fmtShort(day.iso)}</Text>
                  {isToday && <Text style={s.todayBadge}>TODAY</Text>}
                </View>
                <View style={{flexDirection:'row', alignItems:'center', gap:8}}>
                  {totalDayHrs > 0 && <Text style={s.dayHrs}>{fmtHrs(totalDayHrs)}</Text>}
                  <TouchableOpacity onPress={()=>openAdd(day.index)} style={s.addBtn} activeOpacity={0.7}>
                    <Text style={s.addBtnTxt}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {dayShifts.length === 0
                ? <Text style={s.emptyDay}>No shifts scheduled</Text>
                : dayShifts.map(sh => (
                    <ShiftCard key={sh.id} shift={sh} onEdit={()=>openEdit(sh)} onDelete={()=>confirmDelete(sh.id)}/>
                  ))
              }
            </View>
          );
        })}
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={()=>setModal(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{modal?.mode==='add'?'➕ Add Shift':'✏️ Edit Shift'}</Text>
            <Text style={s.modalSub}>{modal !== null ? DAY_FULL[modal.dayIndex] : ''} · {modal !== null ? fmtShort(days[modal.dayIndex]?.iso||ws) : ''}</Text>

            {/* Staff picker */}
            <Text style={s.fieldLbl}>Staff Member</Text>
            {staff.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:8}}>
                <View style={{flexDirection:'row', gap:6}}>
                  {staff.map(m => (
                    <TouchableOpacity key={m.id} style={[s.staffChip, fStaff===m.name && s.staffChipOn]}
                      onPress={()=>{ setFStaff(m.name); if(!fRole) setFRole(m.role||''); }}>
                      <Text style={[s.staffChipTxt, fStaff===m.name && s.staffChipTxtOn]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            )}
            <TextInput style={s.input} value={fStaff} onChangeText={setFStaff} placeholder={staff.length?'Or type name…':'Staff name'} placeholderTextColor="#bbb"/>

            {/* Times */}
            <View style={{flexDirection:'row', gap:12}}>
              <View style={{flex:1}}>
                <Text style={s.fieldLbl}>Start (HH:MM)</Text>
                <TextInput style={s.input} value={fStart} onChangeText={setFStart} placeholder="09:00" keyboardType="numbers-and-punctuation" placeholderTextColor="#bbb"/>
              </View>
              <View style={{flex:1}}>
                <Text style={s.fieldLbl}>End (HH:MM)</Text>
                <TextInput style={s.input} value={fEnd} onChangeText={setFEnd} placeholder="17:00" keyboardType="numbers-and-punctuation" placeholderTextColor="#bbb"/>
              </View>
            </View>
            {fStart && fEnd && calcHours(fStart,fEnd) > 0 && (
              <Text style={s.hrsPreview}>⏱ {fmtHrs(calcHours(fStart,fEnd))} shift</Text>
            )}

            {/* Role + Note */}
            <Text style={s.fieldLbl}>Role / Position</Text>
            <TextInput style={s.input} value={fRole} onChangeText={setFRole} placeholder="e.g. Cook, Cashier, Server…" placeholderTextColor="#bbb"/>
            <Text style={s.fieldLbl}>Note (optional)</Text>
            <TextInput style={s.input} value={fNote} onChangeText={setFNote} placeholder="Any additional note…" placeholderTextColor="#bbb"/>

            <View style={{flexDirection:'row', gap:10, marginTop:16}}>
              <TouchableOpacity style={[s.modalBtn,{backgroundColor:'#F0F0F0'}]} onPress={()=>setModal(null)} activeOpacity={0.7}>
                <Text style={{color:'#555',fontWeight:'700'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn,{backgroundColor:COLORS.primary,flex:1}]} onPress={saveShift} disabled={saving} activeOpacity={0.8}>
                <Text style={{color:'#fff',fontWeight:'800'}}>{saving?'Saving…':'Save Shift'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:           { flex:1, backgroundColor:'#F4F6F8' },
  center:         { flex:1, justifyContent:'center', alignItems:'center' },
  header:         { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderBottomWidth:1, borderBottomColor:'#EEE' },
  weekNav:        { flexDirection:'row', alignItems:'center', gap:6, flex:1 },
  shareBtn:       { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:COLORS.primary, borderRadius:10, paddingHorizontal:12, paddingVertical:8 },
  shareTxt:       { color:'#fff', fontWeight:'800', fontSize:12 },
  navBtn:         { width:32, height:32, borderRadius:16, backgroundColor:'#F0F0F0', alignItems:'center', justifyContent:'center' },
  navTxt:         { fontSize:20, color:COLORS.primary, fontWeight:'700', lineHeight:24 },
  weekTxt:        { fontSize:13, fontWeight:'800', color:'#333' },
  yearTxt:        { fontSize:10, color:'#aaa' },
  content:        { padding:14, paddingBottom:40 },
  summaryCard:    { backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:12, borderTopWidth:3, borderTopColor:COLORS.primary },
  summaryTitle:   { fontSize:11, fontWeight:'800', color:COLORS.primary, letterSpacing:1, textTransform:'uppercase', marginBottom:10 },
  summaryRow:     { flexDirection:'row', flexWrap:'wrap', gap:8 },
  summaryChip:    { backgroundColor:'#E8F5E9', borderRadius:20, paddingHorizontal:12, paddingVertical:6, flexDirection:'row', gap:6, alignItems:'center' },
  summaryName:    { fontSize:12, fontWeight:'700', color:'#333' },
  summaryHrs:     { fontSize:12, fontWeight:'900', color:COLORS.primary },
  daySection:     { backgroundColor:'#F8F8F8', borderRadius:14, padding:12, marginBottom:10 },
  daySectionToday:{ backgroundColor:'#E8F5E9', borderWidth:1.5, borderColor:COLORS.primary },
  dayHeader:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:10 },
  dayName:        { fontSize:14, fontWeight:'900', color:'#333' },
  dayDate:        { fontSize:12, color:'#aaa', fontWeight:'600' },
  todayBadge:     { backgroundColor:COLORS.primary, borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  dayHrs:         { fontSize:11, color:COLORS.primary, fontWeight:'800' },
  addBtn:         { backgroundColor:COLORS.primary, borderRadius:8, paddingHorizontal:12, paddingVertical:6 },
  addBtnTxt:      { color:'#fff', fontWeight:'800', fontSize:12 },
  emptyDay:       { color:'#bbb', fontSize:12, textAlign:'center', paddingVertical:8 },
  // modal
  modalOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', justifyContent:'flex-end' },
  modalBox:       { backgroundColor:'#fff', borderTopLeftRadius:22, borderTopRightRadius:22, padding:22, paddingBottom:36 },
  modalTitle:     { fontSize:16, fontWeight:'900', color:'#222', marginBottom:2 },
  modalSub:       { fontSize:12, color:'#888', marginBottom:16 },
  fieldLbl:       { fontSize:11, fontWeight:'700', color:'#666', marginBottom:5, marginTop:10 },
  input:          { borderWidth:1, borderColor:'#E0E0E0', borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:14, color:'#222', backgroundColor:'#FAFAFA' },
  hrsPreview:     { fontSize:12, color:COLORS.primary, fontWeight:'800', marginTop:6, textAlign:'center' },
  staffChip:      { paddingHorizontal:12, paddingVertical:7, borderRadius:20, borderWidth:1.5, borderColor:'#DDD', backgroundColor:'#F8F8F8' },
  staffChipOn:    { backgroundColor:'#E8F5E9', borderColor:COLORS.primary },
  staffChipTxt:   { fontSize:12, color:'#888', fontWeight:'600' },
  staffChipTxtOn: { color:COLORS.primary, fontWeight:'800' },
  modalBtn:       { borderRadius:12, padding:14, alignItems:'center', justifyContent:'center' },
  todayBadgeText: { color:'#fff', fontSize:9, fontWeight:'900' },
});
