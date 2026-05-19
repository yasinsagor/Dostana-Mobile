import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchSpecProducts, insertSpecOrder } from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── helpers ─────────────────────────────────────────────── */
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysAgoStr(n) { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10); }
function fmtK(n) { if (!n) return '0'; return Math.abs(n)>=1000 ? (n/1000).toFixed(1)+'k' : String(Math.round(n)); }
function n(v) { return parseFloat(v) || 0; }

/* fallback price per unit if price not in DB */
function fallbackPrice(p) {
  const nm = (p.name||'').toLowerCase();
  const ut = (p.unit||'').toLowerCase();
  if (nm.includes('kurczak') || nm.includes('chicken')) return 25;
  if (nm.includes('baran') || nm.includes('lamb')) return 50;
  if (ut === 'kg') return 20;
  if (ut === 'karton') return 40;
  if (ut === 'l') return 5;
  return 10;
}


/* ─── fallback products (used when spec_products table is empty) ── */
const FALLBACK_PRODUCTS = [
  // Mięso
  { id:'f1',  name:'Kurczak',              unit:'kg',      category:'Mięso',     price:25 },
  { id:'f2',  name:'Baranina',             unit:'kg',      category:'Mięso',     price:50 },
  { id:'f3',  name:'Pita 55',              unit:'pckt',    category:'Mięso',     price:20 },
  { id:'f4',  name:'Pita 65',              unit:'pckt',    category:'Mięso',     price:22 },
  { id:'f5',  name:'Pita 110',             unit:'pckt',    category:'Mięso',     price:28 },
  { id:'f6',  name:'Pita 85',              unit:'pckt',    category:'Mięso',     price:24 },
  { id:'f7',  name:'Tortilla 30cm',        unit:'opak',    category:'Mięso',     price:18 },
  { id:'f8',  name:'Tortilla 35cm',        unit:'opak',    category:'Mięso',     price:20 },
  { id:'f9',  name:'Lawasz',               unit:'opak',    category:'Mięso',     price:15 },
  { id:'f10', name:'Bułka',                unit:'szt',     category:'Mięso',     price:3  },
  { id:'f11', name:'Frytki',               unit:'karton',  category:'Mięso',     price:45 },
  { id:'f12', name:'Cebula',               unit:'szt',     category:'Mięso',     price:5  },
  { id:'f13', name:'Nuggetsy',             unit:'szt',     category:'Mięso',     price:30 },
  { id:'f14', name:'Falafel',              unit:'szt',     category:'Mięso',     price:25 },
  // Sosy
  { id:'f15', name:'Sos musztardowo-miodowy', unit:'szt', category:'Sosy',      price:12 },
  { id:'f16', name:'Sos paprykowy ostry',  unit:'szt',    category:'Sosy',      price:12 },
  { id:'f17', name:'Sos jalapeño',         unit:'szt',    category:'Sosy',      price:12 },
  { id:'f18', name:'Sos serowy',           unit:'szt',    category:'Sosy',      price:12 },
  { id:'f19', name:'Ketchup 10kg',         unit:'szt',    category:'Sosy',      price:60 },
  { id:'f20', name:'Majonez 10kg',         unit:'szt',    category:'Sosy',      price:65 },
  { id:'f21', name:'Jogurt 10kg',          unit:'szt',    category:'Sosy',      price:40 },
  { id:'f22', name:'Ayran',                unit:'szt',    category:'Sosy',      price:8  },
  { id:'f23', name:'Ostry Sambal 10kg',    unit:'szt',    category:'Sosy',      price:70 },
  { id:'f24', name:'Mango (sos)',          unit:'szt',    category:'Sosy',      price:15 },
  // Oleje
  { id:'f25', name:'Olej do frutury',      unit:'szt',    category:'Oleje',     price:25 },
  { id:'f26', name:'Olej do kapusty 5kg',  unit:'szt',    category:'Oleje',     price:30 },
  { id:'f27', name:'Oliwa z oliwek',       unit:'L',      category:'Oleje',     price:20 },
  { id:'f28', name:'Cynamon',              unit:'szt',     category:'Oleje',     price:8  },
  { id:'f29', name:'Ocet',                 unit:'szt',    category:'Oleje',     price:5  },
  { id:'f30', name:'Sól',                  unit:'kg',     category:'Oleje',     price:3  },
  { id:'f31', name:'Folia aluminiowa',     unit:'box',    category:'Oleje',     price:15 },
  { id:'f32', name:'Domestos 5L',          unit:'szt',    category:'Oleje',     price:18 },
  { id:'f33', name:'Frytura oil',          unit:'pis',    category:'Oleje',     price:35 },
  { id:'f34', name:'Woda niegazowana',     unit:'pak',    category:'Oleje',     price:12 },
  { id:'f35', name:'Ocet winny',           unit:'butelek',category:'Oleje',     price:8  },
  // Opakowania
  { id:'f36', name:'Box obiadowy 750ml',   unit:'szt',    category:'Opakowania',price:15 },
  { id:'f37', name:'Koperta kebab',        unit:'szt',    category:'Opakowania',price:10 },
  { id:'f38', name:'Kubek plastikowy 200ml',unit:'szt',  category:'Opakowania',price:8  },
  { id:'f39', name:'Serwetka 15×15',       unit:'opak',   category:'Opakowania',price:5  },
  { id:'f40', name:'Serwetka 15×15 biała', unit:'opak',  category:'Opakowania',price:5  },
  { id:'f41', name:'Reklamówka 5kg',       unit:'szt',    category:'Opakowania',price:4  },
  { id:'f42', name:'Reklamówka 10kg',      unit:'szt',    category:'Opakowania',price:6  },
  { id:'f43', name:'Worki sanitarne 240L', unit:'szt',    category:'Opakowania',price:12 },
  { id:'f44', name:'Rękawiczki nitrylowe XL',unit:'opak',category:'Opakowania',price:15 },
  { id:'f45', name:'Rękawiczki nitrylowe L', unit:'opak',category:'Opakowania',price:15 },
  { id:'f46', name:'Ręcznik papierowy maxi', unit:'szt', category:'Opakowania',price:8  },
  { id:'f47', name:'Ściereczka mikrofibra', unit:'szt',  category:'Opakowania',price:5  },
  { id:'f48', name:'Rolka kasa 80×30 termiczna',unit:'szt',category:'Opakowania',price:10},
  { id:'f49', name:'Rolka kasa 57×20 termiczna',unit:'szt',category:'Opakowania',price:10},
  { id:'f50', name:'Kebab box 750ml',      unit:'szt',    category:'Opakowania',price:15 },
];

