import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, Switch, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── helpers ───────────────────────────────────────────────── */
function staffKey(b)   { return `staff_${b}`; }
function notifKey(b)   { return `notif_${b}`; }
function reportKey(b)  { return `report_prefs_${b}`; }
function draftKey(b)   { return `submit_draft_${b}_${new Date().toISOString().slice(0,10)}`; }
function specDraftKey(b){ return `spec_draft_${b}_${new Date().toISOString().slice(0,10)}`; }

/* ─── section components ────────────────────────────────────── */
function SH({ title, color = COLORS.primary }) {
  return <Text style={[sh.txt, { color }]}>{title}</Text>;
}
const sh = StyleSheet.create({ txt:{ fontSize:11,fontWeight:'800',letterSpacing:1,textTransform:'uppercase',marginBottom:8,marginTop:20 } });

function Card({ children }) {
  return <View style={cd.wrap}>{children}</View>;
}
const cd = StyleSheet.create({ wrap:{ backgroundColor:'#fff',borderRadius:14,paddingHorizontal:16,overflow:'hidden',elevation:1,shadowColor:'#000',shadowOpacity:0.04,shadowRadius:4 } });

function Row({ label, sub, right, onPress, danger }) {
  const Inner = (
    <View style={rw.row}>
      <View style={{flex:1}}>
        <Text style={[rw.lbl,danger&&{color:COLORS.danger}]}>{label}</Text>
        {sub?<Text style={rw.sub}>{sub}</Text>:null}
      </View>
      {right}
    </View>
  );
  return onPress
    ? <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{Inner}</TouchableOpacity>
    : Inner;
}
const rw = StyleSheet.create({
  row:{ flexDirection:'row',alignItems:'center',paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#F5F5F5' },
  lbl:{ fontSize:15,color:'#222',fontWeight:'500' },
  sub:{ fontSize:11,color:'#aaa',marginTop:2 },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerSettingsScreen() {
  const { user, logout } = useAuth();
  const branch = user?.branch || '';

  /* staff list */
  const [staff,    setStaff]    = useState([]);
  const [newName,  setNewName]  = useState('');
  const [newRole,  setNewRole]  = useState('');
  const [showAdd,  setShowAdd]  = useState(false);

  /* PIN change */
  const [showPin,  setShowPin]  = useState(false);
  const [oldPin,   setOldPin]   = useState('');
  const [newPin,   setNewPin]   = useState('');
  const [confPin,  setConfPin]  = useState('');

  /* notifications */
  const [notif, setNotif] = useState({ daily:true, cashflow:true, spec:false });

  /* report prefs */
  const [repPrefs, setRepPrefs] = useState({ format:'pdf', period:'month' });

  /* connection */
  const [dbStatus, setDbStatus] = useState('unknown');

  /* ── load ── */
  const load = useCallback(async () => {
    try {
      const [rawStaff, rawNotif, rawRep] = await Promise.all([
        AsyncStorage.getItem(staffKey(branch)),
        AsyncStorage.getItem(notifKey(branch)),
        AsyncStorage.getItem(reportKey(branch)),
      ]);
      if (rawStaff) setStaff(JSON.parse(rawStaff));
      if (rawNotif) setNotif(JSON.parse(rawNotif));
      if (rawRep)   setRepPrefs(JSON.parse(rawRep));
    } catch {}
  }, [branch]);

  useEffect(() => { load(); }, [load]);

  /* ── staff ── */
  async function saveStaff(list) {
    setStaff(list);
    await AsyncStorage.setItem(staffKey(branch), JSON.stringify(list));
  }
  async function addStaff() {
    if (!newName.trim()) { Alert.alert('Name required'); return; }
    const m = { id: Date.now().toString(), name: newName.trim(), role: newRole.trim() };
    await saveStaff([...staff, m]);
    setNewName(''); setNewRole(''); setShowAdd(false);
  }
  async function removeStaff(id) {
    Alert.alert('Remove staff member?','They will be removed from the list (existing schedule entries unchanged.',[
      {text:'Cancel',style:'cancel'},
      {text:'Remove',style:'destructive',onPress:()=>saveStaff(staff.filter(m=>m.id!==id))},
    ]);
  }

  /* ── PIN ── */
  async function changePin() {
    const storedPin = await AsyncStorage.getItem(`custom_pin_${branch}`) || user?.pin || '';
    if (oldPin !== storedPin && oldPin !== String(user?.pin||'')) {
      Alert.alert('Wrong PIN', 'Current PIN is incorrect.'); return;
    }
    if (newPin.length < 4) { Alert.alert('Too short', 'New PIN must be at least 4 digits.'); return; }
    if (newPin !== confPin) { Alert.alert('Mismatch', 'New PIN and confirmation do not match.'); return; }
    await AsyncStorage.setItem(`custom_pin_${branch}`, newPin);
    setOldPin(''); setNewPin(''); setConfPin(''); setShowPin(false);
    Alert.alert('✅ PIN Changed', 'Your new PIN is saved on this device.');
  }

  /* ── notifications ── */
  async function toggleNotif(key) {
    const updated = { ...notif, [key]: !notif[key] };
    setNotif(updated);
    await AsyncStorage.setItem(notifKey(branch), JSON.stringify(updated));
  }

  /* ── report prefs ── */
  async function setRepFormat(format) {
    const updated = { ...repPrefs, format };
    setRepPrefs(updated);
    await AsyncStorage.setItem(reportKey(branch), JSON.stringify(updated));
  }
  async function setRepPeriod(period) {
    const updated = { ...repPrefs, period };
    setRepPrefs(updated);
    await AsyncStorage.setItem(reportKey(branch), JSON.stringify(updated));
  }

  /* ── data ── */
  async function clearDrafts() {
    Alert.alert('Clear Drafts?','This will delete today\'s auto-saved Submit and SPEC drafts.',[
      {text:'Cancel',style:'cancel'},
      {text:'Clear',style:'destructive',onPress:async()=>{
        await AsyncStorage.multiRemove([draftKey(branch), specDraftKey(branch)]);
        Alert.alert('✅ Done','Drafts cleared.');
      }},
    ]);
  }

  async function testConnection() {
    setDbStatus('checking');
    try {
      const { error } = await supabase.from('daily_reports').select('id').limit(1);
      setDbStatus(error ? 'error' : 'connected');
    } catch { setDbStatus('error'); }
  }

  /* ── logout ── */
  function handleLogout() {
    Alert.alert('Log Out','Are you sure?',[
      {text:'Cancel',style:'cancel'},
      {text:'Log Out',style:'destructive',onPress:logout},
    ]);
  }

  const dbColor = dbStatus==='connected'?COLORS.primary:dbStatus==='error'?COLORS.danger:'#888';
  const dbLabel = dbStatus==='connected'?'Connected ✅':dbStatus==='error'?'Error ❌':dbStatus==='checking'?'Checking…':'Unknown';

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>

        {/* ── Profile card ── */}
        <View style={s.profileCard}>
          <View style={s.avatar}><Text style={{fontSize:34}}>👤</Text></View>
          <Text style={s.profileBranch}>{branch}</Text>
          <Text style={s.profileRole}>Branch Manager</Text>
          <View style={s.profilePin}>
            <Text style={{color:'rgba(255,255,255,0.7)',fontSize:11}}>PIN: {'•'.repeat(4)}</Text>
            <TouchableOpacity onPress={()=>setShowPin(p=>!p)} style={s.changePinBtn}>
              <Text style={s.changePinTxt}>Change PIN</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── PIN change ── */}
        {showPin&&(
          <View style={s.pinBox}>
            <Text style={s.pinTitle}>🔑 Change PIN</Text>
            {[['Current PIN',oldPin,setOldPin],['New PIN',newPin,setNewPin],['Confirm New PIN',confPin,setConfPin]].map(([lbl,val,set])=>(
              <View key={lbl} style={{marginBottom:10}}>
                <Text style={s.pinLbl}>{lbl}</Text>
                <TextInput style={s.pinInput} value={val} onChangeText={set} keyboardType="numeric" secureTextEntry maxLength={8} placeholder="••••" placeholderTextColor="#bbb"/>
              </View>
            ))}
            <View style={{flexDirection:'row',gap:10}}>
              <TouchableOpacity style={[s.pinBtn,{backgroundColor:'#EEE'}]} onPress={()=>{setShowPin(false);setOldPin('');setNewPin('');setConfPin('');}}>
                <Text style={{color:'#555',fontWeight:'700'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.pinBtn,{backgroundColor:COLORS.primary,flex:1}]} onPress={changePin}>
                <Text style={{color:'#fff',fontWeight:'800'}}>Save PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Staff management ── */}
        <SH title="👥 Staff List"/>
        <Text style={s.sectionNote}>Used for schedule assignment. Add your branch staff here.</Text>
        <Card>
          {staff.length === 0
            ? <Row label="No staff added yet" sub="Tap + Add Staff below"/>
            : staff.map((m,i) => (
                <Row key={m.id}
                  label={m.name}
                  sub={m.role||'No role set'}
                  right={
                    <TouchableOpacity onPress={()=>removeStaff(m.id)} style={s.removeBtn}>
                      <Text style={{color:COLORS.danger,fontWeight:'700',fontSize:13}}>Remove</Text>
                    </TouchableOpacity>
                  }
                />
              ))
          }
          <TouchableOpacity style={s.addStaffBtn} onPress={()=>setShowAdd(p=>!p)} activeOpacity={0.7}>
            <Text style={s.addStaffTxt}>{showAdd?'Cancel':'+ Add Staff'}</Text>
          </TouchableOpacity>
        </Card>

        {showAdd&&(
          <View style={s.addBox}>
            <TextInput style={s.addInput} value={newName} onChangeText={setNewName} placeholder="Full name" placeholderTextColor="#bbb"/>
            <TextInput style={s.addInput} value={newRole} onChangeText={setNewRole} placeholder="Role (e.g. Cook, Cashier)" placeholderTextColor="#bbb"/>
            <TouchableOpacity style={[s.pinBtn,{backgroundColor:COLORS.primary,marginTop:4}]} onPress={addStaff}>
              <Text style={{color:'#fff',fontWeight:'800',fontSize:14}}>Add to List</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Notifications ── */}
        <SH title="🔔 Notifications"/>
        <Text style={s.sectionNote}>Daily reminders to keep submissions on track.</Text>
        <Card>
          {[
            ['daily',   'Daily Report Reminder',   'Remind me to submit daily report'],
            ['cashflow','Cash Flow Reminder',       'Remind me to submit cash flow'],
            ['spec',    'SPEC Order Reminder',      'Remind me when SPEC is due'],
          ].map(([key,lbl,sub])=>(
            <Row key={key} label={lbl} sub={sub}
              right={<Switch value={notif[key]} onValueChange={()=>toggleNotif(key)} trackColor={{true:COLORS.primary}} thumbColor="#fff"/>}
            />
          ))}
        </Card>

        {/* ── Report preferences ── */}
        <SH title="📊 Report Preferences"/>
        <Text style={s.sectionNote}>Default settings when opening the Report tab.</Text>
        <Card>
          <View style={{paddingVertical:12}}>
            <Text style={s.prefLbl}>Default Export Format</Text>
            <View style={s.chipRow}>
              {[['pdf','📄 PDF'],['csv','📊 CSV'],['text','📤 Text']].map(([k,lbl])=>(
                <TouchableOpacity key={k} style={[s.chip, repPrefs.format===k&&s.chipOn]} onPress={()=>setRepFormat(k)}>
                  <Text style={[s.chipTxt, repPrefs.format===k&&s.chipTxtOn]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.divider}/>
            <Text style={[s.prefLbl,{marginTop:12}]}>Default Period</Text>
            <View style={s.chipRow}>
              {[['week','7 Days'],['month','This Month'],['lastMonth','Last Month']].map(([k,lbl])=>(
                <TouchableOpacity key={k} style={[s.chip, repPrefs.period===k&&s.chipOn]} onPress={()=>setRepPeriod(k)}>
                  <Text style={[s.chipTxt, repPrefs.period===k&&s.chipTxtOn]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>

        {/* ── Data ── */}
        <SH title="🗄️ Data"/>
        <Card>
          <Row label="Test Connection"
            sub={dbLabel}
            right={
              dbStatus==='checking'
                ? <ActivityIndicator size="small" color={COLORS.primary}/>
                : <TouchableOpacity onPress={testConnection} style={[s.smallBtn,{borderColor:dbColor}]}>
                    <Text style={[s.smallBtnTxt,{color:dbColor}]}>Test</Text>
                  </TouchableOpacity>
            }
          />
          <Row label="Clear Today's Drafts"
            sub="Removes auto-saved Submit and SPEC drafts"
            onPress={clearDrafts}
            right={<Text style={{fontSize:18}}>🗑️</Text>}
          />
        </Card>

        {/* ── App ── */}
        <SH title="ℹ️ App"/>
        <Card>
          <Row label="Version" right={<Text style={{color:'#aaa',fontSize:14}}>1.0.0</Text>}/>
          <Row label="Branch" right={<Text style={{color:'#aaa',fontSize:14}}>{branch}</Text>}/>
          <Row label="Built by" right={<Text style={{color:'#aaa',fontSize:14}}>Dostana Tech</Text>}/>
        </Card>

        {/* ── Logout ── */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={s.logoutTxt}>Log Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:         { flex:1, backgroundColor:'#F4F6F8' },
  content:      { padding:16, paddingBottom:50 },
  sectionNote:  { fontSize:12, color:'#aaa', marginBottom:8, marginTop:-6 },
  // profile
  profileCard:  { backgroundColor:COLORS.primary, borderRadius:18, padding:24, alignItems:'center', marginBottom:8 },
  avatar:       { width:72,height:72,borderRadius:36,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center',marginBottom:12 },
  profileBranch:{ fontSize:20,fontWeight:'900',color:'#fff',marginBottom:3 },
  profileRole:  { fontSize:13,color:'rgba(255,255,255,0.75)',marginBottom:10 },
  profilePin:   { flexDirection:'row',alignItems:'center',gap:12 },
  changePinBtn: { backgroundColor:'rgba(255,255,255,0.2)',borderRadius:8,paddingHorizontal:12,paddingVertical:5 },
  changePinTxt: { color:'#fff',fontWeight:'700',fontSize:12 },
  // PIN box
  pinBox:       { backgroundColor:'#fff',borderRadius:14,padding:16,marginBottom:8 },
  pinTitle:     { fontSize:14,fontWeight:'900',color:'#333',marginBottom:14 },
  pinLbl:       { fontSize:11,fontWeight:'700',color:'#666',marginBottom:5 },
  pinInput:     { borderWidth:1,borderColor:'#E0E0E0',borderRadius:10,paddingHorizontal:14,paddingVertical:10,fontSize:16,color:'#222',letterSpacing:4 },
  pinBtn:       { borderRadius:12,padding:13,alignItems:'center' },
  // staff
  removeBtn:    { paddingHorizontal:10,paddingVertical:5 },
  addStaffBtn:  { paddingVertical:13,alignItems:'center',borderTopWidth:1,borderTopColor:'#F5F5F5' },
  addStaffTxt:  { color:COLORS.primary,fontWeight:'800',fontSize:14 },
  addBox:       { backgroundColor:'#fff',borderRadius:14,padding:14,marginTop:8,marginBottom:4,gap:8 },
  addInput:     { borderWidth:1,borderColor:'#E0E0E0',borderRadius:10,paddingHorizontal:12,paddingVertical:10,fontSize:14,color:'#222' },
  // prefs
  prefLbl:      { fontSize:12,fontWeight:'700',color:'#555',marginBottom:8 },
  chipRow:      { flexDirection:'row',flexWrap:'wrap',gap:8 },
  chip:         { paddingHorizontal:14,paddingVertical:7,borderRadius:20,borderWidth:1.5,borderColor:'#DDD',backgroundColor:'#F8F8F8' },
  chipOn:       { backgroundColor:'#E8F5E9',borderColor:COLORS.primary },
  chipTxt:      { fontSize:12,color:'#888',fontWeight:'600' },
  chipTxtOn:    { color:COLORS.primary,fontWeight:'800' },
  divider:      { height:1,backgroundColor:'#F0F0F0',marginTop:12 },
  // data
  smallBtn:     { borderWidth:1.5,borderRadius:8,paddingHorizontal:12,paddingVertical:5 },
  smallBtnTxt:  { fontSize:12,fontWeight:'700' },
  // logout
  logoutBtn:    { backgroundColor:'#fff',borderWidth:1.5,borderColor:COLORS.danger,borderRadius:14,paddingVertical:15,alignItems:'center',marginTop:20 },
  logoutTxt:    { fontSize:16,fontWeight:'700',color:COLORS.danger },
});
