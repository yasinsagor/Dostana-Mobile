import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text as NativeText, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { CalendarModal } from './SubmitScreen';
import { haccpCutoff } from '../../lib/haccpRetention';

const API = process.env.EXPO_PUBLIC_PORTAL_API_URL || 'https://dostana-web-claude.vercel.app';
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Android can default unstyled text to white when the phone uses dark mode.
// This screen has light cards, so always set its foreground explicitly.
function Text({ style, ...props }) {
  return <NativeText {...props} style={[{ color: '#17251B' }, style]} />;
}

export default function HaccpHistory() {
  const { user } = useAuth();
  const [date, setDate] = useState(localDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const loadSequence = useRef(0);
  const [pin, setPin] = useState('');
  const [entries, setEntries] = useState([]);
  const [loadedDate, setLoadedDate] = useState(null);
  const [edit, setEdit] = useState(null);
  const [editor, setEditor] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function request(payload) {
    const branchPin = user?.sessionPin || pin.trim();
    if (!branchPin) throw new Error('Enter your branch PIN or sign in again.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`${API}/api/mobile/haccp-history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ ...payload, branch: user.branch, pin: branchPin }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not load HACCP history.');
      return data;
    } finally { clearTimeout(timer); }
  }
  async function load() {
    const sequence = ++loadSequence.current;
    setBusy(true); setError(''); setEdit(null); setLoadedDate(null); setEntries([]);
    try { const data = await request({ action: 'list', date }); if (sequence === loadSequence.current) { setEntries(data.entries || []); setLoadedDate(date); } }
    catch (e) { if (sequence === loadSequence.current) setError(e.message || 'Connection failed.'); }
    finally { if (sequence === loadSequence.current) setBusy(false); }
  }
  useEffect(() => {
    if (user?.sessionPin || pin.trim()) load();
    return () => { loadSequence.current++; };
  }, [date, user?.branch, user?.sessionPin]);
  async function save() {
    setBusy(true); setError('');
    try {
      await request({ action: 'update', id: edit.id, revision: Number(edit.details?.mobile_edit_revision || 0), updates: edit, editor, reason });
      setEdit(null); setReason('');
      const data = await request({ action: 'list', date: loadedDate }); setEntries(data.entries || []);
      Alert.alert('Correction saved', 'The original date and signature are preserved. Your correction is recorded in the audit history.');
    } catch (e) { setError(e.message || 'Correction failed. Nothing was queued offline.'); }
    finally { setBusy(false); }
  }
  const field = (label, value, onChange, options = {}) => <View style={{ gap: 5 }}><Text>{label}</Text><TextInput value={String(value ?? '')} onChangeText={onChange} editable={!busy} placeholderTextColor="#647067" selectionColor="#15803D" style={{ borderWidth: 1, borderColor: '#B8CDBE', borderRadius: 8, padding: 10, color: '#17251B', backgroundColor: '#fff' }} {...options} /></View>;
  const button = (title, fn) => <TouchableOpacity disabled={busy} onPress={fn} style={{ backgroundColor: '#15803D', borderRadius: 8, padding: 12 }}><Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{title}</Text></TouchableOpacity>;
  return <View style={{ gap: 12 }}>
    <TouchableOpacity disabled={busy} onPress={() => setCalendarOpen(true)} style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12 }}>
      <Text style={{ fontWeight: '800', fontSize: 17 }}>📅 {date}</Text>
      <Text>{date === localDate() ? 'Today' : 'Past date'} · tap to change</Text>
    </TouchableOpacity>
    <CalendarModal visible={calendarOpen} selected={date} minDate={haccpCutoff()} maxDate={localDate()} onSelect={value => { if (value < haccpCutoff() || value > localDate()) return; setDate(value); setEdit(null); setEntries([]); setLoadedDate(null); }} onClose={() => setCalendarOpen(false)} />
    <Text>View and edit saved records from {haccpCutoff()} to {localDate()}. Corrections require an internet connection.</Text>
    {!!user?.sessionPin && button('Refresh records', load)}
    {!user?.sessionPin && field('Branch PIN', pin, setPin, { secureTextEntry: true, keyboardType: 'number-pad' })}
    {!user?.sessionPin && button('Load records', load)}
    {busy && <ActivityIndicator color="#15803D" />}
    {!!error && <Text accessibilityRole="alert" style={{ color: '#B42318' }}>{error}</Text>}
    {loadedDate && !entries.length && !busy && <Text>No records saved for {loadedDate}.</Text>}
    {!edit && entries.map(row => <View key={row.id} style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, gap: 6 }}>
      <Text style={{ fontWeight: '800' }}>{row.subject}</Text>
      <Text>{row.register_type} · {new Date(row.recorded_at).toLocaleString('en-GB', { timeZone: 'Europe/Warsaw' })}</Text>
      <Text>{row.reading != null ? `${row.reading} °C · ` : ''}{row.is_compliant ? 'OK' : 'Issue found'}</Text>
      <Text>Signed by: {row.submitted_by}</Text>
      {!!row.corrective_action && <Text>Action: {row.corrective_action}</Text>}
      {!!row.notes && <Text>Notes: {row.notes}</Text>}
      {button('Edit record', () => { setEdit({ ...row }); setReason(''); setError(''); })}
    </View>)}
    {edit && <View style={{ backgroundColor: '#fff', padding: 14, borderRadius: 12, gap: 12 }}>
      <Text style={{ fontWeight: '800' }}>Correct {edit.subject}</Text>
      <Text>Original date: {new Date(edit.recorded_at).toLocaleString('en-GB', { timeZone: 'Europe/Warsaw' })}. Original signer: {edit.submitted_by}.</Text>
      {field('Subject', edit.subject, subject => setEdit({ ...edit, subject }))}
      {edit.register_type === 'temperature' ? <>
        {field('Temperature °C (use minus for negative readings)', edit.reading, reading => setEdit({ ...edit, reading }))}
        {field('Recheck temperature (optional)', edit.recheck_reading, recheck_reading => setEdit({ ...edit, recheck_reading }))}
        <Text>Existing limits: {edit.minimum_limit ?? 'no minimum'} to {edit.maximum_limit ?? 'no maximum'}. Status is recalculated when saved.</Text>
      </> : button(edit.is_compliant ? 'Result: OK — tap to change' : 'Result: Issue — tap to change', () => setEdit({ ...edit, is_compliant: !edit.is_compliant }))}
      {field('Corrective action (required if failed)', edit.corrective_action, corrective_action => setEdit({ ...edit, corrective_action }), { multiline: true })}
      {field('Notes', edit.notes, notes => setEdit({ ...edit, notes }), { multiline: true })}
      {field('Your name / initials', editor, setEditor)}
      {field('Reason for correction (required)', reason, setReason, { multiline: true })}
      {button('Save correction', save)}
      {button('Cancel editing', () => { setEdit(null); setError(''); })}
    </View>}
  </View>;
}
