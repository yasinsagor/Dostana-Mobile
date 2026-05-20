import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { supabase, fetchDailyReports, fetchCashflowReports, fetchSpecOrders, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS } from '../../constants';

/* ─── helpers ───────────────────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0'); }
function fmtK(n) { if (!n && n !== 0) return '0'; return Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n)); }
function monthRange() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1;
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` };
}
function lastMonthRange() {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth() + 1;
  const lm = m === 1 ? 12 : m - 1, ly = m === 1 ? y - 1 : y;
  return { from: `${ly}-${pad(lm)}-01`, to: `${ly}-${pad(lm)}-${pad(new Date(ly, lm, 0).getDate())}` };
}
function threeMonthsAgo() {
  const d = new Date(); d.setMonth(d.getMonth() - 3);
  return d.toISOString().slice(0, 10);
}
function dayName(iso) { return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(iso).getDay()]; }
function extractItems(items) {
  if (!items) return [];
  if (typeof items === 'string') { try { items = JSON.parse(items); } catch { return []; } }
  return Array.isArray(items) ? items : [];
}
function parseUnitKg(unit) {
  if (!unit) return 1;
  const m = String(unit).match(/(\d+)\s*kg/i);
  return m ? parseInt(m[1]) : (String(unit).toLowerCase() === 'kg' ? 1 : 0);
}
function pct(a, b) { if (!b) return null; return Math.round((a - b) / b * 100); }
function trendArrow(p) {
  if (p === null) return { arrow: '—', color: '#aaa' };
  if (p > 0) return { arrow: `↑${p}%`, color: COLORS.primary };
  if (p < 0) return { arrow: `↓${Math.abs(p)}%`, color: COLORS.danger };
  return { arrow: '=', color: '#aaa' };
}
const DELIVERY_KEYS = ['wolt', 'glovo', 'uber_eats', 'bolt', 'pyszne'];
const DELIVERY_LABELS = { wolt: 'Wolt', glovo: 'Glovo', uber_eats: 'Uber', bolt: 'Bolt', pyszne: 'Pyszne' };

/* ─── mini components ───────────────────────────────────────── */
function StatCard({ label, value, sub, color = COLORS.primary, bg = '#E8F5E9' }) {
  return (
    <View style={[sc.card, { backgroundColor: bg }]}>
      <Text style={[sc.val, { color }]}>{value}</Text>
      <Text style={sc.label}>{label}</Text>
      {sub ? <Text style={[sc.sub, { color }]}>{sub}</Text> : null}
    </View>
  );
}
const sc = StyleSheet.create({
  card: { flex: 1, borderRadius: 12, padding: 12, alignItems: 'center', margin: 3 },
  val: { fontSize: 17, fontWeight: '900', marginBottom: 2, textAlign: 'center' },
  label: { fontSize: 10, color: '#888', textAlign: 'center', fontWeight: '600' },
  sub: { fontSize: 10, fontWeight: '800', marginTop: 2, textAlign: 'center' },
});

function SectionCard({ title, children, color = COLORS.primary }) {
  return (
    <View style={[card.wrap, { borderTopColor: color }]}>
      <Text style={[card.title, { color }]}>{title}</Text>
      {children}
    </View>
  );
}
const card = StyleSheet.create({
  wrap: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, borderTopWidth: 3, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  title: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
});