/* ─── category tab ────────────────────────────────────────── */
function CatTab({ label, active, onPress, badge }) {
  return (
    <TouchableOpacity style={[ct.tab, active && ct.tabActive]} onPress={onPress} activeOpacity={0.7}>
      <Text style={[ct.txt, active && ct.txtActive]}>{label}</Text>
      {badge > 0 && <View style={ct.badge}><Text style={ct.badgeTxt}>{badge}</Text></View>}
    </TouchableOpacity>
  );
}
const ct = StyleSheet.create({
  tab:       { paddingHorizontal:14, paddingVertical:8, borderRadius:20, borderWidth:1.5, borderColor:'#E0E0E0', backgroundColor:'#fff', marginRight:6 },
  tabActive: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  txt:       { fontSize:12, fontWeight:'700', color:'#888' },
  txtActive: { color:'#fff' },
  badge:     { position:'absolute', top:-4, right:-4, backgroundColor:COLORS.primary, borderRadius:8, width:16, height:16, alignItems:'center', justifyContent:'center' },
  badgeTxt:  { fontSize:9, color:'#fff', fontWeight:'800' },
});

/* ─── kg size picker (Kurczak / Baranina) ────────────────────── */
const KG_SIZES = ['10kg','15kg','20kg','25kg','30kg'];

