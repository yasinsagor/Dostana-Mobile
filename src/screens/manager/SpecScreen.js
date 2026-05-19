import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { fetchSpecProducts, insertSpecOrder } from '../../lib/supabase';
import { COLORS } from '../../constants';

export default function ManagerSpecScreen() {
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0,10);
  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedItems, setSubmittedItems] = useState([]);

  useEffect(() => {
    fetchSpecProducts().then(data => {
      setProducts(data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const ordered = products.filter(p => parseFloat(quantities[p.id]||0) > 0);
  const totalQty = ordered.reduce((s,p) => s + parseFloat(quantities[p.id]||0), 0);

  async function handleSubmit() {
    if (ordered.length === 0) { Alert.alert('Empty Order', 'Add at least one product'); return; }
    setSaving(true);
    try {
      const items = ordered.map(p => ({ name: p.name, qty: parseFloat(quantities[p.id]), unit: p.unit || 'kg' }));
      await insertSpecOrder({ branch: user.branch, date: today, items, submittedAt: new Date().toISOString() });
      setSubmittedItems(items);
      setSubmitted(true);
      setQuantities({});
    } catch(e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📦 SPEC Order</Text></View>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.purple} /></View>
    </SafeAreaView>
  );

  if (submitted) return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>📦 SPEC Order</Text></View>
      <View style={s.successBox}>
        <Text style={s.successIcon}>✅</Text>
        <Text style={s.successTitle}>Order Submitted!</Text>
        <Text style={s.successSub}>{user.branch} · {today}</Text>
        <View style={s.orderSummary}>
          {submittedItems.map((it,i) => (
            <View key={i} style={s.orderRow}>
              <Text style={s.orderName}>{it.name}</Text>
              <Text style={s.orderQty}>{it.qty} {it.unit}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.newBtn} onPress={() => setSubmitted(false)}>
          <Text style={s.newBtnTxt}>New Order</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );

  // Group products by category
  const cats = {};
  products.forEach(p => {
    const cat = p.category || 'Other';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(p);
  });

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>📦 SPEC Order</Text>
        <Text style={s.headerSub}>{user.branch} · {today}</Text>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {Object.keys(cats).length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTxt}>No products in catalogue yet.</Text>
            <Text style={s.emptyTxt}>Add products in Supabase → spec_products table.</Text>
          </View>
        )}

        {Object.entries(cats).map(([cat, prods]) => (
          <View key={cat} style={s.section}>
            <Text style={s.sectionTitle}>{cat.toUpperCase()}</Text>
            {prods.map(p => (
              <View key={p.id} style={s.productRow}>
                <View style={s.productInfo}>
                  <Text style={s.productName}>{p.name}</Text>
                  <Text style={s.productUnit}>{p.unit || 'kg'}</Text>
                </View>
                <View style={s.qtyRow}>
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantities(q => ({...q, [p.id]: String(Math.max(0,(parseFloat(q[p.id]||0)-1)))}))}>
                    <Text style={s.qtyBtnTxt}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={s.qtyInput}
                    value={String(quantities[p.id]||'')}
                    onChangeText={v => setQuantities(q => ({...q, [p.id]: v}))}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#bbb"
                  />
                  <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantities(q => ({...q, [p.id]: String((parseFloat(q[p.id]||0)+1))}))}>
                    <Text style={s.qtyBtnTxt}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        ))}

        {ordered.length > 0 && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>ORDER SUMMARY · {ordered.length} items · {Math.round(totalQty)} units</Text>
            {ordered.map(p => (
              <View key={p.id} style={s.summaryRow}>
                <Text style={s.summaryName}>{p.name}</Text>
                <Text style={s.summaryQty}>{quantities[p.id]} {p.unit||'kg'}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={[s.submitBtn, ordered.length===0 && s.submitBtnDisabled]} onPress={handleSubmit} disabled={saving||ordered.length===0}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitTxt}>Submit Order ({ordered.length} items)</Text>}
        </TouchableOpacity>

      </ScrollView>
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
  center: { flex:1, justifyContent:'center', alignItems:'center' },
  section: { backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:14 },
  sectionTitle: { fontSize:11, fontWeight:'800', color:COLORS.textSecondary, letterSpacing:1, marginBottom:10 },
  productRow: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  productInfo: { flex:1 },
  productName: { fontSize:14, fontWeight:'700', color:COLORS.text },
  productUnit: { fontSize:11, color:COLORS.textSecondary },
  qtyRow: { flexDirection:'row', alignItems:'center', gap:6 },
  qtyBtn: { width:32, height:32, borderRadius:8, backgroundColor:COLORS.purpleLight, alignItems:'center', justifyContent:'center' },
  qtyBtnTxt: { fontSize:18, fontWeight:'900', color:COLORS.purple },
  qtyInput: { width:48, textAlign:'center', borderWidth:1.5, borderColor:COLORS.border, borderRadius:8, padding:6, fontSize:14, fontWeight:'800', color:COLORS.text },
  summaryCard: { backgroundColor:COLORS.purple, borderRadius:14, padding:16, marginBottom:14 },
  summaryTitle: { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.75)', letterSpacing:1, marginBottom:10 },
  summaryRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  summaryName: { fontSize:13, color:'#fff' },
  summaryQty: { fontSize:13, fontWeight:'900', color:'#fff' },
  submitBtn: { backgroundColor:COLORS.purple, borderRadius:12, padding:16, alignItems:'center' },
  submitBtnDisabled: { backgroundColor:'#C4B5D0' },
  submitTxt: { color:'#fff', fontSize:16, fontWeight:'900' },
  empty: { padding:30, alignItems:'center' },
  emptyTxt: { color:COLORS.textSecondary, fontSize:13, textAlign:'center', marginBottom:4 },
  successBox: { flex:1, justifyContent:'center', alignItems:'center', padding:30 },
  successIcon: { fontSize:64, marginBottom:16 },
  successTitle: { fontSize:22, fontWeight:'900', color:COLORS.purple, marginBottom:6 },
  successSub: { fontSize:14, color:COLORS.textSecondary, marginBottom:16 },
  orderSummary: { backgroundColor:COLORS.purpleLight, borderRadius:12, padding:14, width:'100%', marginBottom:24 },
  orderRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  orderName: { fontSize:13, color:COLORS.text },
  orderQty: { fontSize:13, fontWeight:'800', color:COLORS.purple },
  newBtn: { borderWidth:2, borderColor:COLORS.purple, borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  newBtnTxt: { color:COLORS.purple, fontWeight:'800', fontSize:15 },
});
