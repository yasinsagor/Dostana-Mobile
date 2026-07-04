import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, TextInput, Alert, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { supabase, fetchAllDailyReports } from '../../lib/supabase';
import { COLORS, BRANCHES } from '../../constants';

/* ─── helpers ─────────────────────────────────────────────── */
function parseExp(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch { return []; } }
  if (!Array.isArray(arr)) {
    if (arr && typeof arr === 'object') {
      arr = Object.entries(arr).map(([k, v]) => ({ name: k, amount: Number(v) }));
    } else return [];
  }
  return arr.map(e => {
    const SKIP = new Set(['id','date','branch','created_at','amount','Amount','kwota','value','sum','total','category','cat']);
    let name = e.name || e.Name || e.kategoria || e.category || e.description || e.title || e.label || e.purpose || e.cel || '';
    if (!name) {
      const key = Object.keys(e).find(k => !SKIP.has(k));
      if (key) name = key;
    }
    let amount = Number(e.amount ?? e.Amount ?? e.kwota ?? e.value ?? e.sum ?? e.total ?? 0);
    if (!amount && name && !SKIP.has(name)) amount = Number(e[name]) || 0;
    return { name, amount, category: e.category || e.kategoria || e.cat || '' };
  });
}

function parseItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') { try { const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch {} }
  return [];
}
function expAmt(e) { return Number(e.amount ?? e.Amount ?? e.kwota ?? e.value ?? 0); }
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function fmtK(n) { if (!n && n !== 0) return '0'; return Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : Math.round(n).toString(); }
function fmtNum(n) { return (n || 0).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function dayName(iso) { return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(iso + 'T12:00:00').getDay()]; }
function fmtDate(iso) { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; }
function monthRange(off = 0) {
  const d = new Date(); d.setMonth(d.getMonth() - off);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(new Date(y, m, 0).getDate())}` };
}
function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function csvEsc(v) { const s = String(v ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g,'""')}"` : s; }
function csvRow(arr) { return arr.map(csvEsc).join(','); }

const DELIVERY_LABELS = { uber_eats: 'Uber Eats', glovo: 'Glovo', bolt: 'Bolt', pyszne: 'Pyszne' };
const DELIV_KEYS = ['uber_eats', 'glovo', 'bolt', 'pyszne'];

const DATE_PRESETS = [
  { label: 'Today',      getRange: () => ({ from: todayStr(), to: todayStr() }) },
  { label: 'Yesterday',  getRange: () => { const d = daysAgoStr(1); return { from: d, to: d }; } },
  { label: '7 Days',     getRange: () => ({ from: daysAgoStr(6), to: todayStr() }) },
  { label: 'This Month', getRange: () => monthRange(0) },
  { label: 'Last Month', getRange: () => monthRange(1) },
  { label: 'Custom',     getRange: null },
];

/* ─── Chip ────────────────────────────────────────────────── */
function Chip({ label, active, onPress, color }) {
  return (
    <TouchableOpacity style={[ch.chip, active && { backgroundColor: color || COLORS.primary, borderColor: color || COLORS.primary }]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[ch.txt, active && ch.active]}>{label}</Text>
    </TouchableOpacity>
  );
}
const ch = StyleSheet.create({
  chip:   { borderRadius: 20, borderWidth: 1.5, borderColor: '#DDD', backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 7, marginRight: 6 },
  txt:    { fontSize: 12, fontWeight: '700', color: '#666' },
  active: { color: '#fff' },
});

/* ─── Summary strip ───────────────────────────────────────── */
function SummaryStrip({ data }) {
  const rev    = data.reduce((s, r) => s + (r.total_revenue || r.revenue || 0), 0);
  const cash   = data.reduce((s, r) => s + (r.cash_revenue  || r.cash  || r.gotowka || 0), 0);
  const card   = data.reduce((s, r) => s + (r.card_revenue  || r.card  || r.karta   || 0), 0);
  const deliv  = data.reduce((s, r) => s + DELIV_KEYS.reduce((ds, k) => ds + (r[k] || 0), 0), 0);
  const hours  = data.reduce((s, r) => s + (r.working_hours || 0), 0);
  const days   = new Set(data.map(r => r.date)).size;
  const avgDay = days > 0 ? Math.round(rev / days) : 0;

  return (
    <View style={ss.card}>
      <View style={ss.row}>
        <Cell label="Revenue"  value={`${fmtK(rev)} PLN`}  color={COLORS.primary} />
        <Cell label="Cash"     value={`${fmtK(cash)} PLN`} color="#1565C0" />
        <Cell label="Card"     value={`${fmtK(card)} PLN`} color="#6A1B9A" />
        <Cell label="Delivery" value={`${fmtK(deliv)} PLN`} color="#E65100" />
      </View>
      <View style={[ss.row, { borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10, marginTop: 6 }]}>
        <Cell label="Total Hours" value={`${hours}h`}         color="#555" />
        <Cell label="Days"        value={String(days)}         color="#555" />
        <Cell label="Avg / Day"   value={`${fmtK(avgDay)} PLN`} color={COLORS.primary} />
        <Cell label="Reports"     value={String(data.length)}  color="#555" />
      </View>
    </View>
  );
}
function Cell({ label, value, color }) {
  return (
    <View style={ss.cell}>
      <Text style={[ss.val, color && { color }]}>{value}</Text>
      <Text style={ss.lbl}>{label}</Text>
    </View>
  );
}
const ss = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  row:  { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  val:  { fontSize: 14, fontWeight: '900', color: '#222' },
  lbl:  { fontSize: 10, color: '#aaa', marginTop: 2, fontWeight: '600', textAlign: 'center' },
});

