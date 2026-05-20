import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { insertDailyReport } from '../../lib/supabase';
import { COLORS } from '../../constants';

const PLATFORMS = ['wolt','glovo','uber_eats','bolt','pyszne',"repos"];
const PLATFORM_LABELS = { wolt:'Wolt', glovo:'Glovo', uber_eats:'Uber Eats', bolt:'Bolt Food', pyszne:'Pyszne.pl', repos:'Restaumatic' };

function Field({ label, value, onChange, keyboardType='numeric', placeholder='0' }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={s.input}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#bbb"
      />
    </View>
  );
}

export default function ManagerDailyScreen() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0,10);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [revenue, setRevenue] = useState('');
  const [card, setCard] = useState('');
  const [cash, setCash] = useState('');
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [platforms, setPlatforms] = useState({ wolt:'', glovo:'', uber_eats:'', bolt:'', pyszne:'', repos:'' });
  const [expenses, setExpenses] = useState([{ name:'', amount:'' }]);

  const totalDelivery = PLATFORMS.reduce((s,p) => s + (parseFloat(platforms[p])||0), 0);
  const totalRevenue = (parseFloat(revenue)||0);
  const totalExpenses = expenses.reduce((s,e) => s + (parseFloat(e.amount)||0), 0);
  const netProfit = totalRevenue - totalExpenses;

  function addExpense() { setExpenses(e => [...e, { name:'', amount:'' }]); }
  function removeExpense(i) { setExpenses(e => e.filter((_,idx) => idx !== i)); }
  function updateExpense(i, field, val) {
    setExpenses(e => e.map((row, idx) => idx===i ? {...row, [field]: val} : row));
  }

  async function handleSubmit() {
    if (!revenue) { Alert.alert('Missing', 'Please enter total revenue'); return; }
    setSaving(true);
    try {
      const report = {
        branch: user.branch,
        date: today,
        revenue: parseFloat(revenue)||0,
        card: parseFloat(card)||0,
        cash: parseFloat(cash)||0,
        hours: parseFloat(hours)||0,
        total_delivery: totalDelivery,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        notes,
        ...Object.fromEntries(PLATFORMS.map(p => [p, parseFloat(platforms[p])||0])),
        wydatki: JSON.stringify(expenses.filter(e => e.name && e.amount)),
      };
      await insertDailyReport(report);
      setSubmitted(true);
    } catch(e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (submitted) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>📝 Daily Report</Text>
      </View>
      <View style={s.successBox}>
        <Text style={s.successIcon}>✅</Text>
        <Text style={s.successTitle}>Report Submitted!</Text>
        <Text style={s.successSub}>{user.branch} · {today}</Text>
        <Text style={s.successRev}>{Math.round(totalRevenue).toLocaleString()} PLN</Text>
        <TouchableOpacity style={s.newBtn} onPress={() => { setSubmitted(false); setRevenue(''); setCard(''); setCash(''); setHours(''); setNotes(''); setPlatforms({wolt:'',glovo:'',uber_eats:'',bolt:'',pyszne:'',repos:''}); setExpenses([{name:'',amount:''}]); }}>
          <Text style={s.newBtnTxt}>Submit Another</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>📝 Daily Report</Text>
        <Text style={s.headerSub}>{user.branch} · {today}</Text>
      </View>
      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>

          {/* Revenue */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>REVENUE</Text>
            <Field label="Total Revenue (PLN)" value={revenue} onChange={setRevenue} />
            <Field label="Card Payments" value={card} onChange={setCard} />
            <Field label="Cash Payments" value={cash} onChange={setCash} />
            <Field label="Working Hours" value={hours} onChange={setHours} />
          </View>

          {/* Delivery platforms */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>DELIVERY PLATFORMS</Text>
            {PLATFORMS.map(p => (
              <Field key={p} label={PLATFORM_LABELS[p]} value={platforms[p]} onChange={v => setPlatforms(pl => ({...pl, [p]: v}))} />
            ))}
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Delivery</Text>
              <Text style={s.totalVal}>{Math.round(totalDelivery).toLocaleString()} PLN</Text>
            </View>
          </View>

          {/* Expenses */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>EXPENSES</Text>
            {expenses.map((e, i) => (
              <View key={i} style={s.expRow}>
                <TextInput
                  style={[s.input, { flex:1, marginRight:6 }]}
                  placeholder="Category"
                  placeholderTextColor="#bbb"
                  value={e.name}
                  onChangeText={v => updateExpense(i, 'name', v)}
                />
                <TextInput
                  style={[s.input, { width:90 }]}
                  placeholder="Amount"
                  placeholderTextColor="#bbb"
                  keyboardType="numeric"
                  value={e.amount}
                  onChangeText={v => updateExpense(i, 'amount', v)}
                />
                {expenses.length > 1 && (
                  <TouchableOpacity onPress={() => removeExpense(i)} style={s.removeBtn}>
                    <Text style={s.removeTxt}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={s.addBtn} onPress={addExpense}>
              <Text style={s.addBtnTxt}>+ Add Expense</Text>
            </TouchableOpacity>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Total Expenses</Text>
              <Text style={s.totalVal}>{Math.round(totalExpenses).toLocaleString()} PLN</Text>
            </View>
          </View>

          {/* Notes */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>NOTES</Text>
            <TextInput
              style={[s.input, { height:80, textAlignVertical:'top' }]}
              placeholder="Any notes for today..."
              placeholderTextColor="#bbb"
              multiline
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          {/* Summary */}
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>SUMMARY</Text>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Revenue</Text>
              <Text style={s.summaryVal}>{Math.round(totalRevenue).toLocaleString()} PLN</Text>
            </View>
            <View style={s.summaryRow}>
              <Text style={s.summaryLabel}>Expenses</Text>
              <Text style={[s.summaryVal, {color: COLORS.danger}]}>-{Math.round(totalExpenses).toLocaleString()} PLN</Text>
            </View>
            <View style={[s.summaryRow, {borderTopWidth:1, borderTopColor:'rgba(255,255,255,0.3)', paddingTop:8, marginTop:4}]}>
              <Text style={[s.summaryLabel, {fontWeight:'900'}]}>Net Profit</Text>
              <Text style={[s.summaryVal, {fontSize:18, color: netProfit>=0?'#A5D6A7':'#EF9A9A'}]}>
                {netProfit>=0?'+':''}{Math.round(netProfit).toLocaleString()} PLN
              </Text>
            </View>
          </View>

          <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>Submit Daily Report</Text>}
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex:1, backgroundColor: COLORS.background },
  header: { padding:16, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:COLORS.border },
  title: { fontSize:18, fontWeight:'900', color:COLORS.text },
  headerSub: { fontSize:12, color:COLORS.textSecondary, marginTop:2 },
  scroll: { flex:1 },
  content: { padding:14, paddingBottom:40 },
  section: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:14 },
  sectionTitle: { fontSize:11, fontWeight:'800', color:COLORS.textSecondary, letterSpacing:1, marginBottom:12 },
  field: { marginBottom:10 },
  fieldLabel: { fontSize:12, color:COLORS.textSecondary, marginBottom:4, fontWeight:'600' },
  input: { borderWidth:1.5, borderColor:COLORS.border, borderRadius:8, padding:10, fontSize:14, color:COLORS.text, backgroundColor:'#FAFAFA' },
  totalRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingTop:10, borderTopWidth:1, borderTopColor:COLORS.border, marginTop:4 },
  totalLabel: { fontSize:13, fontWeight:'800', color:COLORS.text },
  totalVal: { fontSize:15, fontWeight:'900', color:COLORS.primary },
  expRow: { flexDirection:'row', alignItems:'center', marginBottom:8 },
  removeBtn: { marginLeft:6, padding:8 },
  removeTxt: { color:COLORS.danger, fontSize:14, fontWeight:'800' },
  addBtn: { borderWidth:1.5, borderColor:COLORS.primary, borderRadius:8, padding:10, alignItems:'center', marginBottom:10, borderStyle:'dashed' },
  addBtnTxt: { color:COLORS.primary, fontWeight:'700', fontSize:13 },
  summaryCard: { backgroundColor:COLORS.primary, borderRadius:14, padding:16, marginBottom:14 },
  summaryTitle: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1, marginBottom:12 },
  summaryRow: { flexDirection:'row', justifyContent:'space-between', marginBottom:6 },
  summaryLabel: { fontSize:13, color:'rgba(255,255,255,0.85)' },
  summaryVal: { fontSize:14, fontWeight:'800', color:'#fff' },
  submitBtn: { backgroundColor:COLORS.primary, borderRadius:12, padding:16, alignItems:'center' },
  submitTxt: { color:'#fff', fontSize:16, fontWeight:'900' },
  successBox: { flex:1, justifyContent:'center', alignItems:'center', padding:30 },
  successIcon: { fontSize:64, marginBottom:16 },
  successTitle: { fontSize:22, fontWeight:'900', color:COLORS.primary, marginBottom:6 },
  successSub: { fontSize:14, color:COLORS.textSecondary, marginBottom:8 },
  successRev: { fontSize:28, fontWeight:'900', color:COLORS.text, marginBottom:30 },
  newBtn: { borderWidth:2, borderColor:COLORS.primary, borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  newBtnTxt: { color:COLORS.primary, fontWeight:'800', fontSize:15 },
});