function KgPicker({ selected, onSelect }) {
  return (
    <View style={kp.row}>
      <Text style={kp.label}>Size:</Text>
      {KG_SIZES.map(k => (
        <TouchableOpacity
          key={k}
          style={[kp.chip, selected===k && kp.chipOn]}
          onPress={()=>onSelect(k)}
          activeOpacity={0.7}
        >
          <Text style={[kp.txt, selected===k && kp.txtOn]}>{k}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
const kp = StyleSheet.create({
  row:    { flexDirection:'row', alignItems:'center', gap:5, marginTop:5 },
  label:  { fontSize:10, color:'#aaa', fontWeight:'700', marginRight:2 },
  chip:   { paddingHorizontal:9, paddingVertical:4, borderRadius:16, borderWidth:1.5, borderColor:'#E0E0E0', backgroundColor:'#F8F8F8' },
  chipOn: { backgroundColor:COLORS.primary, borderColor:COLORS.primary },
  txt:    { fontSize:11, fontWeight:'700', color:'#888' },
  txtOn:  { color:'#fff' },
});

/* ─── product row ─────────────────────────────────────────── */
function ProductRow({ product, qty, onChange, lastQty, isMeat, kgSize, onKgSize, isMeatSpecial }) {
  const qtyN = n(qty);
  const lastN = n(lastQty);
  const diff  = lastN > 0 ? qtyN - lastN : null;
  const price = product.price || fallbackPrice(product);
  // For meat with kg size: cost = qty × kgSizeNumber × price/kg
  const kgNum = isMeatSpecial && kgSize ? parseInt(kgSize.replace('kg',''))||1 : 1;
  const lineCost = isMeatSpecial ? qtyN * kgNum * price : qtyN * price;
  const totalKgDisplay = isMeatSpecial && qtyN > 0 ? `${qtyN} × ${kgSize||'10kg'} = ${qtyN*kgNum}kg` : null;

  const adj = (delta) => {
    const next = Math.max(0, qtyN + delta);
    onChange(next > 0 ? String(next) : '');
  };

  return (
    <View style={[pr.row, qtyN > 0 && pr.rowActive]}>
      <View style={{flex:1}}>
        <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
          <Text style={pr.name}>{product.name}</Text>
          {diff !== null && qtyN > 0 && (
            <Text style={[pr.diff, {color: diff>0?COLORS.primary:diff<0?COLORS.danger:'#aaa'}]}>
              {diff>0?`↑${diff}`:diff<0?`↓${Math.abs(diff)}`:'='}
            </Text>
          )}
        </View>
        {isMeatSpecial
          ? <KgPicker selected={kgSize||'10kg'} onSelect={onKgSize}/>
          : (
            <View style={{flexDirection:'row',alignItems:'center',gap:6,marginTop:2}}>
              <Text style={pr.unit}>{product.unit}</Text>
              {lineCost>0 && <Text style={pr.cost}>~{fmtK(lineCost)} PLN</Text>}
            </View>
          )
        }
        {totalKgDisplay && <Text style={pr.totalKg}>{totalKgDisplay} · ~{fmtK(lineCost)} PLN</Text>}
      </View>

      <View style={pr.controls}>
        {/* quick +5/+10 for other meat/kg items */}
        {isMeat && !isMeatSpecial && (
          <View style={pr.quickRow}>
            {[5,10].map(d => (
              <TouchableOpacity key={d} style={pr.quickBtn} onPress={()=>adj(d)} activeOpacity={0.7}>
                <Text style={pr.quickTxt}>+{d}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        <View style={pr.stepper}>
          <TouchableOpacity style={pr.stepBtn} onPress={()=>adj(-1)} activeOpacity={0.7}>
            <Text style={pr.stepTxt}>−</Text>
          </TouchableOpacity>
          <TextInput
            style={[pr.qtyInput, qtyN > 0 && pr.qtyInputActive]}
            value={String(qty||'')}
            onChangeText={onChange}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor="#ccc"
          />
          <TouchableOpacity style={[pr.stepBtn, pr.stepBtnPlus]} onPress={()=>adj(1)} activeOpacity={0.7}>
            <Text style={[pr.stepTxt,{color:'#fff'}]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
const pr = StyleSheet.create({
  row:          { flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5', gap:8 },
  rowActive:    { backgroundColor:'#F0FFF4' },
  name:         { fontSize:13, fontWeight:'700', color:'#222' },
  unit:         { fontSize:11, color:'#aaa' },
  cost:         { fontSize:11, color:COLORS.primary, fontWeight:'700' },
  diff:         { fontSize:11, fontWeight:'800' },
  controls:    { alignItems:'flex-end', gap:4 },
  quickRow:     { flexDirection:'row', gap:4 },
  quickBtn:     { backgroundColor:'#E8F5E9', borderRadius:6, paddingHorizontal:8, paddingVertical:3 },
  quickTxt:     { fontSize:10, fontWeight:'800', color:COLORS.primary },
  stepper:      { flexDirection:'row', alignItems:'center', gap:4 },
  stepBtn:      { width:30, height:30, borderRadius:8, backgroundColor:'#F0F0F0', alignItems:'center', justifyContent:'center' },
  stepBtnPlus:  { backgroundColor:COLORS.primary },
  stepTxt:      { fontSize:16, fontWeight:'900', color:'#555' },
  qtyInput:     { width:44, textAlign:'center', borderWidth:1.5, borderColor:'#E0E0E0', borderRadius:8, paddingVertical:4, fontSize:14, fontWeight:'800', color:'#111', backgroundColor:'#FAFAFA' },
  qtyInputActive:{ borderColor:COLORS.primary, backgroundColor:'#E8F5E9' },
  totalKg:      { fontSize:11, color:COLORS.primary, fontWeight:'800', marginTop:3 },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerSpecScreen() {
  const { user } = useAuth();
  const branch  = user?.branch || '';
  const today   = todayStr();
  const draftKey = `spec_draft_${branch}_${today}`;

  const [products,  setProducts]  = useState([]);
  const [quantities,setQty]       = useState({});
  const [lastOrder, setLastOrder] = useState(null); // { items: [...] }
  const [activeTab, setActiveTab] = useState('All');
  const [search,    setSearch]    = useState('');
  const [note,      setNote]      = useState('');
  const [kgSizes,   setKgSizes]   = useState({}); // { productId: '25kg' } for Kurczak/Baranina
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [monthRev,  setMonthRev]  = useState(0);
  const [monthSpec, setMonthSpec] = useState(0);
  const autoSaveTimer = useRef(null);

  /* ── init ── */
  useEffect(() => {
    async function init() {
      try {
        // products
        const prods = await fetchSpecProducts();
        setProducts(prods && prods.length > 0 ? prods : FALLBACK_PRODUCTS);

        // check if already submitted today
        const { data:todaySpec } = await supabase
          .from('spec_orders').select('id').eq('branch',branch).eq('date',today).limit(1);
        setAlreadySubmitted(!!(todaySpec && todaySpec.length));

        // last order
        const { data:prev } = await supabase
          .from('spec_orders').select('items,date').eq('branch',branch)
          .lt('date',today).order('date',{ascending:false}).limit(1);
        if (prev && prev[0]) {
          let items = prev[0].items;
          if (typeof items === 'string') { try { items = JSON.parse(items); } catch { items = []; } }
          setLastOrder({ date: prev[0].date, items: Array.isArray(items) ? items : [] });
        }

        // this month revenue
        const y = new Date().getFullYear(), m = new Date().getMonth()+1;
        const pad = v => String(v).padStart(2,'0');
        const lastDay = new Date(y,m,0).getDate();
        const from = `${y}-${pad(m)}-01`, to = `${y}-${pad(m)}-${pad(lastDay)}`;
        const { data:drRows } = await supabase.from('daily_reports')
          .select('total_revenue,revenue').eq('branch',branch).gte('date',from).lte('date',to);
        const rev = (drRows||[]).reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
        setMonthRev(rev);

        // this month spec orders count (rough cost)
        const { data:spRows } = await supabase.from('spec_orders')
          .select('items').eq('branch',branch).gte('date',from).lte('date',to);
        // rough cost from items using fallback prices
        let spCost = 0;
        (spRows||[]).forEach(o => {
          let items = o.items;
          if (typeof items==='string') { try { items=JSON.parse(items); } catch { items=[]; } }
          if (!Array.isArray(items)) items = [];
          const prodMap = Object.fromEntries((prods && prods.length > 0 ? prods : FALLBACK_PRODUCTS).map(p=>[p.name, p]));
          items.forEach(it => {
            const prod = prodMap[it.name];
            spCost += n(it.qty) * (prod?.price || fallbackPrice(prod || { name:it.name, unit:it.unit }));
          });
        });
        setMonthSpec(spCost);

        // restore draft
        try {
          const raw = await AsyncStorage.getItem(draftKey);
          if (raw) {
            const d = JSON.parse(raw);
            if (d.quantities) setQty(d.quantities);
            if (d.note)       setNote(d.note);
          }
        } catch {}
      } catch(e) { console.error(e); }
      setLoading(false);
    }
    init();
  }, [branch, today, draftKey]);

  /* ── auto-save draft ── */
  const triggerSave = useCallback(() => {
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try { await AsyncStorage.setItem(draftKey, JSON.stringify({ quantities, note })); } catch {}
    }, 600);
  }, [quantities, note, draftKey]);
  useEffect(() => { if (!loading) triggerSave(); }, [quantities, note, loading]);

  /* ── load last order ── */
  const applyLastOrder = () => {
    if (!lastOrder) return;
    const prodMap = Object.fromEntries(products.map(p=>[p.name, p]));
    const newQty = {};
    lastOrder.items.forEach(it => {
      const prod = products.find(p => p.name === it.name);
      if (prod) newQty[prod.id] = String(it.qty);
    });
    setQty(newQty);
    Alert.alert('Last Order Loaded', `${lastOrder.date} — quantities pre-filled. Adjust as needed.`);
  };

  /* ── derived ── */
  const cats = ['All', ...new Set(products.map(p => p.category || p.cat || 'Other'))];

  const filtered = products.filter(p => {
    const cat = p.category || p.cat || 'Other';
    const matchTab  = activeTab === 'All' || cat === activeTab;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchSearch;
  });

  const ordered = products.filter(p => n(quantities[p.id]) > 0);

  const estimatedCost = ordered.reduce((s,p) => s+(n(quantities[p.id])*(p.price||fallbackPrice(p))),0);

  const specPct = monthRev > 0 ? Math.round(monthSpec/monthRev*100) : null;

  /* badge count per tab */
  const tabBadge = (cat) => {
    if (cat === 'All') return ordered.length;
    return products.filter(p=>(p.category||p.cat||'Other')===cat && n(quantities[p.id])>0).length;
  };

  /* ── missing category check ── */
  const checkMissing = () => {
    if (cats.length <= 1) return [];
    const orderedCats = new Set(ordered.map(p => p.category || p.cat || 'Other'));
    return cats.filter(c => c !== 'All' && !orderedCats.has(c));
  };

  /* ── submit ── */
  async function handleSubmit() {
    if (ordered.length === 0) { Alert.alert('Empty Order', 'Select at least one product.'); return; }
    if (alreadySubmitted) { Alert.alert('Already Submitted', 'SPEC order already submitted for today.'); return; }

    const missing = checkMissing();
    if (missing.length > 0) {
      Alert.alert(
        '⚠️ Missing Categories',
        `No items ordered from: ${missing.join(', ')}\n\nContinue anyway?`,
        [{ text:'Go Back', style:'cancel' }, { text:'Submit Anyway', onPress: doSubmit }]
      );
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setSaving(true);
    try {
      const items = ordered.map(p => {
        const isMeatSpecial = p.name==='Kurczak'||p.name==='Baranina';
        const selectedKg = kgSizes[p.id]||'10kg';
        const kgNum = isMeatSpecial ? parseInt(selectedKg.replace('kg',''))||1 : 1;
        return {
          id:   p.id,
          name: p.name,
          qty:  n(quantities[p.id]),
          unit: isMeatSpecial ? selectedKg : (p.unit || ''),
          totalKg: isMeatSpecial ? n(quantities[p.id])*kgNum : undefined,
          cat:  p.category || p.cat || 'Other',
          price: p.price || fallbackPrice(p),
        };
      });
      await insertSpecOrder({
        branch, date:today, items,
        estimated_cost: Math.round(estimatedCost),
        supplier_note:  note || null,
        submitted_at:   new Date().toISOString(),
      });
      await AsyncStorage.removeItem(draftKey);
      setSubmitted(true);
    } catch(e) {
      Alert.alert('Error', e.message || 'Submission failed. Try again.');
    }
    setSaving(false);
  }

  /* ── success screen ── */
  if (submitted) {
    const lastItem = lastOrder?.items;
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.successHeader}>
          <Text style={{fontSize:48,marginBottom:8}}>✅</Text>
          <Text style={s.successTitle}>Order Submitted!</Text>
          <Text style={s.successSub}>{branch} · {today}</Text>
        </View>
        <ScrollView contentContainerStyle={{padding:20,gap:10}}>
          <View style={s.successCard}>
            <View style={s.successRow}><Text style={s.sLabel}>Items ordered</Text><Text style={s.sVal}>{ordered.length}</Text></View>
            <View style={s.successRow}><Text style={s.sLabel}>Est. order cost</Text><Text style={[s.sVal,{color:COLORS.primary}]}>~{fmtK(estimatedCost)} PLN</Text></View>
            {specPct!==null&&<View style={s.successRow}><Text style={s.sLabel}>Month SPEC % of revenue</Text><Text style={[s.sVal,{color:specPct>15?COLORS.danger:COLORS.primary}]}>{specPct}%</Text></View>}
          </View>
          <View style={s.supplierNote}>
            <Text style={s.supplierNoteTitle}>📱 Supplier Portal</Text>
            <Text style={s.supplierNoteTxt}>Your order is now visible to the supplier. They can view all branch orders at the supplier portal link.</Text>
          </View>
          {note?<View style={[s.supplierNote,{backgroundColor:'#FFF8E1',borderLeftColor:'#F9A825'}]}><Text style={[s.supplierNoteTitle,{color:'#E65100'}]}>📝 Your note</Text><Text style={s.supplierNoteTxt}>{note}</Text></View>:null}
          <TouchableOpacity style={s.newBtn} onPress={()=>{ setSubmitted(false); setQty({}); setNote(''); setAlreadySubmitted(true); }} activeOpacity={0.85}>
            <Text style={s.newBtnTxt}>← Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>
    </SafeAreaView>
  );

  /* ── main form ── */
  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View style={{flex:1}}>
          <Text style={s.title}>📦 SPEC Order</Text>
          <View style={{flexDirection:'row',alignItems:'center',gap:8,marginTop:3}}>
            <Text style={s.headerSub}>{branch} · {today}</Text>
            {specPct!==null&&(
              <View style={[s.specPill,{backgroundColor:specPct>15?'#FFEBEE':specPct>10?'#FFF8E1':'#E8F5E9'}]}>
                <Text style={[s.specPillTxt,{color:specPct>15?COLORS.danger:specPct>10?'#E65100':COLORS.primary}]}>
                  {specPct}% of rev
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={{gap:4,alignItems:'flex-end'}}>
          <TouchableOpacity
            style={[s.lastBtn,{opacity:lastOrder?1:0.3}]}
            onPress={applyLastOrder} disabled={!lastOrder} activeOpacity={0.7}>
            <Text style={s.lastBtnTxt}>🕐 Last Order</Text>
          </TouchableOpacity>
          {alreadySubmitted&&<Text style={{fontSize:10,color:COLORS.primary,fontWeight:'700'}}>✅ Submitted</Text>}
        </View>
      </View>

      {/* Category tabs */}
      <View style={s.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {cats.map(cat => (
            <CatTab key={cat} label={cat} active={activeTab===cat} onPress={()=>setActiveTab(cat)} badge={cat==='All'?0:tabBadge(cat)}/>
          ))}
        </ScrollView>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search product..."
          placeholderTextColor="#bbb"
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Product list */}
        {filtered.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyTxt}>No products found</Text></View>
        ) : (
          <View style={s.section}>
            {filtered.map(p => {
              const cat = p.category || p.cat || 'Other';
              const isMeat = cat.toLowerCase().includes('mięso') || cat.toLowerCase().includes('meat') ||
                             (p.unit||'').toLowerCase() === 'kg';
              const lastItem = lastOrder?.items?.find(it=>it.name===p.name);
              const isMeatSpecial = p.name==='Kurczak'||p.name==='Baranina';
              return (
                <ProductRow
                  key={p.id}
                  product={p}
                  qty={quantities[p.id]||''}
                  onChange={v => setQty(q=>({...q,[p.id]:v}))}
                  lastQty={lastItem?.qty}
                  isMeat={isMeat}
                  isMeatSpecial={isMeatSpecial}
                  kgSize={kgSizes[p.id]||'10kg'}
                  onKgSize={v => setKgSizes(k=>({...k,[p.id]:v}))}
                />
              );
            })}
          </View>
        )}

        {/* Order summary (when items selected) */}
        {ordered.length > 0 && (
          <View style={s.summaryCard}>
            <Text style={s.summaryTitle}>ORDER SUMMARY · {ordered.length} items</Text>
            {ordered.map(p=>(
              <View key={p.id} style={s.summaryRow}>
                <Text style={s.summaryName}>{p.name}</Text>
                <Text style={s.summaryQty}>{quantities[p.id]} {p.unit}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Supplier note */}
        <View style={s.noteCard}>
          <Text style={s.noteLabel}>📝 Note to supplier (optional)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="e.g. Please bring fresh pita, need extra sauces..."
            placeholderTextColor="#bbb"
            multiline
            numberOfLines={2}
            value={note}
            onChangeText={setNote}
          />
        </View>

        <View style={{height:90}}/>
      </ScrollView>

      {/* Sticky footer */}
      <View style={s.footer}>
        <View style={s.footerLeft}>
          <Text style={s.footerCost}>~{fmtK(estimatedCost)} PLN</Text>
          <Text style={s.footerLabel}>{ordered.length} items est.</Text>
        </View>
        <TouchableOpacity
          style={[s.submitBtn, (saving||alreadySubmitted) && {opacity:0.6}]}
          onPress={handleSubmit}
          disabled={saving||alreadySubmitted}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator color="#fff" size="small"/>
            : <Text style={s.submitTxt}>{alreadySubmitted?'✅ Submitted':'Submit Order'}</Text>
          }
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe:             { flex:1, backgroundColor:'#F4F6F8' },
  center:           { flex:1, justifyContent:'center', alignItems:'center' },
  header:           { backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:12, flexDirection:'row', alignItems:'center', borderBottomWidth:1, borderBottomColor:'#EEE' },
  title:            { fontSize:17, fontWeight:'900', color:'#222' },
  headerSub:        { fontSize:11, color:'#aaa' },
  specPill:         { borderRadius:8, paddingHorizontal:8, paddingVertical:3 },
  specPillTxt:      { fontSize:10, fontWeight:'800' },
  lastBtn:          { backgroundColor:'#F5F5F5', borderRadius:8, paddingHorizontal:10, paddingVertical:6 },
  lastBtnTxt:       { fontSize:12, fontWeight:'700', color:'#555' },
  tabsWrap:         { backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#EEE' },
  tabs:             { paddingHorizontal:14, paddingVertical:10, gap:0 },
  searchWrap:       { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', marginHorizontal:14, marginVertical:10, borderRadius:12, paddingHorizontal:12, borderWidth:1.5, borderColor:'#E0E0E0' },
  searchIcon:       { fontSize:14, marginRight:6 },
  searchInput:      { flex:1, paddingVertical:10, fontSize:13, color:'#222' },
  content:          { padding:14 },
  section:          { backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:12 },
  empty:            { alignItems:'center', padding:40 },
  emptyTxt:         { color:'#aaa', fontSize:13 },
  summaryCard:      { backgroundColor:COLORS.primary, borderRadius:14, padding:14, marginBottom:12 },
  summaryTitle:     { fontSize:10, fontWeight:'800', color:'rgba(255,255,255,0.7)', letterSpacing:1, marginBottom:10, textTransform:'uppercase' },
  summaryRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:4 },
  summaryName:      { fontSize:13, color:'#fff' },
  summaryQty:       { fontSize:13, fontWeight:'900', color:'#fff' },
  noteCard:         { backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:12 },
  noteLabel:        { fontSize:12, fontWeight:'700', color:'#555', marginBottom:8 },
  noteInput:        { backgroundColor:'#F8F8F8', borderRadius:10, padding:12, fontSize:13, color:'#222', minHeight:55, textAlignVertical:'top', borderWidth:1, borderColor:'#E0E0E0' },
  footer:           { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#1B1B2F', flexDirection:'row', alignItems:'center', paddingHorizontal:16, paddingVertical:12, paddingBottom:Platform.OS==='ios'?24:12, gap:12, shadowColor:'#000', shadowOpacity:0.3, shadowRadius:8, elevation:12 },
  footerLeft:       { flex:1 },
  footerCost:       { fontSize:18, fontWeight:'900', color:'#fff' },
  footerLabel:      { fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:1 },
  submitBtn:        { backgroundColor:COLORS.primary, borderRadius:12, paddingHorizontal:20, paddingVertical:13 },
  submitTxt:        { color:'#fff', fontWeight:'900', fontSize:13 },
  successHeader:    { backgroundColor:COLORS.primary, padding:30, alignItems:'center' },
  successTitle:     { fontSize:22, fontWeight:'900', color:'#fff', marginBottom:4 },
  successSub:       { fontSize:13, color:'rgba(255,255,255,0.8)' },
  successCard:      { backgroundColor:'#fff', borderRadius:14, padding:16, shadowColor:'#000', shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  successRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F5F5F5' },
  sLabel:           { fontSize:13, color:'#555' },
  sVal:             { fontSize:14, fontWeight:'800', color:'#222' },
  supplierNote:     { backgroundColor:'#E8F5E9', borderRadius:12, padding:14, borderLeftWidth:3, borderLeftColor:COLORS.primary },
  supplierNoteTitle:{ fontSize:13, fontWeight:'800', color:COLORS.primary, marginBottom:4 },
  supplierNoteTxt:  { fontSize:12, color:'#555', lineHeight:18 },
  newBtn:           { backgroundColor:'#333', borderRadius:12, padding:14, alignItems:'center' },
  newBtnTxt:        { color:'#fff', fontWeight:'800', fontSize:14 },
});