function CashSummaryStrip({ cfData, drData }) {
  const totalExp = cfData.reduce((s, r) => s + (r.total_expenses || r.total || 0), 0);
  const totalInc = (drData || []).reduce((s, r) => s + (r.cash_revenue || r.cash || r.gotowka || 0), 0);
  const balance  = totalInc - totalExp;
  const days     = new Set(cfData.map(r => r.date)).size;
  const avgDay   = days > 0 ? Math.round(totalExp / days) : 0;

  return (
    <View style={csh.card}>
      {/* Top 3: Income / Expenses / Balance */}
      <View style={csh.topRow}>
        <View style={csh.bigCell}>
          <Text style={csh.bigLbl}>Total Income</Text>
          <Text style={[csh.bigVal, { color: COLORS.primary }]}>{fmtK(totalInc)} PLN</Text>
        </View>
        <View style={[csh.bigCell, csh.midCell]}>
          <Text style={csh.bigLbl}>Total Expenses</Text>
          <Text style={[csh.bigVal, { color: COLORS.danger }]}>{fmtK(totalExp)} PLN</Text>
        </View>
        <View style={csh.bigCell}>
          <Text style={csh.bigLbl}>Balance</Text>
          <Text style={[csh.bigVal, { color: balance >= 0 ? COLORS.primary : COLORS.danger }]}>
            {balance >= 0 ? '+' : ''}{fmtK(balance)} PLN
          </Text>
        </View>
      </View>
      {/* Bottom row */}
      <View style={csh.bottomRow}>
        <Cell label="Days"      value={String(days)}         color="#555" />
        <Cell label="Avg/Day"   value={`${fmtK(avgDay)} PLN`} color="#E65100" />
        <Cell label="Reports"   value={String(cfData.length)} color="#555" />
      </View>
    </View>
  );
}
const csh = StyleSheet.create({
  card:      { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  topRow:    { flexDirection: 'row', marginBottom: 12 },
  bigCell:   { flex: 1, alignItems: 'center' },
  midCell:   { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F0F0F0' },
  bigLbl:    { fontSize: 10, color: '#aaa', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  bigVal:    { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  bottomRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 10 },
});

/* ─── Daily card ──────────────────────────────────────────── */
function DailyCard({ record, showBranch }) {
  const [open, setOpen] = useState(false);
  const rev    = record.total_revenue || record.revenue || 0;
  const cash   = record.cash_revenue  || record.cash  || record.gotowka || 0;
  const card   = record.card_revenue  || record.card  || record.karta   || 0;
  const hours  = record.working_hours || 0;
  const profit = record.net_profit    || 0;
  const deliv  = DELIV_KEYS.reduce((s, k) => s + (record[k] || 0), 0);
  const revPerHr = hours > 0 ? Math.round(rev / hours) : 0;

  return (
    <View style={dc.card}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={dc.header}>
          <View style={{ flex: 1 }}>
            <View style={dc.topRow}>
              <Text style={dc.date}>{fmtDate(record.date)}</Text>
              <Text style={dc.day}>{dayName(record.date)}</Text>
              {showBranch && <Text style={dc.branchBadge}>{record.branch}</Text>}
            </View>
            <View style={dc.metaRow}>
              {hours > 0 && <Text style={dc.tag}>⏱ {hours}h</Text>}
              {profit !== 0 && (
                <Text style={[dc.tag, { color: profit >= 0 ? COLORS.primary : COLORS.danger, backgroundColor: profit >= 0 ? '#E8F5E9' : '#FFEBEE' }]}>
                  {profit >= 0 ? '↑' : '↓'}{fmtK(Math.abs(profit))} PLN
                </Text>
              )}
              {revPerHr > 0 && <Text style={dc.tag}>{fmtK(revPerHr)}/h</Text>}
            </View>
          </View>
          <View style={dc.rightCol}>
            <Text style={dc.rev}>{fmtK(rev)} PLN</Text>
            <Text style={dc.chevron}>{open ? '▲' : '▼'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {open && (
        <View style={dc.body}>
          <View style={dc.grid}>
            <MiniCell label="Cash"     value={`${fmtK(cash)} PLN`}  color="#1565C0" />
            <MiniCell label="Card"     value={`${fmtK(card)} PLN`}  color="#6A1B9A" />
            <MiniCell label="Delivery" value={`${fmtK(deliv)} PLN`} color="#E65100" />
            <MiniCell label="Hours"    value={`${hours}h`}           color="#555" />
          </View>
          {DELIV_KEYS.filter(k => record[k] > 0).map(k => (
            <View key={k} style={dc.detailRow}>
              <Text style={dc.detailLbl}>  · {DELIVERY_LABELS[k]}</Text>
              <Text style={dc.detailVal}>{fmtK(record[k])} PLN</Text>
            </View>
          ))}
          {record.note ? <View style={dc.noteBox}><Text style={dc.noteTxt}>📝 {record.note}</Text></View> : null}
        </View>
      )}
    </View>
  );
}
function MiniCell({ label, value, color }) {
  return (
    <View style={dc.miniCell}>
      <Text style={[dc.miniVal, color && { color }]}>{value}</Text>
      <Text style={dc.miniLbl}>{label}</Text>
    </View>
  );
}
const dc = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.primary, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  body:        { paddingHorizontal: 12, paddingBottom: 12 },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  date:        { fontSize: 14, fontWeight: '800', color: '#222' },
  day:         { fontSize: 12, color: '#aaa', fontWeight: '600' },
  branchBadge: { fontSize: 11, fontWeight: '700', color: COLORS.primary, backgroundColor: '#E8F5E9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  metaRow:     { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  tag:         { fontSize: 11, fontWeight: '700', color: '#888', backgroundColor: '#F5F5F5', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  rightCol:    { alignItems: 'flex-end', gap: 4 },
  rev:         { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  chevron:     { fontSize: 11, color: '#bbb' },
  body:        { paddingHorizontal: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#F5F5F5' },
  grid:        { flexDirection: 'row', paddingVertical: 10, gap: 4 },
  miniCell:    { flex: 1, alignItems: 'center' },
  miniVal:     { fontSize: 13, fontWeight: '800', color: '#222' },
  miniLbl:     { fontSize: 10, color: '#aaa', marginTop: 2 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#F9F9F9' },
  detailLbl:   { fontSize: 12, color: '#888' },
  detailVal:   { fontSize: 12, fontWeight: '700', color: '#555' },
  noteBox:     { backgroundColor: '#FFFDE7', borderRadius: 8, padding: 8, marginTop: 6 },
  noteTxt:     { fontSize: 12, color: '#795548', lineHeight: 17 },
});

/* ─── Cash card ───────────────────────────────────────────── */
function CashCard({ record, showBranch }) {
  const [open, setOpen] = useState(false);
  const total = record.total_expenses || record.total || 0;
  const exps  = parseExp(record.expenses);
  const catMap = {};
  exps.forEach(e => { const c = e.category || 'Other'; catMap[c] = (catMap[c] || 0) + (e.amount || 0); });

  return (
    <View style={cc.card}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <View style={cc.header}>
          <View style={{ flex: 1 }}>
            <View style={cc.topRow}>
              <Text style={cc.date}>{fmtDate(record.date)}</Text>
              <Text style={cc.day}>{dayName(record.date)}</Text>
              {showBranch && <Text style={cc.branchBadge}>{record.branch}</Text>}
            </View>
            <Text style={cc.meta}>{exps.length} expense{exps.length !== 1 ? 's' : ''}{Object.keys(catMap).length > 1 ? ` · ${Object.keys(catMap).join(', ')}` : ''}</Text>
          </View>
          <View style={cc.rightCol}>
            <Text style={cc.total}>{fmtK(total)} PLN</Text>
            <Text style={cc.chevron}>{open ? '▲' : '▼'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      {open && (
        <View style={dc.body}>
          {exps.length === 0
            ? <Text style={{ color: '#bbb', fontSize: 13, paddingTop: 8 }}>No expense detail</Text>
            : exps.map((e, i) => (
              <View key={i} style={[dc.detailRow, { borderTopWidth: i === 0 ? 1 : 0, borderTopColor: '#F5F5F5', paddingTop: i === 0 ? 10 : 0 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[dc.detailLbl, { fontWeight: '700', color: '#333' }]}>{e.name || 'Expense'}</Text>
                  {e.category ? <Text style={{ fontSize: 10, color: '#aaa' }}>{e.category}</Text> : null}
                </View>
                <Text style={[dc.detailVal, { color: COLORS.danger, fontSize: 13 }]}>{fmtK(e.amount || 0)} PLN</Text>
              </View>
            ))
          }
          {record.note ? <View style={dc.noteBox}><Text style={dc.noteTxt}>📝 {record.note}</Text></View> : null}
        </View>
      )}
    </View>
  );
}
const cc = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 12, marginBottom: 8, borderLeftWidth: 3, borderLeftColor: COLORS.danger, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 2 },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  topRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  date:        { fontSize: 14, fontWeight: '800', color: '#222' },
  day:         { fontSize: 12, color: '#aaa', fontWeight: '600' },
  branchBadge: { fontSize: 11, fontWeight: '700', color: COLORS.danger, backgroundColor: '#FFEBEE', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  meta:        { fontSize: 11, color: '#aaa', fontWeight: '600' },
  rightCol:    { alignItems: 'flex-end', gap: 4 },
  total:       { fontSize: 15, fontWeight: '900', color: COLORS.danger },
  chevron:     { fontSize: 11, color: '#bbb' },
});

/* ─── Branch aggregate ────────────────────────────────────── */
function BranchGroup({ branch, records, type }) {
  const [open, setOpen] = useState(false);
  const primary = type === 'daily' ? COLORS.primary : COLORS.danger;
  const totalVal = records.reduce((s, r) => s + (type === 'daily'
    ? (r.total_revenue || r.revenue || 0)
    : (r.total_expenses || r.total || 0)), 0);
  const totalHours = type === 'daily' ? records.reduce((s, r) => s + (r.working_hours || 0), 0) : 0;
  const days = new Set(records.map(r => r.date)).size;

  return (
    <View style={bg.wrap}>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.7} style={bg.header}>
        <View style={{ flex: 1 }}>
          <Text style={bg.name}>{branch}</Text>
          <View style={bg.meta}>
            <Text style={bg.metaTxt}>{days}d · {records.length} records</Text>
            {totalHours > 0 && <Text style={bg.metaTxt}>· {totalHours}h</Text>}
          </View>
        </View>
        <Text style={[bg.val, { color: primary }]}>{fmtK(totalVal)} PLN</Text>
        <Text style={bg.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open && (
        <View style={bg.inner}>
          {[...records].sort((a, b) => (b.date || '').localeCompare(a.date || '')).map((r, i) =>
            type === 'daily'
              ? <DailyCard key={i} record={r} showBranch={false} />
              : <CashCard  key={i} record={r} showBranch={false} />
          )}
        </View>
      )}
    </View>
  );
}
const bg = StyleSheet.create({
  wrap:    { backgroundColor: '#fff', borderRadius: 14, marginBottom: 8, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  header:  { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
  name:    { fontSize: 14, fontWeight: '800', color: '#222', marginBottom: 3 },
  meta:    { flexDirection: 'row', gap: 4 },
  metaTxt: { fontSize: 11, color: '#aaa', fontWeight: '600' },
  val:     { fontSize: 15, fontWeight: '900' },
  chevron: { fontSize: 12, color: '#bbb', marginLeft: 4 },
  inner:   { paddingHorizontal: 10, paddingBottom: 10 },
});

/* ─── Export helpers ──────────────────────────────────────── */
/* ── shared CSS ── */
const REPORT_CSS = `
  body{font-family:Arial,sans-serif;margin:30px;color:#222;font-size:12px}
  h1{color:#2E7D32;font-size:18px;margin-bottom:2px}
  .meta{color:#888;font-size:11px;margin-bottom:18px}
  h2{font-size:13px;margin:26px 0 8px;padding-bottom:4px;border-bottom:2px solid #2E7D32;color:#2E7D32}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  th{background:#2E7D32;color:#fff;padding:7px 9px;text-align:left;font-size:11px}
  td{padding:6px 9px;border-bottom:1px solid #EEEEEE;font-size:11px}
  tr:nth-child(even) td{background:#F9F9F9}
  .total-row td{background:#E8F5E9;font-weight:bold;font-size:12px}
  .total-row.red td{background:#FFEBEE;color:#C62828}
  .total-row.blue td{background:#E3F2FD;color:#1565C0;font-size:13px}
`;

function buildDailyCSV(drRecords, cfRecords) {
  const sorted = [...drRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const cfMap  = Object.fromEntries((cfRecords||[]).map(r=>[r.date,r]));
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const L = arr => arr.map(q).join(',');
  const rows = [L(['Date','Branch','Total Sale','Gotówka','Karta','Online','Wydatki'])];
  let tSale=0,tGot=0,tKar=0,tOnl=0,tWyd=0;
  sorted.forEach(r => {
    const sale = r.total_revenue||r.revenue||0;
    const got  = r.cash_revenue||r.cash||r.gotowka||0;
    const kar  = r.card_revenue||r.card||r.karta||0;
    const onl  = DELIV_KEYS.reduce((s,k)=>s+(r[k]||0),0);
    const cf   = cfMap[r.date];
    const wyd  = cf ? (cf.total_expenses||cf.total||0) : 0;
    tSale+=sale; tGot+=got; tKar+=kar; tOnl+=onl; tWyd+=wyd;
    rows.push(L([fmtDate(r.date), r.branch||'', sale, got, kar, onl, wyd]));
  });
  rows.push(L(['TOTAL','', tSale, tGot, tKar, tOnl, tWyd]));
  return rows.join('\n');
}

function buildHoursCSV(drRecords) {
  const sorted = [...drRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const L = arr => arr.map(q).join(',');
  const rows = [L(['Date','Branch','Daily Hours'])];
  let total = 0;
  sorted.forEach(r => {
    const h = r.working_hours || 0; total+=h;
    rows.push(L([fmtDate(r.date), r.branch||'', h]));
  });
  rows.push(L(['TOTAL','', total]));
  return rows.join('\n');
}

function buildCashCSV(cfRecords, drRecords) {
  const sorted = [...cfRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const drMap  = Object.fromEntries((drRecords||[]).map(r=>[r.date,r]));
  const q = v => `"${String(v??'').replace(/"/g,'""')}"`;
  const L = arr => arr.map(q).join(',');
  const rows = [L(['Date','Branch','Income','Purpose of Expenses','Amount'])];
  let tInc=0, tExp=0;
  sorted.forEach(r => {
    const inc  = drMap[r.date] ? (drMap[r.date].cash_revenue||drMap[r.date].cash||drMap[r.date].gotowka||0) : 0;
    const exps = parseExp(r.expenses);
    tInc += inc;
    if (exps.length === 0) {
      const tot = r.total_expenses||r.total||0; tExp+=tot;
      rows.push(L([fmtDate(r.date), r.branch||'', inc, '—', tot]));
    } else {
      exps.forEach((e,i) => {
        const amt = e.amount||0; tExp+=amt;
        rows.push(L([i===0?fmtDate(r.date):'', i===0?r.branch||'':'', i===0?inc:'', e.name||'', amt]));
      });
    }
  });
  rows.push('');
  rows.push(L(['Total Income','','',tInc,'']));
  rows.push(L(['Total Expenses','','',tExp,'']));
  rows.push(L(['Balance','','',(tInc-tExp),'']));
  return rows.join('\n');
}

function buildDailyHTML(drRecords, cfRecords, title) {
  const sorted = [...drRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const cfMap  = Object.fromEntries((cfRecords||[]).map(r=>[r.date,r]));
  let tSale=0,tGot=0,tKar=0,tOnl=0,tWyd=0,tHrs=0;

  const dailyRows = sorted.map(r => {
    const sale = r.total_revenue||r.revenue||0;
    const got  = r.cash_revenue||r.cash||r.gotowka||0;
    const kar  = r.card_revenue||r.card||r.karta||0;
    const onl  = DELIV_KEYS.reduce((s,k)=>s+(r[k]||0),0);
    const cf   = cfMap[r.date];
    const wyd  = cf ? (cf.total_expenses||cf.total||0) : 0;
    const hrs  = r.working_hours || 0;
    tSale+=sale; tGot+=got; tKar+=kar; tOnl+=onl; tWyd+=wyd; tHrs+=hrs;
    const br = (drRecords.length > 1 && new Set(drRecords.map(x=>x.branch)).size > 1) ? `<td>${r.branch||''}</td>` : '';
    return `<tr>${br}<td>${fmtDate(r.date)}</td><td>${fmtNum(sale)}</td><td>${fmtNum(got)}</td><td>${fmtNum(kar)}</td><td>${fmtNum(onl)}</td><td>${fmtNum(wyd)}</td></tr>`;
  }).join('');
  const multiBranch = new Set(drRecords.map(r=>r.branch)).size > 1;
  const branchTh = multiBranch ? '<th>Branch</th>' : '';
  const branchTotal = multiBranch ? '<td></td>' : '';

  const hoursRows = sorted.map(r => {
    const h = r.working_hours || 0;
    return `<tr><td>${fmtDate(r.date)}</td><td>${h}h</td></tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${REPORT_CSS}</style></head><body>
  <h1>📅 ${title}</h1>
  <div class="meta">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</div>
  <h2>Daily Report</h2>
  <table>
    <thead><tr>${branchTh}<th>Date</th><th>Total Sale</th><th>Gotówka</th><th>Karta</th><th>Online</th><th>Wydatki</th></tr></thead>
    <tbody>
      ${dailyRows}
      <tr class="total-row">${branchTotal}<td>TOTAL</td><td>${fmtNum(tSale)}</td><td>${fmtNum(tGot)}</td><td>${fmtNum(tKar)}</td><td>${fmtNum(tOnl)}</td><td>${fmtNum(tWyd)}</td></tr>
    </tbody>
  </table>
  <h2>Hours Report</h2>
  <table>
    <thead><tr><th>Date</th><th>Daily Hours</th></tr></thead>
    <tbody>
      ${hoursRows}
      <tr class="total-row"><td>TOTAL</td><td>${tHrs}h</td></tr>
    </tbody>
  </table>
  </body></html>`;
}

function buildCashHTML(cfRecords, drRecords, title) {
  const sorted = [...cfRecords].sort((a,b)=>a.date.localeCompare(b.date));
  const drMap  = Object.fromEntries((drRecords||[]).map(r=>[r.date,r]));
  let tInc=0, tExp=0;
  const multiBranch = new Set(cfRecords.map(r=>r.branch)).size > 1;
  const branchTh = multiBranch ? '<th>Branch</th>' : '';

  const cashRows = sorted.map(r => {
    const inc  = drMap[r.date] ? (drMap[r.date].cash_revenue||drMap[r.date].cash||drMap[r.date].gotowka||0) : 0;
    const exps = parseExp(r.expenses);
    tInc += inc;
    const branchTd = multiBranch ? `<td>${r.branch||''}</td>` : '';
    if (exps.length === 0) {
      const tot = r.total_expenses||r.total||0; tExp+=tot;
      return `<tr>${branchTd}<td>${fmtDate(r.date)}</td><td>${fmtNum(inc)}</td><td>—</td><td>${fmtNum(tot)}</td></tr>`;
    }
    return exps.map((e,i) => {
      const amt = e.amount||0; tExp+=amt;
      return `<tr>${i===0?branchTd:(multiBranch?'<td></td>':'')}<td>${i===0?fmtDate(r.date):''}</td><td>${i===0?fmtNum(inc):''}</td><td>${e.name||''}</td><td>${fmtNum(amt)}</td></tr>`;
    }).join('');
  }).join('');

  const bal = tInc - tExp;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${REPORT_CSS}</style></head><body>
  <h1>💰 ${title}</h1>
  <div class="meta">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</div>
  <h2>Cash Flow Report</h2>
  <table>
    <thead><tr>${branchTh}<th>Date</th><th>Income</th><th>Purpose of Expenses</th><th>Amount</th></tr></thead>
    <tbody>
      ${cashRows}
      <tr class="total-row"><td colspan="${multiBranch?4:3}">Total Income</td><td>${fmtNum(tInc)}</td></tr>
      <tr class="total-row red"><td colspan="${multiBranch?4:3}">Total Expenses</td><td>${fmtNum(tExp)}</td></tr>
      <tr class="total-row blue"><td colspan="${multiBranch?4:3}">Balance</td><td>${fmtNum(bal)}</td></tr>
    </tbody>
  </table>
  </body></html>`;
}

async function exportCSV(content, filename) {
  try {
    const path = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(path, content, { encoding: FileSystem.EncodingType.UTF8 });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } else {
      Alert.alert('Saved', `File saved to: ${path}`);
    }
  } catch (e) { Alert.alert('Error', e.message); }
}

async function exportPDF(html, title) {
  try {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title });
    } else {
      Alert.alert('PDF Ready', uri);
    }
  } catch (e) { Alert.alert('Error', e.message); }
}

async function exportText(content) {
  try { await Share.share({ message: content }); } catch (e) { Alert.alert('Error', e.message); }
}

/* ════════════════════════════════════════════════════════════ */
export default function OwnerReportsScreen() {
  const [tab, setTab]             = useState('Daily');
  const [preset, setPreset]       = useState('This Month');
  const [customFrom, setCustFrom] = useState('');
  const [customTo,   setCustTo]   = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [branch, setBranch]       = useState('All');
  const [search, setSearch]       = useState('');
  const [dailyData, setDailyData] = useState([]);
  const [cashData, setCashData]   = useState([]);
  const [specData, setSpecData]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);

  const getRange = useCallback(() => {
    if (preset === 'Custom') return { from: customFrom || daysAgoStr(30), to: customTo || todayStr() };
    const p = DATE_PRESETS.find(d => d.label === preset);
    return p ? p.getRange() : monthRange(0);
  }, [preset, customFrom, customTo]);

  const load = useCallback(async () => {
    const { from, to } = getRange();
    try {
      const [daily, spRes] = await Promise.all([
        fetchAllDailyReports(from, to),
        supabase.from('spec_orders').select('*').gte('date', from).lte('date', to).order('date', { ascending: false }),
      ]);
      setDailyData(daily || []);
      setCashData((daily || []).map(row => ({ ...row, expenses: row.cashflow_expenses || row.wydatki || [] })));
      setSpecData(spRes.data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [getRange]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  /* ── filter ── */
  const applyFilters = (records) => {
    let r = records;
    if (branch !== 'All') r = r.filter(x => x.branch === branch);
    if (search.trim()) r = r.filter(x => (x.branch || '').toLowerCase().includes(search.toLowerCase()));
    return r;
  };
  const filtDaily = applyFilters(dailyData);
  const filtCash  = applyFilters(cashData);
  const filtSpec  = applyFilters(specData);
  const activeData = tab === 'Cash Flow' ? filtCash : tab === 'SPEC' ? filtSpec : filtDaily;

  /* ── group by branch for "All" view ── */
  const groupByBranch = (records) => {
    const map = {};
    records.forEach(r => { if (!map[r.branch]) map[r.branch] = []; map[r.branch].push(r); });
    return Object.entries(map).sort((a, b) => {
      const va = a[1].reduce((s, r) => s + (r.total_revenue || r.revenue || r.total_expenses || r.total || 0), 0);
      const vb = b[1].reduce((s, r) => s + (r.total_revenue || r.revenue || r.total_expenses || r.total || 0), 0);
      return vb - va;
    });
  };

  /* ── export ── */
  const handleExport = async (format) => {
    if (activeData.length === 0) { Alert.alert('No data', 'Nothing to export for this filter.'); return; }
    setExporting(true);
    const label = `${tab} Report — ${preset}${branch !== 'All' ? ' · ' + branch : ''}`;
    const stamp = todayStr();
    try {
      if (format === 'pdf') {
        const html = tab === 'Daily' ? buildDailyHTML(filtDaily, filtCash, label)
          : tab === 'Cash Flow' ? buildCashHTML(filtCash, filtDaily, label)
          : tab === 'Hours' ? buildDailyHTML(filtDaily, [], label)
          : `<!doctype html><html><body><h1>${label}</h1><table border="1" cellspacing="0" cellpadding="6"><tr><th>Date</th><th>Branch</th><th>Items</th></tr>${filtSpec.map(order=>`<tr><td>${order.date||''}</td><td>${order.branch||''}</td><td>${parseItems(order.items).map(item=>`${item.name||''} × ${item.qty||0}`).join(', ')}</td></tr>`).join('')}</table></body></html>`;
        await exportPDF(html, label);
      } else if (format === 'csv') {
        let csv, fn;
        if (tab === 'Daily') {
          csv = buildDailyCSV(filtDaily, filtCash) + '\n\n' + buildHoursCSV(filtDaily);
          fn  = `dostana_daily_${stamp}.csv`;
        } else if (tab === 'Cash Flow') {
          csv = buildCashCSV(filtCash, filtDaily);
          fn  = `dostana_cashflow_${stamp}.csv`;
        } else if (tab === 'Hours') {
          csv = buildHoursCSV(filtDaily);
          fn = `dostana_hours_${stamp}.csv`;
        } else {
          csv = ['Date,Branch,Items', ...filtSpec.map(order => `"${order.date||''}","${order.branch||''}","${parseItems(order.items).map(item=>`${item.name||''} x ${item.qty||0}`).join('; ').replace(/"/g,'""')}"`)].join('\n');
          fn = `dostana_spec_${stamp}.csv`;
        }
        await exportCSV(csv, fn);
      } else {
        // plain text share
        let lines = [`*${label}*\nGenerated: ${new Date().toLocaleString('pl-PL')}\n`];
        if (tab === 'Daily') {
          const tSale = filtDaily.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
          const tGot  = filtDaily.reduce((s,r)=>s+(r.cash_revenue||r.cash||r.gotowka||0),0);
          const tKar  = filtDaily.reduce((s,r)=>s+(r.card_revenue||r.card||r.karta||0),0);
          const tOnl  = filtDaily.reduce((s,r)=>s+DELIV_KEYS.reduce((d,k)=>d+(r[k]||0),0),0);
          const tHrs  = filtDaily.reduce((s,r)=>s+(r.working_hours || 0),0);
          lines.push(`Total Sale: ${fmtNum(tSale)} PLN`);
          lines.push(`Gotówka: ${fmtNum(tGot)} PLN | Karta: ${fmtNum(tKar)} PLN | Online: ${fmtNum(tOnl)} PLN`);
          lines.push(`Total Hours: ${tHrs}h\n`);
          filtDaily.slice(0,50).forEach(r => {
            const s2 = r.total_revenue||r.revenue||0;
            lines.push(`${fmtDate(r.date)} ${r.branch||''}: ${fmtNum(s2)} PLN`);
          });
        } else if (tab === 'Cash Flow') {
          const tInc = filtDaily.reduce((s,r)=>s+(r.total_revenue||r.revenue||0),0);
          const tExp = filtCash.reduce((s,r)=>s+(r.total_expenses||r.total||0),0);
          lines.push(`Total Income: ${fmtNum(tInc)} PLN`);
          lines.push(`Total Expenses: ${fmtNum(tExp)} PLN`);
          lines.push(`Balance: ${fmtNum(tInc-tExp)} PLN\n`);
          filtCash.slice(0,50).forEach(r => {
            const tot = r.total_expenses||r.total||0;
            lines.push(`${fmtDate(r.date)} ${r.branch||''}: ${fmtNum(tot)} PLN`);
          });
        } else if (tab === 'Hours') {
          lines.push(`Total Hours: ${fmtNum(filtDaily.reduce((sum,row)=>sum+Number(row.working_hours||0),0))}h\n`);
          filtDaily.slice(0,50).forEach(row => lines.push(`${fmtDate(row.date)} ${row.branch||''}: ${fmtNum(Number(row.working_hours||0))}h`));
        } else {
          lines.push(`SPEC Orders: ${filtSpec.length}\n`);
          filtSpec.slice(0,50).forEach(order => lines.push(`${fmtDate(order.date)} ${order.branch||''}: ${parseItems(order.items).length} items`));
        }
        await exportText(lines.join('\n'));
      }
    } catch (e) { Alert.alert('Export Error', e.message); }
    setExporting(false);
  };

  const branchList = BRANCHES.map(b => b.name);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>📋 Reports</Text>
        <Text style={s.sub}>Daily · Cash Flow · Hours · SPEC</Text>
      </View>

      {/* Report type tabs */}
      <View style={s.typeTabs}>
        {['Daily', 'Cash Flow', 'Hours', 'SPEC'].map(t => (
          <TouchableOpacity key={t} style={[s.typeTab, tab === t && s.typeTabActive]} onPress={() => setTab(t)} activeOpacity={0.8}>
            <Text style={[s.typeTabTxt, tab === t && s.typeTabActive2]}>{t === 'Daily' ? '📅 Daily' : t === 'Cash Flow' ? '💰 Cash' : t === 'Hours' ? '⏱ Hours' : '📦 SPEC'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[COLORS.primary]} />}
        contentContainerStyle={s.content}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─ Sticky filters ─ */}
        <View style={s.filterArea}>
          {/* Date presets */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            {DATE_PRESETS.map(p => (
              <Chip key={p.label} label={p.label} active={preset === p.label} onPress={() => { setPreset(p.label); setShowCustom(p.label === 'Custom'); }} />
            ))}
          </ScrollView>

          {showCustom && (
            <View style={s.customRow}>
              <View style={s.customField}>
                <Text style={s.customLabel}>From</Text>
                <TextInput style={s.customInput} value={customFrom} onChangeText={setCustFrom} placeholder={daysAgoStr(30)} placeholderTextColor="#ccc" maxLength={10} />
              </View>
              <Text style={s.sep}>→</Text>
              <View style={s.customField}>
                <Text style={s.customLabel}>To</Text>
                <TextInput style={s.customInput} value={customTo} onChangeText={setCustTo} placeholder={todayStr()} placeholderTextColor="#ccc" maxLength={10} />
              </View>
            </View>
          )}

          {/* Branch filter */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
            <Chip label="All Branches" active={branch === 'All'} onPress={() => setBranch('All')} color="#1565C0" />
            {branchList.map(b => (
              <Chip key={b} label={b} active={branch === b} onPress={() => setBranch(b)} />
            ))}
          </ScrollView>

          {/* Search by branch name */}
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search branch name..."
              placeholderTextColor="#bbb"
              clearButtonMode="while-editing"
            />
          </View>

          {/* Export buttons */}
          <View style={s.exportRow}>
            <Text style={s.exportLabel}>Export:</Text>
            {[['📄 PDF', 'pdf'], ['📊 CSV', 'csv'], ['📤 Share', 'text']].map(([lbl, fmt]) => (
              <TouchableOpacity key={fmt} style={s.exportBtn} onPress={() => handleExport(fmt)} disabled={exporting} activeOpacity={0.75}>
                <Text style={s.exportBtnTxt}>{exporting ? '...' : lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ─ Content ─ */}
        {loading ? (
          <View style={s.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : tab === 'Daily' ? (
          <>
            {filtDaily.length > 0 && <SummaryStrip data={filtDaily} />}
            <Text style={s.countTxt}>
              {filtDaily.length} record{filtDaily.length !== 1 ? 's' : ''}
              {branch === 'All' ? ` · ${new Set(filtDaily.map(r => r.branch)).size} branches` : ` · ${branch}`}
            </Text>
            {filtDaily.length === 0
              ? <View style={s.empty}><Text style={s.emptyTxt}>No daily reports for this filter</Text></View>
              : branch === 'All' && !search.trim()
                ? groupByBranch(filtDaily).map(([br, recs]) => <BranchGroup key={br} branch={br} records={recs} type="daily" />)
                : filtDaily.map((r, i) => <DailyCard key={i} record={r} showBranch={branch === 'All'} />)
            }
          </>
        ) : tab === 'Hours' ? (
          <>
            <View style={s.summaryStrip}><View style={s.sumCell}><Text style={s.sumVal}>{fmtNum(filtDaily.reduce((sum,row)=>sum+Number(row.working_hours||0),0))}h</Text><Text style={s.sumLbl}>Total Hours</Text></View><View style={s.sumCell}><Text style={s.sumVal}>{new Set(filtDaily.flatMap(row => (Array.isArray(row.worker_hours) ? row.worker_hours : []).map(worker => worker.name).filter(Boolean))).size}</Text><Text style={s.sumLbl}>Staff</Text></View></View>
            <Text style={s.countTxt}>{filtDaily.length} daily hour records</Text>
            {filtDaily.length === 0 ? <View style={s.empty}><Text style={s.emptyTxt}>No hours for this filter</Text></View> : filtDaily.map((row,i) => <View key={row.id||i} style={s.reportCard}><View style={s.cardTop}><Text style={s.cardDate}>{fmtDate(row.date)}</Text><Text style={s.cardAmount}>{fmtNum(Number(row.working_hours||0))}h</Text></View><Text style={s.cardBranch}>{row.branch}</Text>{(Array.isArray(row.worker_hours)?row.worker_hours:[]).map((worker,index)=><Text key={index} style={s.cardMeta}>{worker.name}: {worker.hours}h</Text>)}</View>)}
          </>
        ) : tab === 'SPEC' ? (
          <>
            <Text style={s.countTxt}>{filtSpec.length} SPEC orders</Text>
            {filtSpec.length === 0 ? <View style={s.empty}><Text style={s.emptyTxt}>No SPEC orders for this filter</Text></View> : filtSpec.map((order,i) => { const items=parseItems(order.items); return <View key={order.id||i} style={s.reportCard}><View style={s.cardTop}><Text style={s.cardDate}>{fmtDate(order.date)}</Text><Text style={[s.cardAmount,{color:'#6A1B9A'}]}>{items.length} items</Text></View><Text style={s.cardBranch}>{order.branch}</Text><Text style={s.cardMeta}>{items.slice(0,6).map(item=>`${item.name} × ${item.qty||0}`).join(' · ')}</Text></View>; })}
          </>
        ) : (
          <>
            {filtCash.length > 0 && <CashSummaryStrip cfData={filtCash} drData={filtDaily} />}
            <Text style={s.countTxt}>
              {filtCash.length} record{filtCash.length !== 1 ? 's' : ''}
              {branch === 'All' ? ` · ${new Set(filtCash.map(r => r.branch)).size} branches` : ` · ${branch}`}
            </Text>
            {filtCash.length === 0
              ? <View style={s.empty}><Text style={s.emptyTxt}>No cash flow reports for this filter</Text></View>
              : branch === 'All' && !search.trim()
                ? groupByBranch(filtCash).map(([br, recs]) => <BranchGroup key={br} branch={br} records={recs} type="cash" />)
                : filtCash.map((r, i) => <CashCard key={i} record={r} showBranch={branch === 'All'} />)
            }
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F4F6F8' },
  header:        { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 16 },
  title:         { fontSize: 22, fontWeight: '900', color: '#fff' },
  sub:           { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  typeTabs:      { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE' },
  typeTab:       { flex: 1, paddingVertical: 13, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: 'transparent' },
  typeTabActive: { borderBottomColor: COLORS.primary },
  typeTabTxt:    { fontSize: 13, fontWeight: '700', color: '#444' },
  typeTabActive2:{ color: COLORS.primary },
  filterArea:    { backgroundColor: '#F4F6F8', paddingTop: 10, paddingBottom: 2, borderBottomWidth: 1, borderBottomColor: '#E0E0E0' },
  chipRow:       { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 8 },
  customRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  customField:   { flex: 1 },
  customLabel:   { fontSize: 10, color: '#aaa', fontWeight: '700', marginBottom: 3 },
  customInput:   { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, backgroundColor: '#fff', fontWeight: '700', color: '#222' },
  sep:           { fontSize: 16, color: '#aaa', marginTop: 14 },
  searchRow:     { paddingHorizontal: 14, paddingBottom: 8 },
  searchInput:   { borderWidth: 1.5, borderColor: '#DDD', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, backgroundColor: '#fff', color: '#222' },
  exportRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 8 },
  exportLabel:   { fontSize: 12, color: '#888', fontWeight: '700' },
  exportBtn:     { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  exportBtnTxt:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  content:       { padding: 14, paddingTop: 8 },
  center:        { paddingTop: 60, alignItems: 'center' },
  countTxt:      { fontSize: 12, color: '#888', fontWeight: '700', marginBottom: 8 },
  summaryStrip:  { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 12, marginBottom: 10, padding: 10 },
  sumCell:       { flex: 1, alignItems: 'center' },
  sumVal:        { fontSize: 18, fontWeight: '900', color: COLORS.primary },
  sumLbl:        { fontSize: 10, color: '#888', marginTop: 2 },
  reportCard:    { backgroundColor: '#fff', borderRadius: 12, padding: 13, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  cardTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate:      { fontSize: 14, fontWeight: '800', color: '#333' },
  cardAmount:    { fontSize: 15, fontWeight: '900', color: COLORS.primary },
  cardBranch:    { fontSize: 12, fontWeight: '700', color: '#666', marginTop: 4 },
  cardMeta:      { fontSize: 11, color: '#888', marginTop: 3, lineHeight: 16 },
  empty:         { paddingVertical: 40, alignItems: 'center' },
  emptyTxt:      { fontSize: 14, color: '#bbb' },
});