/* ─── horizontal scrollable inner tab bar ───────────────────── */
const INNER_TABS = ['Summary', 'Daily', 'Cash', 'SPEC', 'Rank', 'Staff'];
function InnerTabBar({ active, onPress }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={itb.scroll} contentContainerStyle={itb.container}>
      {INNER_TABS.map(t => (
        <TouchableOpacity key={t} style={[itb.tab, active === t && itb.active]} onPress={() => onPress(t)} activeOpacity={0.7}>
          <Text style={[itb.txt, active === t && itb.activeTxt]}>{t}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}
const itb = StyleSheet.create({
  scroll: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE', flexGrow: 0 },
  container: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: 'transparent', marginRight: 2 },
  active: { borderBottomColor: COLORS.primary },
  txt: { fontSize: 13, fontWeight: '600', color: '#aaa' },
  activeTxt: { color: COLORS.primary, fontWeight: '800' },
});

/* ════════════════════════════════════════════════════════════ */
export default function ManagerMyDataScreen() {
  const { user } = useAuth();
  const branch = user?.branch || '';
  const [tab, setTab] = useState('Summary');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState({});

  /* data */
  const [dr, setDr] = useState([]);       // current month
  const [drAll, setDrAll] = useState([]); // 3 months (for Daily tab)
  const [cf, setCf] = useState([]);       // current month
  const [cfAll, setCfAll] = useState([]); // 3 months (for Cash tab)
  const [spec, setSpec] = useState([]);   // all SPEC orders
  const [drLast, setDrLast] = useState([]);
  const [allDr, setAllDr] = useState([]);

  /* edit modal */
  const [editModal, setEditModal] = useState(null);
  const [saving, setSaving] = useState(false);

  const { from, to } = monthRange();
  const { from: lfrom, to: lto } = lastMonthRange();
  const histFrom = threeMonthsAgo();
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    try {
      const [dCur, dHist, cCur, cHist, s, dl, all] = await Promise.all([
        fetchDailyReports(branch, from, to),
        fetchDailyReports(branch, histFrom, today),
        fetchCashflowReports(branch, from, to),
        fetchCashflowReports(branch, histFrom, today),
        fetchSpecOrders(branch),
        fetchDailyReports(branch, lfrom, lto),
        fetchAllDailyReports(from, to),
      ]);
      setDr(dCur || []);
      setDrAll(dHist || []);
      setCf(cCur || []);
      setCfAll(cHist || []);
      setSpec((s || []).slice(0, 60));
      setDrLast(dl || []);
      setAllDr(all || []);
    } catch (e) { console.error(e); }
    setLoading(false); setRefreshing(false);
  }, [branch, from, to, lfrom, lto, histFrom, today]);

  useEffect(() => { load(); }, [load]);

  function toggle(key) { setExpanded(e => ({ ...e, [key]: !e[key] })); }

  /* ── edit / delete ── */
  function openEditDR(record) {
    setEditModal({
      type: 'dr', record,
      fields: {
        total_revenue: String(record.total_revenue || record.revenue || 0),
        total_hours: String(record.total_hours || record.hours || 0),
        wolt: String(record.wolt || 0),
        glovo: String(record.glovo || 0),
        uber_eats: String(record.uber_eats || 0),
        bolt: String(record.bolt || 0),
        pyszne: String(record.pyszne || 0),
      },
    });
  }

  function openEditCF(record) {
    const exps = Array.isArray(record.expenses) ? record.expenses : [];
    const fields = { total_expenses: String(record.total_expenses || 0) };
    exps.forEach(e => { fields[`exp_${e.name}`] = String(e.amount || 0); });
    setEditModal({ type: 'cf', record, fields, expenses: exps });
  }

  async function saveEdit() {
    if (!editModal) return;
    setSaving(true);
    try {
      const { type, record, fields, expenses } = editModal;
      if (type === 'dr') {
        const updates = {};
        Object.entries(fields).forEach(([k, v]) => { updates[k] = parseFloat(v) || 0; });
        updates.revenue = updates.total_revenue;
        updates.hours = updates.total_hours;
        await supabase.from('daily_reports').update(updates).eq('id', record.id);
      } else {
        const updatedExps = (expenses || []).map(e => ({ ...e, amount: parseFloat(fields[`exp_${e.name}`]) || 0 }));
        await supabase.from('cashflow_reports').update({
          total_expenses: parseFloat(fields.total_expenses) || 0,
          expenses: updatedExps,
        }).eq('id', record.id);
      }
    } catch (e) { Alert.alert('Error', e.message); }
    setSaving(false);
    setEditModal(null);
    load();
  }

  function confirmDelete(type, id) {
    const table = type === 'dr' ? 'daily_reports' : 'cashflow_reports';
    const label = type === 'dr' ? 'daily report' : 'cash flow record';
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try { await supabase.from(table).delete().eq('id', id); }
          catch (e) { Alert.alert('Error', e.message); return; }
          load();
        }
      },
    ]);
  }

  /* ── derived (Summary tab) ── */
  const rev = dr.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const revLast = drLast.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const totalCF = cf.reduce((s, r) => s + (r.total_expenses || 0), 0);
  const totalHours = dr.reduce((s, r) => s + (r.total_hours || r.hours || 0), 0);
  const revPct = pct(rev, revLast);
  const revPerHr = totalHours > 0 ? Math.round(rev / totalHours) : 0;
  const avgDay = dr.length > 0 ? Math.round(rev / dr.length) : 0;
  const bestDay = dr.reduce((best, r) => { const v = r.total_revenue || r.revenue || 0; return v > (best?.val || 0) ? { val: v, date: r.date } : best; }, null);
  const deliveryRev = dr.reduce((s, r) => s + DELIVERY_KEYS.reduce((d, k) => d + (r[k] || 0), 0), 0);
  const delivPct = rev > 0 ? Math.round(deliveryRev / rev * 100) : 0;
  const target = revLast > 0 ? Math.round(revLast * 1.05) : null;
  const targetPct = target && rev > 0 ? Math.min(100, Math.round(rev / target * 100)) : null;

  let chickenKg = 0, lambKg = 0, specCost = 0;
  spec.filter(o => o.date >= from && o.date <= to).forEach(o => {
    extractItems(o.items).forEach(it => {
      const qty = parseFloat(it.qty || 0);
      const kgPerUnit = parseUnitKg(it.unit);
      const nm = (it.name || '').toLowerCase();
      if (nm.includes('kurczak')) chickenKg += qty * (kgPerUnit || 1);
      else if (nm.includes('baran')) lambKg += qty * (kgPerUnit || 1);
      specCost += qty * (it.price || 0);
    });
  });
  const foodCostPct = rev > 0 && specCost > 0 ? (specCost / rev * 100).toFixed(1) : null;
  const inneTotal = cf.reduce((s, r) => { const exps = Array.isArray(r.expenses) ? r.expenses : []; return s + exps.filter(e => e.name === 'Inne').reduce((x, e) => x + parseFloat(e.amount || 0), 0); }, 0);
  const innePct = totalCF > 0 ? Math.round(inneTotal / totalCF * 100) : 0;

  const warnings = [];
  if (delivPct > 40) warnings.push({ icon: '🚚', txt: `High delivery: ${delivPct}% of revenue (target <40%)` });
  if (totalCF > 0 && totalCF / rev > 0.5) warnings.push({ icon: '💸', txt: `CF expenses ${Math.round(totalCF / rev * 100)}% of revenue — check costs` });
  if (innePct > 20) warnings.push({ icon: '⚠️', txt: `"Inne" is ${innePct}% of expenses — add descriptions` });
  if (foodCostPct && parseFloat(foodCostPct) > 15) warnings.push({ icon: '📦', txt: `Food cost ${foodCostPct}% — reduce SPEC ordering` });
  if (dr.length < new Date().getDate() - 3) warnings.push({ icon: '📋', txt: `Only ${dr.length} reports this month — improve consistency` });

  const last7Hours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - 6 + i);
    const iso = d.toISOString().slice(0, 10);
    const r = dr.find(x => x.date === iso);
    return { iso, hrs: r?.total_hours || r?.hours || 0, day: dayName(iso) };
  });
  const maxHrs = Math.max(...last7Hours.map(d => d.hrs), 1);

  /* Rank */
  const branchRevMap = {};
  allDr.forEach(r => { const b = r.branch || ''; branchRevMap[b] = (branchRevMap[b] || 0) + (r.total_revenue || r.revenue || 0); });
  const sorted = Object.entries(branchRevMap).sort((a, b) => b[1] - a[1]);
  const myRank = sorted.findIndex(([b]) => b === branch) + 1 || '?';
  const chainAvg = sorted.length > 0 ? Math.round(sorted.reduce((s, [, v]) => s + v, 0) / sorted.length) : 0;
  const { arrow: revArrow, color: arrowColor } = trendArrow(revPct);

  if (loading) return (
    <SafeAreaView style={s.safe}>
      <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>📊 {branch}</Text>
          <Text style={s.headerSub}>{new Date().toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</Text>
        </View>
        <View style={[s.rankBadge, { backgroundColor: myRank <= 3 ? '#FFF8E1' : '#F5F5F5' }]}>
          <Text style={[s.rankTxt, { color: myRank <= 3 ? '#E65100' : COLORS.primary }]}>#{myRank}</Text>
          <Text style={s.rankLbl}>in chain</Text>
        </View>
      </View>

      <InnerTabBar active={tab} onPress={setTab} />

      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.primary} />}
      >

        {/* ══ SUMMARY ══════════════════════════════════════════ */}
        {tab === 'Summary' && (<>

          <SectionCard title="This Month Summary" color={COLORS.primary}>
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Revenue" value={`${fmtK(rev)} PLN`} color={COLORS.primary} bg="#E8F5E9" />
              <StatCard label="CF Expenses" value={`${fmtK(totalCF)} PLN`} color="#D32F2F" bg="#FFEBEE" />
            </View>
            <View style={{ flexDirection: 'row', marginTop: 0 }}>
              <StatCard label="Hours" value={`${totalHours}h`} color="#555" bg="#F5F5F5" />
              <StatCard label="vs Last Month" value={revArrow} color={arrowColor} bg={revPct && revPct > 0 ? '#E8F5E9' : revPct && revPct < 0 ? '#FFEBEE' : '#F5F5F5'} />
            </View>
            {bestDay && <View style={s.infoBox}><Text style={s.infoTxt}>🏆 Best day: {bestDay.date} — {fmtK(bestDay.val)} PLN</Text></View>}
            {target && (
              <View style={{ marginTop: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#555' }}>🎯 Monthly Target</Text>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.primary }}>{targetPct}% of {fmtK(target)} PLN</Text>
                </View>
                <View style={s.barWrap}><View style={[s.barFill, { width: `${targetPct}%`, backgroundColor: targetPct >= 100 ? '#2E7D32' : COLORS.primary }]} /></View>
              </View>
            )}
          </SectionCard>

          {warnings.length > 0 && (
            <SectionCard title="⚠️ Warnings" color={COLORS.danger}>
              {warnings.map((w, i) => (
                <View key={i} style={s.warnRow}>
                  <Text style={{ fontSize: 16 }}>{w.icon}</Text>
                  <Text style={s.warnTxt}>{w.txt}</Text>
                </View>
              ))}
            </SectionCard>
          )}

          <SectionCard title="📦 SPEC This Month" color="#6A1B9A">
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Chicken" value={`${Math.round(chickenKg)}kg`} color="#D32F2F" bg="#FFEBEE" />
              <StatCard label="Lamb" value={`${Math.round(lambKg)}kg`} color="#E65100" bg="#FFF3E0" />
              <StatCard label="Orders" value={String(spec.filter(o => o.date >= from && o.date <= to).length)} color="#6A1B9A" bg="#F3E5F5" />
            </View>
            {foodCostPct && (
              <View style={[s.infoBox, { backgroundColor: parseFloat(foodCostPct) > 15 ? '#FFEBEE' : '#F3E5F5' }]}>
                <Text style={[s.infoTxt, { color: parseFloat(foodCostPct) > 15 ? COLORS.danger : '#6A1B9A' }]}>
                  📊 Estimated food cost: {foodCostPct}% of revenue {parseFloat(foodCostPct) > 15 ? '⚠️' : '✅'}
                </Text>
              </View>
            )}
          </SectionCard>

          <SectionCard title="👨‍🍳 Hours Efficiency" color="#1565C0">
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Total Hours" value={`${totalHours}h`} color="#1565C0" bg="#E3F2FD" />
              <StatCard label="Rev / Hour" value={`${fmtK(revPerHr)} PLN`} color="#1565C0" bg="#E3F2FD" />
              <StatCard label="Avg / Day" value={`${fmtK(avgDay)} PLN`} color="#555" bg="#F5F5F5" />
            </View>
            <View style={s.hoursBar}>
              {last7Hours.map((d, i) => {
                const h = maxHrs > 0 ? Math.max(4, (d.hrs / maxHrs) * 70) : 4;
                return (
                  <View key={i} style={s.hourCol}>
                    <Text style={s.hourVal}>{d.hrs > 0 ? d.hrs : ''}</Text>
                    <View style={[s.hourBar, { height: h, backgroundColor: d.hrs > 0 ? '#1565C0' : '#EEE' }]} />
                    <Text style={s.hourDay}>{d.day}</Text>
                  </View>
                );
              })}
            </View>
          </SectionCard>

        </>)}

        {/* ══ DAILY ════════════════════════════════════════════ */}
        {tab === 'Daily' && (<>
          <View style={s.listHeader}>
            <Text style={s.listHeaderTxt}>📋 {drAll.length} reports · last 3 months</Text>
          </View>
          {drAll.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No daily reports found</Text></View>
            : [...drAll].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
              const rv = r.total_revenue || r.revenue || 0;
              const hrs = r.total_hours || r.hours || 0;
              const delivTotal = DELIVERY_KEYS.reduce((d, k) => d + (r[k] || 0), 0);
              const dPct = rv > 0 ? Math.round(delivTotal / rv * 100) : 0;
              const key = `dr_${r.id || r.date}`;
              return (
                <View key={key} style={[s.recCard, r.date >= from && { borderLeftColor: COLORS.primary }]}>
                  <TouchableOpacity onPress={() => toggle(key)} activeOpacity={0.7}>
                    <View style={s.recHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={s.recDate}>{r.date} <Text style={s.recDay}>{dayName(r.date)}</Text></Text>
                          <Text style={s.recRev}>{fmtK(rv)} PLN</Text>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 3 }}>
                          <Text style={s.recMeta}>⏱ {hrs}h</Text>
                          {delivTotal > 0 && <Text style={s.recMeta}>🛵 {dPct}%</Text>}
                          {r.date < from && <Text style={[s.recMeta, { color: '#aaa' }]}>prev. month</Text>}
                        </View>
                      </View>
                      <View style={s.recActions}>
                        <TouchableOpacity onPress={() => openEditDR(r)} style={s.editBtn}><Text style={{ fontSize: 14 }}>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete('dr', r.id)} style={s.delBtn}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {expanded[key] && (
                    <View style={s.expandBody}>
                      {DELIVERY_KEYS.map(k => r[k] > 0 && (
                        <View key={k} style={s.detailRow}>
                          <Text style={s.detailLbl}>{DELIVERY_LABELS[k]}</Text>
                          <Text style={s.detailVal}>{fmtK(r[k])} PLN</Text>
                        </View>
                      ))}
                      {(r.card || r.karta) > 0 && <View style={s.detailRow}><Text style={s.detailLbl}>Card</Text><Text style={s.detailVal}>{fmtK(r.card || r.karta)} PLN</Text></View>}
                      {(r.cash || r.gotowka) > 0 && <View style={s.detailRow}><Text style={s.detailLbl}>Cash</Text><Text style={s.detailVal}>{fmtK(r.cash || r.gotowka)} PLN</Text></View>}
                      {r.notes ? <Text style={s.notesTxt}>📝 {r.notes}</Text> : null}
                    </View>
                  )}
                </View>
              );
            })
          }
        </>)}

        {/* ══ CASH ═════════════════════════════════════════════ */}
        {tab === 'Cash' && (<>
          <View style={s.listHeader}>
            <Text style={s.listHeaderTxt}>💰 {cfAll.length} reports · last 3 months</Text>
          </View>
          {cfAll.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No cash flow reports found</Text></View>
            : [...cfAll].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
              const exps = Array.isArray(r.expenses) ? r.expenses : [];
              const key = `cf_${r.id || r.date}`;
              return (
                <View key={key} style={[s.recCard, { borderLeftColor: '#D32F2F' }]}>
                  <TouchableOpacity onPress={() => toggle(key)} activeOpacity={0.7}>
                    <View style={s.recHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={s.recDate}>{r.date} <Text style={s.recDay}>{dayName(r.date)}</Text></Text>
                          <Text style={[s.recRev, { color: '#D32F2F' }]}>{fmtK(r.total_expenses || 0)} PLN</Text>
                        </View>
                        <Text style={s.recMeta}>{exps.length} categories</Text>
                      </View>
                      <View style={s.recActions}>
                        <TouchableOpacity onPress={() => openEditCF(r)} style={s.editBtn}><Text style={{ fontSize: 14 }}>✏️</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => confirmDelete('cf', r.id)} style={s.delBtn}><Text style={{ fontSize: 14 }}>🗑️</Text></TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                  {expanded[key] && (
                    <View style={s.expandBody}>
                      {exps.map((e, i) => (
                        <View key={i} style={s.detailRow}>
                          <Text style={s.detailLbl}>{e.name || e.kategoria}</Text>
                          <Text style={[s.detailVal, { color: '#D32F2F' }]}>{fmtK(e.amount || e.kwota)} PLN</Text>
                        </View>
                      ))}
                      {r.notes ? <Text style={s.notesTxt}>📝 {r.notes}</Text> : null}
                    </View>
                  )}
                </View>
              );
            })
          }
        </>)}

        {/* ══ SPEC ═════════════════════════════════════════════ */}
        {tab === 'SPEC' && (<>
          <View style={s.listHeader}>
            <Text style={s.listHeaderTxt}>📦 {spec.length} orders total</Text>
          </View>
          {spec.length === 0
            ? <View style={s.empty}><Text style={s.emptyTxt}>No SPEC orders found</Text></View>
            : [...spec].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((o, idx) => {
              const items = extractItems(o.items);
              const totalKg = items.reduce((s, it) => {
                const qty = parseFloat(it.qty || 0);
                return s + (it.totalKg || qty * parseUnitKg(it.unit) || qty);
              }, 0);
              const key = `sp_${o.id || idx}`;
              return (
                <View key={key} style={[s.recCard, { borderLeftColor: '#6A1B9A' }]}>
                  <TouchableOpacity onPress={() => toggle(key)} activeOpacity={0.7}>
                    <View style={s.recHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={s.recDate}>{o.date} <Text style={s.recDay}>{o.date ? dayName(o.date) : ''}</Text></Text>
                          <Text style={[s.recRev, { color: '#6A1B9A' }]}>{Math.round(totalKg)}kg total</Text>
                        </View>
                        <Text style={s.recMeta}>{items.length} items · {o.note || 'no note'}</Text>
                      </View>
                      <Text style={s.chevron}>{expanded[key] ? '▲' : '▼'}</Text>
                    </View>
                  </TouchableOpacity>
                  {expanded[key] && (
                    <View style={s.expandBody}>
                      {items.map((it, i) => (
                        <View key={i} style={s.detailRow}>
                          <Text style={s.detailLbl}>{it.name}</Text>
                          <Text style={[s.detailVal, { color: '#6A1B9A' }]}>{it.qty} {it.unit || 'kg'}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })
          }
        </>)}

        {/* ══ RANK ═════════════════════════════════════════════ */}
        {tab === 'Rank' && (<>

          <SectionCard title="Your Position" color={COLORS.primary}>
            <View style={s.rankBig}>
              <Text style={s.rankNumber}>#{myRank}</Text>
              <Text style={s.rankOf}>out of {sorted.length} branches</Text>
              <Text style={[s.rankRev, { color: COLORS.primary }]}>{fmtK(rev)} PLN this month</Text>
            </View>
            <View style={{ flexDirection: 'row', marginTop: 8 }}>
              <StatCard label="Chain Avg" value={`${fmtK(chainAvg)} PLN`} color="#555" bg="#F5F5F5" />
              <StatCard label="vs Avg" value={rev > 0 ? `${rev > chainAvg ? '+' : ''}${Math.round((rev - chainAvg) / chainAvg * 100)}%` : '—'}
                color={rev >= chainAvg ? COLORS.primary : COLORS.danger}
                bg={rev >= chainAvg ? '#E8F5E9' : '#FFEBEE'} />
              <StatCard label="vs Last Mo" value={revArrow} color={arrowColor} bg="#F5F5F5" />
            </View>
          </SectionCard>

          <SectionCard title="🏆 Chain Leaderboard" color="#E65100">
            {sorted.slice(0, 10).map(([b, v], i) => {
              const isMe = b === branch;
              const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
              return (
                <View key={b} style={[s.rankRow, isMe && s.rankRowMe]}>
                  <Text style={s.rankPos}>{medal || `#${i + 1}`}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.rankBranchName, isMe && { color: COLORS.primary }]}>{b}{isMe ? ' ← You' : ''}</Text>
                    <View style={s.rankBarWrap}>
                      <View style={[s.rankBarFill, { width: `${Math.round(v / (sorted[0]?.[1] || 1) * 100)}%`, backgroundColor: isMe ? COLORS.primary : '#E0E0E0' }]} />
                    </View>
                  </View>
                  <Text style={[s.rankVal, isMe && { color: COLORS.primary }]}>{fmtK(v)}</Text>
                </View>
              );
            })}
          </SectionCard>

        </>)}

        {/* ══ STAFF ════════════════════════════════════════════ */}
        {tab === 'Staff' && (<>

          <SectionCard title="👨‍🍳 Staff Overview" color="#1B5E20">
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Total Hours" value={`${totalHours}h`} color="#1B5E20" bg="#E8F5E9" />
              <StatCard label="Est. Salary" value={`${fmtK(totalHours * 22)} PLN`} color="#D32F2F" bg="#FFEBEE" />
              <StatCard label="Avg/Day" value={`${dr.length > 0 ? Math.round(totalHours / dr.length) : 0}h`} color="#555" bg="#F5F5F5" />
            </View>
            <View style={[s.infoBox, { marginTop: 10 }]}>
              <Text style={s.infoTxt}>💡 Estimated at 22 PLN/hr · {dr.length} working days this month</Text>
            </View>
          </SectionCard>

          <SectionCard title="📈 Labor Efficiency" color="#1565C0">
            <View style={{ flexDirection: 'row' }}>
              <StatCard label="Rev / Hour" value={`${fmtK(revPerHr)} PLN`} color="#1565C0" bg="#E3F2FD" />
              <StatCard label="Labor % Rev"
                value={totalHours > 0 && rev > 0 ? `${Math.round(totalHours * 22 / rev * 100)}%` : '—'}
                color={totalHours > 0 && rev > 0 && (totalHours * 22 / rev) > 0.25 ? COLORS.danger : '#1565C0'}
                bg={totalHours > 0 && rev > 0 && (totalHours * 22 / rev) > 0.25 ? '#FFEBEE' : '#E3F2FD'} />
            </View>
          </SectionCard>

          <SectionCard title="📅 Daily Hours This Month" color="#1565C0">
            {dr.length === 0
              ? <Text style={s.emptyTxt}>No reports yet this month</Text>
              : [...dr].sort((a, b) => b.date.localeCompare(a.date)).map(r => {
                const h = r.total_hours || r.hours || 0;
                const v = r.total_revenue || r.revenue || 0;
                return (
                  <View key={r.date} style={s.staffRow}>
                    <Text style={s.staffDate}>{r.date}</Text>
                    <View style={s.staffBarWrap}><View style={[s.staffBar, { width: `${Math.min(100, h / 12 * 100)}%` }]} /></View>
                    <Text style={s.staffHrs}>{h}h</Text>
                    <Text style={s.staffRev}>{fmtK(v)}</Text>
                  </View>
                );
              })
            }
          </SectionCard>

        </>)}

      </ScrollView>

      {/* ══ EDIT MODAL ════════════════════════════════════════ */}
      <Modal visible={!!editModal} transparent animationType="slide" onRequestClose={() => setEditModal(null)}>
        <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalBox}>
            <Text style={s.modalTitle}>{editModal?.type === 'dr' ? '✏️ Edit Daily Report' : '✏️ Edit Cash Flow'}</Text>
            <Text style={s.modalDate}>{editModal?.record?.date}</Text>
            <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
              {editModal && Object.entries(editModal.fields).map(([key, val]) => (
                <View key={key} style={s.fieldRow}>
                  <Text style={s.fieldLabel}>{key.replace(/^exp_/, '').replace(/_/g, ' ').toUpperCase()}</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={val}
                    onChangeText={v => setEditModal(prev => ({ ...prev, fields: { ...prev.fields, [key]: v } }))}
                    keyboardType="numeric"
                    placeholder="0"
                    selectTextOnFocus
                  />
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#F0F0F0' }]} onPress={() => setEditModal(null)} activeOpacity={0.7}>
                <Text style={{ color: '#555', fontWeight: '700', fontSize: 14 }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, { backgroundColor: COLORS.primary, flex: 1 }]} onPress={saveEdit} disabled={saving} activeOpacity={0.8}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{saving ? 'Saving…' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

/* ─── styles ───────────────────────────────────────────────── */
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  headerTitle: { fontSize: 17, fontWeight: '900', color: '#222' },
  headerSub: { fontSize: 11, color: '#aaa', marginTop: 2 },
  rankBadge: { borderRadius: 10, padding: 8, alignItems: 'center', minWidth: 52 },
  rankTxt: { fontSize: 18, fontWeight: '900' },
  rankLbl: { fontSize: 9, color: '#aaa', marginTop: 1 },
  content: { padding: 14, paddingBottom: 30 },
  infoBox: { marginTop: 10, backgroundColor: '#F0FFF4', borderRadius: 8, padding: 10 },
  infoTxt: { fontSize: 12, color: '#2E7D32', fontWeight: '700' },
  barWrap: { height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  warnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  warnTxt: { flex: 1, fontSize: 12, color: '#555', lineHeight: 18 },
  hoursBar: { flexDirection: 'row', alignItems: 'flex-end', height: 100, marginTop: 12, gap: 4 },
  hourCol: { flex: 1, alignItems: 'center', gap: 2 },
  hourBar: { width: '80%', borderRadius: 3, minHeight: 4 },
  hourVal: { fontSize: 9, color: '#888' },
  hourDay: { fontSize: 9, color: '#aaa', marginTop: 2 },
  // list tabs
  listHeader: { paddingVertical: 8, paddingHorizontal: 2, marginBottom: 4 },
  listHeaderTxt: { fontSize: 12, color: '#888', fontWeight: '700' },
  empty: { padding: 40, alignItems: 'center' },
  emptyTxt: { color: '#aaa', fontSize: 13, textAlign: 'center' },
  recCard: { backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: '#EEE', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  recHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recDate: { fontSize: 13, fontWeight: '800', color: '#222' },
  recDay: { fontSize: 11, color: '#999', fontWeight: '600' },
  recRev: { fontSize: 14, fontWeight: '900', color: COLORS.primary },
  recMeta: { fontSize: 11, color: '#999' },
  recActions: { flexDirection: 'row', gap: 5 },
  editBtn: { padding: 6, backgroundColor: '#E3F2FD', borderRadius: 8 },
  delBtn: { padding: 6, backgroundColor: '#FFEBEE', borderRadius: 8 },
  expandBody: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  detailLbl: { fontSize: 12, color: '#888' },
  detailVal: { fontSize: 12, fontWeight: '700', color: '#333' },
  notesTxt: { fontSize: 12, color: '#aaa', marginTop: 6, fontStyle: 'italic' },
  chevron: { fontSize: 12, color: '#bbb', paddingTop: 2 },
  // rank
  rankBig: { alignItems: 'center', paddingVertical: 12 },
  rankNumber: { fontSize: 52, fontWeight: '900', color: COLORS.primary },
  rankOf: { fontSize: 13, color: '#888', marginTop: 2 },
  rankRev: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  rankRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rankRowMe: { backgroundColor: '#E8F5E9', borderRadius: 8, paddingHorizontal: 6 },
  rankPos: { fontSize: 16, width: 30 },
  rankBranchName: { fontSize: 12, fontWeight: '700', color: '#333' },
  rankBarWrap: { height: 4, backgroundColor: '#EEE', borderRadius: 2, marginTop: 3, overflow: 'hidden' },
  rankBarFill: { height: 4, borderRadius: 2 },
  rankVal: { fontSize: 12, fontWeight: '800', color: '#555', width: 50, textAlign: 'right' },
  // staff
  staffRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  staffDate: { fontSize: 11, color: '#888', width: 82 },
  staffBarWrap: { flex: 1, height: 8, backgroundColor: '#EEE', borderRadius: 4, overflow: 'hidden' },
  staffBar: { height: 8, backgroundColor: '#1565C0', borderRadius: 4 },
  staffHrs: { fontSize: 12, fontWeight: '700', color: '#333', width: 28, textAlign: 'right' },
  staffRev: { fontSize: 11, color: COLORS.primary, fontWeight: '700', width: 45, textAlign: 'right' },
  // edit modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 36 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#222', marginBottom: 3 },
  modalDate: { fontSize: 12, color: '#888', marginBottom: 14 },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  fieldLabel: { flex: 1, fontSize: 11, fontWeight: '700', color: '#555' },
  fieldInput: { borderWidth: 1, borderColor: '#E0E0E0', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7, minWidth: 110, fontSize: 14, textAlign: 'right', color: '#222' },
  modalBtn: { borderRadius: 12, padding: 14, alignItems: 'center', justifyContent: 'center' },
});
