import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Banner, Header, StatusPill, T } from '../components/ui';
import { cachedProducts, loadBranchNames, loadDayOrders, loadProducts, setOrderStatus, setSupplierMessage } from '../lib/api';
import { askShare, dayDocument, dayTotals, groupLines, orderDocument } from '../lib/documents';
import { fmtDay, fmtPln, itemQtyLabel, normalizeItems, orderCost, statusOf, todayStr } from '../lib/logic';

function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function time(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/* SPEC supplier view: every branch's order for a day, picking totals,
   Confirm / Delivered, a message back to the branch, and PDF / text sharing. */
export default function SupplierScreen() {
  const { logout } = useAuth();
  const [date, setDate] = useState(todayStr());
  const [view, setView] = useState('branches');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [branchNames, setBranchNames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async (d = date) => {
    try {
      const [o, p, b] = await Promise.all([
        loadDayOrders(d),
        loadProducts().catch(() => cachedProducts()),
        loadBranchNames(),
      ]);
      setOrders(o);
      setProducts(p);
      setBranchNames(b);
      setOffline(false);
    } catch {
      setOffline(true);
    }
    setLoading(false);
    setRefreshing(false);
  }, [date]);

  useEffect(() => { setLoading(true); setOpen(null); load(date); }, [date]);
  // New orders arrive during the afternoon: refresh every minute and when the app is reopened.
  useEffect(() => {
    const timer = setInterval(() => load(), 60000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [load]);

  const missing = useMemo(() => {
    const ordered = new Set(orders.map(o => o.branch));
    return branchNames.filter(b => !ordered.has(b));
  }, [orders, branchNames]);
  const pending = orders.filter(o => statusOf(o) === 'pending');
  const totals = useMemo(() => dayTotals(orders, products), [orders, products]);

  function replace(updated) {
    setOrders(list => list.map(o => (o.branch === updated.branch && o.date === updated.date ? { ...o, ...updated } : o)));
  }

  async function changeStatus(order, status) {
    setBusy(`${order.branch}:${status}`);
    try { replace(await setOrderStatus(order, status)); }
    catch (e) { Alert.alert('Not saved', e.message || 'Check the internet and try again.'); }
    setBusy(null);
  }

  function confirmAll() {
    Alert.alert('Confirm all orders?', `${pending.length} order${pending.length > 1 ? 's' : ''} will be confirmed. Branches can no longer change them.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm all',
        onPress: async () => {
          setBusy('all');
          for (const o of pending) {
            try { replace(await setOrderStatus(o, 'confirmed')); } catch {}
          }
          setBusy(null);
        },
      },
    ]);
  }

  const isToday = date === todayStr();

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header
        title="Branch orders"
        subtitle="SPEC supplier"
        right={<TouchableOpacity onPress={logout} hitSlop={10}><Text style={st.logout}>Log out</Text></TouchableOpacity>}
      />
      <View style={st.dateBar}>
        <TouchableOpacity style={st.dateBtn} onPress={() => setDate(d => shiftDate(d, -1))} accessibilityLabel="Previous day"><Text style={st.dateArrow}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={st.dateMid} onPress={() => setDate(todayStr())}>
          <Text style={st.dateText}>{isToday ? 'Today · ' : ''}{fmtDay(date)}</Text>
          {!isToday && <Text style={st.dateHint}>Tap for today</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={st.dateBtn} onPress={() => setDate(d => shiftDate(d, 1))} accessibilityLabel="Next day"><Text style={st.dateArrow}>›</Text></TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} colors={[T.orange]} />}
      >
        {offline && <Banner tone="muted" title="No internet" text="Pull down to try again." />}
        {loading ? <ActivityIndicator color={T.orange} size="large" style={{ marginTop: 40 }} /> : (
          <>
            <View style={st.stats}>
              <Stat value={orders.length} label="ordered" />
              <Stat value={pending.length} label="to confirm" tone={pending.length ? T.orangeDark : T.inkSoft} />
              <Stat value={missing.length} label="not ordered" tone={missing.length ? T.danger : T.inkSoft} />
            </View>

            {orders.length > 0 && (
              <View style={st.actions}>
                <TouchableOpacity style={st.shareDay} onPress={() => askShare('Share all orders', () => dayDocument(date, orders, products, missing))}>
                  <Text style={st.shareDayText}>⇪ Share day (PDF / text)</Text>
                </TouchableOpacity>
                {pending.length > 0 && (
                  <TouchableOpacity style={st.confirmAll} onPress={confirmAll} disabled={busy === 'all'}>
                    {busy === 'all' ? <ActivityIndicator color="#fff" /> : <Text style={st.confirmAllText}>Confirm all {pending.length}</Text>}
                  </TouchableOpacity>
                )}
              </View>
            )}

            {missing.length > 0 && isToday && (
              <Banner tone="warn" title={`Not ordered yet: ${missing.length}`} text={missing.join(' · ')} />
            )}

            <View style={st.segment}>
              {[['branches', 'By branch'], ['totals', 'Picking totals']].map(([k, label]) => (
                <TouchableOpacity key={k} style={[st.segBtn, view === k && st.segOn]} onPress={() => setView(k)}>
                  <Text style={[st.segText, view === k && st.segTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {orders.length === 0 && <Banner tone="muted" title="No orders for this day" text="Orders appear here as soon as a branch sends them." />}

            {view === 'branches' ? orders.map(o => (
              <OrderCard
                key={o.branch}
                order={o}
                products={products}
                open={open === o.branch}
                onToggle={() => setOpen(open === o.branch ? null : o.branch)}
                busy={busy}
                onStatus={changeStatus}
                onMessage={async text => {
                  try { replace(await setSupplierMessage(o, text)); Alert.alert('Sent', `${o.branch} will see your message in the app.`); }
                  catch (e) { Alert.alert('Not sent', e.message || 'Try again.'); }
                }}
              />
            )) : totals.map(g => (
              <View key={g.cat} style={st.card}>
                <Text style={st.cat}>{g.cat}</Text>
                {g.rows.map(r => (
                  <View key={`${r.name}-${r.unit}`} style={st.totalRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.lineName}>{r.name}</Text>
                      <Text style={st.who}>{r.branches.join(' · ')}</Text>
                    </View>
                    <Text style={st.lineQty}>{itemQtyLabel(r)}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function OrderCard({ order, products, open, onToggle, busy, onStatus, onMessage }) {
  const status = statusOf(order);
  const [message, setMessage] = useState(order.manager_notification || '');
  useEffect(() => { setMessage(order.manager_notification || ''); }, [order.manager_notification]);
  const lines = normalizeItems(order.items).length;
  const cost = orderCost(order, products);

  return (
    <View style={[st.card, { padding: 0 }, status === 'pending' && st.cardNew]}>
      <TouchableOpacity style={st.cardHead} onPress={onToggle} activeOpacity={0.7}>
        <View style={{ flex: 1 }}>
          <View style={st.row}>
            <Text style={st.branch}>{order.branch}</Text>
            {status === 'pending' && <View style={st.newTag}><Text style={st.newTagText}>NEW</Text></View>}
          </View>
          <Text style={st.meta}>{lines} lines{cost ? ` · ≈ ${fmtPln(cost)}` : ''}{order.submitted_at ? ` · sent ${time(order.submitted_at)}` : ''}</Text>
        </View>
        <StatusPill status={status} label={status === 'pending' ? 'To confirm' : undefined} />
      </TouchableOpacity>

      {open && (
        <View style={st.body}>
          {groupLines(order, products).map(g => (
            <View key={g.cat}>
              <Text style={st.cat}>{g.cat}</Text>
              {g.lines.map((l, i) => (
                <View key={`${l.name}-${l.unit}-${i}`} style={st.line}>
                  <Text style={st.lineName}>{l.name}</Text>
                  <Text style={st.lineQty}>{itemQtyLabel(l)}</Text>
                </View>
              ))}
            </View>
          ))}
          {order.supplier_note ? <View style={st.note}><Text style={st.noteLabel}>Note from branch</Text><Text style={st.noteText}>{order.supplier_note}</Text></View> : null}

          <Text style={st.msgLabel}>Message to {order.branch}</Text>
          <View style={st.msgRow}>
            <TextInput
              style={st.msgInput}
              value={message}
              onChangeText={setMessage}
              placeholder="e.g. Pita 110 out of stock, sending Pita 85"
              placeholderTextColor={T.muted}
              multiline
            />
            <TouchableOpacity
              style={[st.msgSend, message.trim() === (order.manager_notification || '').trim() && { opacity: 0.4 }]}
              disabled={message.trim() === (order.manager_notification || '').trim()}
              onPress={() => onMessage(message)}
            >
              <Text style={st.msgSendText}>Send</Text>
            </TouchableOpacity>
          </View>

          <View style={st.buttons}>
            <TouchableOpacity style={st.shareBtn} onPress={() => askShare(`Share ${order.branch}`, () => orderDocument(order, products))}>
              <Text style={st.shareBtnText}>⇪ Share</Text>
            </TouchableOpacity>
            {status === 'pending' && (
              <TouchableOpacity style={[st.statusBtn, { backgroundColor: T.info }]} disabled={!!busy} onPress={() => onStatus(order, 'confirmed')}>
                {busy === `${order.branch}:confirmed` ? <ActivityIndicator color="#fff" /> : <Text style={st.statusText}>✓ Confirm</Text>}
              </TouchableOpacity>
            )}
            {(status === 'pending' || status === 'confirmed') && (
              <TouchableOpacity style={[st.statusBtn, { backgroundColor: T.brand }]} disabled={!!busy} onPress={() => onStatus(order, 'delivered')}>
                {busy === `${order.branch}:delivered` ? <ActivityIndicator color="#fff" /> : <Text style={st.statusText}>Delivered</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function Stat({ value, label, tone }) {
  return (
    <View style={st.stat}>
      <Text style={[st.statValue, tone && { color: tone }]}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  logout: { color: 'rgba(255,255,255,0.75)', fontWeight: '800' },
  dateBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line, paddingHorizontal: 8, paddingVertical: 6 },
  dateBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  dateArrow: { fontSize: 30, color: T.orangeDark, fontWeight: '700', marginTop: -4 },
  dateMid: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '900', color: T.ink },
  dateHint: { fontSize: 11, color: T.orangeDark, fontWeight: '700' },
  content: { padding: 14, gap: 10, backgroundColor: T.bg, flexGrow: 1, paddingBottom: 40 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: T.card, borderRadius: 12, borderWidth: 1, borderColor: T.line, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900', color: T.ink },
  statLabel: { fontSize: 12, color: T.muted, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', gap: 8 },
  shareDay: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: T.orange, backgroundColor: T.orangeSoft, paddingVertical: 13, alignItems: 'center' },
  shareDayText: { color: T.orangeDark, fontWeight: '900', fontSize: 14 },
  confirmAll: { borderRadius: 12, backgroundColor: T.info, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  confirmAllText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  segment: { flexDirection: 'row', backgroundColor: T.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: T.line },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 9 },
  segOn: { backgroundColor: T.navy },
  segText: { fontWeight: '800', color: T.inkSoft },
  segTextOn: { color: '#fff' },
  card: { backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.line, padding: 14, overflow: 'hidden' },
  cardNew: { borderLeftWidth: 5, borderLeftColor: T.orange },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  branch: { fontSize: 17, fontWeight: '900', color: T.ink },
  newTag: { backgroundColor: T.orange, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  newTagText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 13, color: T.inkSoft, marginTop: 3 },
  body: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: T.line },
  cat: { fontSize: 11, fontWeight: '900', color: T.orangeDark, letterSpacing: 1, textTransform: 'uppercase', marginTop: 12, marginBottom: 2 },
  line: { flexDirection: 'row', gap: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  lineName: { flex: 1, fontSize: 14, color: T.ink },
  lineQty: { fontSize: 14, fontWeight: '900', color: T.ink, textAlign: 'right' },
  who: { fontSize: 12, color: T.muted, marginTop: 2 },
  totalRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  note: { marginTop: 12, backgroundColor: T.orangeSoft, borderRadius: 10, padding: 10 },
  noteLabel: { fontSize: 11, fontWeight: '900', color: T.orangeDark, textTransform: 'uppercase', letterSpacing: 1 },
  noteText: { fontSize: 14, color: T.ink, marginTop: 2 },
  msgLabel: { fontSize: 12, fontWeight: '800', color: T.inkSoft, marginTop: 14, marginBottom: 6 },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgInput: { flex: 1, minHeight: 44, maxHeight: 100, borderWidth: 1, borderColor: T.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: T.ink, backgroundColor: '#FAFAFA' },
  msgSend: { backgroundColor: T.navy, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  msgSendText: { color: '#fff', fontWeight: '900' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 14 },
  shareBtn: { borderRadius: 10, borderWidth: 1.5, borderColor: T.orange, paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  shareBtnText: { color: T.orangeDark, fontWeight: '900' },
  statusBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
