import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { FALLBACK_PRODUCTS } from '../../lib/products';
import { COLORS } from '../../constants';

const ORANGE = '#E65100';
const ORANGE_LIGHT = '#FFF3E0';

/* ─── helpers ──────────────────────────────────────────────── */
function n(v) { return parseFloat(v) || 0; }
function fmtNow() {
  const d = new Date();
  return d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ─── CategorySection ─────────────────────────────────────── */
function CategorySection({ cat, products, prices, onPriceChange }) {
  const catColors = {
    'Mięso':      { border: '#D32F2F', bg: '#FFEBEE', text: '#D32F2F' },
    'Sosy':       { border: '#1565C0', bg: '#E3F2FD', text: '#1565C0' },
    'Oleje':      { border: '#2E7D32', bg: '#E8F5E9', text: '#2E7D32' },
    'Opakowania': { border: ORANGE,    bg: ORANGE_LIGHT, text: ORANGE },
  };
  const c = catColors[cat] || { border: '#888', bg: '#F5F5F5', text: '#555' };

  return (
    <View style={[cs.wrap, { borderTopColor: c.border }]}>
      <View style={[cs.catHeader, { backgroundColor: c.bg }]}>
        <Text style={[cs.catTitle, { color: c.text }]}>{cat}</Text>
        <Text style={[cs.catCount, { color: c.text }]}>{products.length} items</Text>
      </View>
      {products.map(p => {
        const priceVal = prices[p.id] !== undefined ? prices[p.id] : String(p.price || '');
        return (
          <View key={p.id} style={cs.row}>
            <View style={{ flex: 1 }}>
              <Text style={cs.name}>{p.name}</Text>
              <Text style={cs.unit}>per {p.unit}</Text>
            </View>
            <View style={cs.priceWrap}>
              <TextInput
                style={cs.priceInput}
                value={priceVal}
                onChangeText={v => onPriceChange(p.id, v)}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#ccc"
                selectTextOnFocus
              />
              <Text style={cs.pln}>PLN</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
const cs = StyleSheet.create({
  wrap:       { backgroundColor: '#fff', borderRadius: 14, marginBottom: 12, overflow: 'hidden', borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  catHeader:  { paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catTitle:   { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  catCount:   { fontSize: 11, fontWeight: '700' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F5F5F5', gap: 10 },
  name:       { fontSize: 13, fontWeight: '700', color: '#222' },
  unit:       { fontSize: 11, color: '#aaa', marginTop: 1 },
  priceWrap:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priceInput: { borderWidth: 1.5, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 14, fontWeight: '800', color: '#222', textAlign: 'right', minWidth: 80, backgroundColor: '#FAFAFA' },
  pln:        { fontSize: 12, fontWeight: '700', color: '#aaa', width: 28 },
});

/* ════════════════════════════════════════════════════════════ */
export default function SupplierPricesScreen() {
  const [products, setProducts] = useState([]);
  const [prices, setPrices]     = useState({}); // { productId: stringPrice }
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  /* ── load products + prices ── */
  const loadProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('spec_products')
        .select('*')
        .order('name');

      if (error) throw error;

      let prods;
      if (data && data.length > 0) {
        // Merge DB products with fallback to ensure we have all products
        const dbMap = Object.fromEntries(data.map(p => [p.name, p]));
        // Use fallback list as the canonical set, fill in DB prices where available
        prods = FALLBACK_PRODUCTS.map(fp => {
          const dbP = dbMap[fp.name];
          return {
            ...fp,
            price: dbP?.price ?? fp.price,
            db_id: dbP?.id,
          };
        });
      } else {
        prods = FALLBACK_PRODUCTS;
      }

      setProducts(prods);
      // Initialize price inputs from product prices
      const initPrices = {};
      prods.forEach(p => { initPrices[p.id] = String(p.price || ''); });
      setPrices(initPrices);
    } catch (e) {
      console.error('Load products error:', e);
      // Fall back gracefully
      setProducts(FALLBACK_PRODUCTS);
      const initPrices = {};
      FALLBACK_PRODUCTS.forEach(p => { initPrices[p.id] = String(p.price || ''); });
      setPrices(initPrices);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { loadProducts(); }, [loadProducts]));

  /* ── save all prices ── */
  async function saveAllPrices() {
    setSaving(true);
    try {
      const updates = products.map(p => ({
        name:  p.name,
        unit:  p.unit,
        cat:   p.cat || p.category || 'Other',
        price: n(prices[p.id]),
      }));

      // Upsert using name as the conflict key
      const { error } = await supabase
        .from('spec_products')
        .upsert(updates, { onConflict: 'name', ignoreDuplicates: false });

      if (error) throw error;

      setLastSaved(fmtNow());
      Alert.alert('Saved', `Prices updated for ${updates.length} products.`);
    } catch (e) {
      console.error('Save prices error:', e);
      // Try insert-or-update one by one if upsert fails (e.g., no unique constraint on name)
      try {
        let successCount = 0;
        for (const p of products) {
          const price = n(prices[p.id]);
          try {
            const { data: existing } = await supabase
              .from('spec_products')
              .select('id')
              .eq('name', p.name)
              .limit(1);

            if (existing && existing.length > 0) {
              await supabase.from('spec_products').update({ price }).eq('name', p.name);
            } else {
              await supabase.from('spec_products').insert({
                name: p.name, unit: p.unit,
                cat: p.cat || p.category || 'Other',
                price,
              });
            }
            successCount++;
          } catch { /* skip individual failures */ }
        }
        setLastSaved(fmtNow());
        Alert.alert('Saved', `Updated ${successCount} of ${products.length} products.`);
      } catch (e2) {
        Alert.alert('Save Error', e2.message || 'Failed to save prices.');
      }
    }
    setSaving(false);
  }

  /* ── group by category ── */
  const cats = ['Mięso', 'Sosy', 'Oleje', 'Opakowania'];
  const grouped = cats.map(cat => ({
    cat,
    products: products.filter(p => (p.cat || p.category || '') === cat),
  })).filter(g => g.products.length > 0);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={ORANGE} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>💰 Product Prices</Text>
          <Text style={s.sub}>
            {lastSaved ? `Last saved: ${lastSaved}` : 'Manage supplier prices for all products'}
          </Text>
        </View>
        <TouchableOpacity
          style={[s.saveBtn, saving && { opacity: 0.6 }]}
          onPress={saveAllPrices}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnTxt}>💾 Save All</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.hint}>
          Update prices below. Tap "Save All" to push to all branches.
        </Text>

        {grouped.map(g => (
          <CategorySection
            key={g.cat}
            cat={g.cat}
            products={g.products}
            prices={prices}
            onPriceChange={(id, val) => setPrices(prev => ({ ...prev, [id]: val }))}
          />
        ))}

        {/* Bottom save button */}
        <TouchableOpacity
          style={[s.bottomSaveBtn, saving && { opacity: 0.6 }]}
          onPress={saveAllPrices}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.saveBtnTxt}>💾 Save All Prices</Text>
          }
        </TouchableOpacity>

        {lastSaved && (
          <Text style={s.savedTs}>✅ Saved at {lastSaved}</Text>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F4F6F8' },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header:        { backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title:         { fontSize: 20, fontWeight: '900', color: '#fff' },
  sub:           { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  saveBtn:       { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, minWidth: 90, alignItems: 'center' },
  saveBtnTxt:    { fontSize: 13, fontWeight: '900', color: '#fff' },
  content:       { padding: 14 },
  hint:          { fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 17 },
  bottomSaveBtn: { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  savedTs:       { fontSize: 11, color: COLORS.primary, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
});
