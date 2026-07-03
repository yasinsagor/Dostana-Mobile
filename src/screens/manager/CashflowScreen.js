import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { saveCashflowReport } from '../../lib/supabase';
import { COLORS } from '../../constants';

const DEFAULT_CATS = ['Warzywa','Cola/Pepsi','Gaz','C2C','Spec','Wynajem','Pracownicy','Inne'];

export default function ManagerCashflowScreen() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0,10);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [notes, setNotes] = useState('');
  const [expenses, setExpenses] = useState(DEFAULT_CATS.map(name => ({ name, amount:'' })));

  function updateAmount(i, val) {
    setExpenses(e => e.map((row, idx) => idx===i ? {...row, amount: val} : row));
  }
  function addCustom() {
    setExpenses(e => [...e, { name:'', amount:'' }]);
  }
  function updateName(i, val) {
    setExpenses(e => e.map((row, idx) => idx===i ? {...row, name: val} : row));
  }

  const filled = expenses.filter(e => e.name && parseFloat(e.amount||0) > 0);
  const totalExp = filled.reduce((s,e) => s + parseFloat(e.amount||0), 0);

  async function handleSubmit() {
    if (filled.length === 0) { Alert.alert('Empty', 'Enter at least one expense'); return; }
    setSaving(true);
    try {
      await saveCashflowReport(user.branch, today, filled);
      setSubmitted(true);
    } catch(e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>💰 Cash Flow</Text></View>
      <View style={s.successBox}>
        <Text style={s.successIcon}>✅</Text>
        <Text style={s.successTitle}>Submitted!</Text>
        <Text style={s.successSub}>{user.branch} · {today}</Text>
        <Text style={s.successAmt}>{Math.round(totalExp).toLocaleString()} PLN expenses</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => { setSubmitted(false); setExpenses(DEFAULT_CATS.map(n=>({name:n,amount:''})));setNotes(''); }}>
          <Text style={s.newBtnTxt}>New Report</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>💰 Cash Flow</Text>
        <Text style={s.headerSub}>{user.branch} · {today}</Text>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <View style={s.section}>
            <Text style={s.sectionTitle}>EXPENSES</Text>
            {expenses.map((e, i) => (
              <View key={i} style={s.expRow}>
                <TextInput
                  style={[s.input, {flex:1, marginRight:8}]}
                  value={e.name}
                  onChangeText={v => updateName(i, v)}
                  placeholder="Category"
                  placeholderTextColor="#bbb"
                  editable={!DEFAULT_CATS.includes(e.name)}
                />
                <TextInput
                  style={[s.input, {width:100}]}
                  value={e.amount}
                  onChangeText={v => updateAmount(i, v)}
                  keyboardType="numeric"
                  placeholder="0 PLN"
                  placeholderTextColor="#bbb"
                />
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addCustom}>
              <Text style={s.addBtnTxt}>+ Add Custom Expense</Text>
            </TouchableOpacity>
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>NOTES</Text>
            <TextInput
              style={[s.input, {height:70, textAlignVertical:'top'}]}
              placeholder="Optional notes..."
              placeholderTextColor="#bbb"
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>TOTAL EXPENSES</Text>
            <Text style={s.summaryAmt}>{Math.round(totalExp).toLocaleString()} PLN</Text>
            <Text style={s.summarySub}>{filled.length} categories filled</Text>
          </View>

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>Submit Cash Flow</Text>}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor:COLORS.background },
  header: { padding:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:COLORS.border },
  title: { fontSize:18, fontWeight:'900', color:COLORS.text },
  headerSub: { fontSize:12, color:COLORS.textSecondary, marginTop:2 },
  scroll: { flex:1 },
  content: { padding:14, paddingBottom:40 },
  section: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:14 },
  sectionTitle: { fontSize:11, fontWeight:'800', color:COLORS.textSecondary, letterSpacing:1, marginBottom:12 },
  expRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  input: { borderWidth:1.5, borderColor:COLORS.border, borderRadius:8, padding:10, fontSize:14, color:COLORS.text, backgroundColor:'#FAFAFA' },
  addBtn: { borderWidth:1.5, borderColor:COLORS.primary, borderRadius:8, padding:10, alignItems:'center', marginTop:4, borderStyle:'dashed' },
  addBtnTxt: { color:COLORS.primary, fontWeight:'700', fontSize:13 },
  summaryCard: { backgroundColor:COLORS.primary, borderRadius:14, padding:20, marginBottom:14, alignItems:'center' },
  summaryTitle: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1, marginBottom:8 },
  summaryAmt: { fontSize:32, fontWeight:'900', color:'#fff', marginBottom:4 },
  summarySub: { fontSize:12, color:'rgba(255,255,255,0.7)' },
  submitBtn: { backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center' },
  submitTxt: { color:'#fff', fontSize:16, fontWeight:'900' },
  successBox: { flex:1, justifyContent:'center', alignItems:'center', padding:30 },
  successIcon: { fontSize:64, marginBottom:16 },
  successTitle: { fontSize:22, fontWeight:'900', color:COLORS.primary, marginBottom:6 },
  successSub: { fontSize:14, color:COLORS.textSecondary, marginBottom:8 },
  successAmt: { fontSize:24, fontWeight:'900', color:COLORS.text, marginBottom:30 },
  newBtn: { borderWidth:2, borderColor:COLORS.primary, borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  newBtnTxt: { color:COLORS.primary, fontWeight:'800', fontSize:15 },
});
