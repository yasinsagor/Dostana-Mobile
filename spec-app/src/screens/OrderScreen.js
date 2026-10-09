import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpec } from '../store';
import { Banner, Button, Card, Header, ProductRow, StatusPill, T } from '../components/ui';
import {
  canEdit, categoryOf, fmtDay, fmtK, fmtPln, groupProducts, isSizedMeat, lineCost, meatSizes,
  normalizeItems, num, orderCost, previousQty, reviewWarnings, selectedProducts, statusOf, unitOptionFor,
} from '../lib/logic';
import { buildSearchIndex, searchProducts } from '../lib/search';

const ALL = 'All';
const SELECTED = '✓ Selected';

export default function OrderScreen({ navigation }) {
  const spec = useSpec();
  const { products, todayOrder, editing } = spec;
  const [step, setStep] = useState('build'); // build | review | done
  const [result, setResult] = useState(null);

  useEffect(() => { if (spec.reviewNonce) setStep('review'); }, [spec.reviewNonce]);

  if (spec.loading && !products.length) {
    return <SafeAreaView style={st.safe}><View style={st.center}><ActivityIndicator size="large" color={T.brand} /></View></SafeAreaView>;
  }
  if (!products.length) {
    return (
      <SafeAreaView style={st.safe} edges={['top']}>
        <Header title="Order" />
        <View style={st.center}><Text style={st.emptyTitle}>The product list could not be loaded</Text><Text style={st.emptyText}>Connect to the internet and pull down on Today to refresh.</Text></View>
      </SafeAreaView>
    );
  }
  if (step === 'done' && result) {
    return <DoneView result={result} onClose={() => { setResult(null); setStep('build'); navigation.navigate('Today'); }} />;
  }
  if (todayOrder && !editing) return <SentView onEdit={() => setStep('build')} />;
  if (step === 'review') return <ReviewView onBack={() => setStep('build')} onSent={r => { setResult(r); setStep('done'); }} />;
  return <BuildView onReview={() => setStep('review')} />;
}

/* ════ BUILD ════ */
function BuildView({ onReview }) {
  const spec = useSpec();
  const { products, lastOrder, cart, totals, editing, origin, usage } = spec;
  const [filter, setFilter] = useState(ALL);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState({});
  const index = useMemo(() => buildSearchIndex(products), [products]);
  const selected = selectedProducts(cart, products);
  const selectedIds = new Set(selected.map(p => p.id));
  const cats = useMemo(() => [...new Set(products.map(categoryOf))], [products]);
  const lastItems = lastOrder ? lastOrder.items : [];
  const rowProps = { cart, setQty: spec.setQty, setUnit: spec.setUnit, setSizes: spec.setSizes };

  const searching = query.trim().length > 0;
  const results = searching ? searchProducts(products, index, query, usage) : [];
  const groups = useMemo(() => {
    if (searching) return [];
    const list = products.filter(p =>
      filter === ALL ? true : filter === SELECTED ? selectedIds.has(p.id) : categoryOf(p) === filter);
    return groupProducts(list, usage);
  }, [products, filter, searching, usage, cart]);

  function addToNote() {
    const line = `+ ${query.trim()}`;
    spec.setNote(spec.note ? `${spec.note}\n${line}` : line);
    setQuery('');
    Alert.alert('Added to the note', `“${line.slice(2)}” will be sent to the supplier as a note with your order.`);
  }

  function confirmClear() {
    Alert.alert('Clear the order?', 'All quantities go back to zero.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: spec.clearCart },
    ]);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title={editing ? 'Edit today’s order' : 'New order'} subtitle="Step 1 of 2 · choose products" />
      <View style={st.toolbar}>
        <View style={st.search}>
          <Text style={st.searchIcon}>⌕</Text>
          <TextInput
            style={st.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search: frytki, majonez, gloves…"
            placeholderTextColor={T.muted}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searching ? <TouchableOpacity onPress={() => setQuery('')} hitSlop={10}><Text style={st.searchClear}>✕</Text></TouchableOpacity> : null}
        </View>
        {!searching && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips} keyboardShouldPersistTaps="handled">
            {[ALL, SELECTED, ...cats].map(c => {
              const on = filter === c;
              const n = c === SELECTED ? totals.count : c === ALL ? 0 : selected.filter(p => categoryOf(p) === c).length;
              return (
                <TouchableOpacity key={c} style={[st.chip, on && st.chipOn]} onPress={() => setFilter(c)}>
                  <Text style={[st.chipText, on && st.chipTextOn]}>{c}{n ? `  ${n}` : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ScrollView contentContainerStyle={st.listPad} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!searching && (
          <View style={st.banners}>
            {editing && <Banner tone="info" title="Editing today’s order" text="The supplier sees the change after you save it." action="Cancel" onAction={spec.cancelEdit} />}
            {!editing && origin?.kind === 'last' && <Banner tone="info" title={`Filled from your last order (${fmtDay(origin.date)})`} text="Change only what is different today." action="Clear" onAction={confirmClear} />}
            {!editing && origin?.kind === 'reorder' && <Banner tone="info" title={`Copied from ${fmtDay(origin.date)}`} text="Check today’s stock and adjust." action="Clear" onAction={confirmClear} />}
            {!editing && origin?.kind === 'ai' && <Banner tone="info" title="Prepared by the AI assistant" text="Check every quantity before sending." action="Clear" onAction={confirmClear} />}
            {!editing && !totals.count && lastOrder && (
              <Banner tone="ok" title="Start faster" text={`Copy your last order (${fmtDay(lastOrder.date)}) and adjust it.`} action="Copy"
                onAction={() => spec.loadItems(lastOrder.items, { kind: 'last', date: lastOrder.date })} />
            )}
          </View>
        )}

        {searching ? (
          <>
            <View style={st.group}>
              {results.length === 0
                ? <View style={st.noResult}><Text style={st.emptyTitle}>No product matches “{query.trim()}”</Text></View>
                : results.map(p => <ProductRow key={p.id} product={p} prev={previousQty(p, lastItems)} {...rowProps} />)}
            </View>
            <TouchableOpacity style={st.cantFind} onPress={addToNote}>
              <Text style={st.cantFindTitle}>Can’t find it?</Text>
              <Text style={st.cantFindText}>Add “{query.trim()}” to the note for the supplier</Text>
            </TouchableOpacity>
          </>
        ) : groups.length === 0 ? (
          <View style={st.noResult}><Text style={st.emptyTitle}>Nothing selected yet</Text><Text style={st.emptyText}>Tap + on a product to add it.</Text></View>
        ) : groups.map(g => {
          // In "All", show the products this branch usually orders; the rest fold away.
          const foldable = filter === ALL;
          const usual = g.items.filter(p => (usage[p.id] || 0) > 0 || selectedIds.has(p.id));
          const open = !foldable || expanded[g.cat] || usual.length === 0;
          const visible = open ? g.items : usual;
          const hidden = g.items.length - visible.length;
          return (
            <View key={g.cat} style={st.group}>
              <View style={st.groupHead}>
                <Text style={st.groupTitle}>{g.cat}</Text>
                <Text style={st.groupCount}>{g.items.filter(p => selectedIds.has(p.id)).length}/{g.items.length}</Text>
              </View>
              {visible.map(p => <ProductRow key={p.id} product={p} prev={previousQty(p, lastItems)} {...rowProps} />)}
              {hidden > 0 && (
                <TouchableOpacity style={st.more} onPress={() => setExpanded(e => ({ ...e, [g.cat]: true }))}>
                  <Text style={st.moreText}>Show {hidden} more in {g.cat}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        {!searching && totals.count > 0 && (
          <TouchableOpacity style={st.clear} onPress={confirmClear}><Text style={st.clearText}>Clear order</Text></TouchableOpacity>
        )}
      </ScrollView>

      <View style={st.footer}>
        <View style={{ flex: 1 }}>
          <Text style={st.footerBig}>≈ {fmtPln(totals.cost)}</Text>
          <Text style={st.footerSmall}>{totals.count} products{totals.meatKg ? ` · ${totals.meatKg} kg meat` : ''}</Text>
        </View>
        <TouchableOpacity style={[st.cta, !totals.count && { opacity: 0.4 }]} disabled={!totals.count} onPress={onReview}>
          <Text style={st.ctaText}>Review ›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ════ REVIEW ════ */
function ReviewView({ onBack, onSent }) {
  const spec = useSpec();
  const { products, lastOrder, cart, totals, editing } = spec;
  const [sending, setSending] = useState(false);
  const selected = selectedProducts(cart, products);
  const warnings = reviewWarnings(cart, products, lastOrder?.items);
  const groups = groupProducts(selected);

  async function send() {
    setSending(true);
    try {
      const r = await spec.send();
      onSent(r);
    } catch (e) {
      Alert.alert('Not sent', e.message || 'Please try again.');
      await spec.refresh();
    }
    setSending(false);
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title="Review & send" subtitle="Step 2 of 2" />
      <ScrollView contentContainerStyle={[st.listPad, { padding: 14, gap: 12 }]} keyboardShouldPersistTaps="handled">
        <View style={st.stats}>
          <Stat value={String(totals.count)} label="products" />
          <Stat value={`≈ ${fmtK(totals.cost)}`} label="PLN" />
          <Stat value={String(totals.meatKg)} label="kg meat" />
        </View>
        {warnings.map((w, i) => <Banner key={i} tone={w.tone || 'warn'} title={w.title} text={w.text} />)}
        {groups.map(g => (
          <Card key={g.cat} style={{ paddingVertical: 8 }}>
            <Text style={st.reviewCat}>{g.cat}</Text>
            {g.items.map(p => (
              <View key={p.id} style={st.line}>
                <Text style={st.lineName}>{p.name}</Text>
                <Text style={st.lineQty}>
                  {isSizedMeat(p)
                    ? meatSizes(p).filter(sz => num((cart.sizes[p.id] || {})[sz]) > 0).map(sz => `${cart.sizes[p.id][sz]}×${sz}`).join(' + ')
                    : `${num(cart.qty[p.id])} ${unitOptionFor(p, cart.unit[p.id]).label}`}
                </Text>
                <Text style={st.lineCost}>{lineCost(cart, p) ? fmtK(lineCost(cart, p)) : '–'}</Text>
              </View>
            ))}
          </Card>
        ))}
        <Card>
          <Text style={st.reviewCat}>Note to supplier</Text>
          <TextInput
            style={st.note}
            value={spec.note}
            onChangeText={spec.setNote}
            multiline
            placeholder="e.g. deliver before 11:00"
            placeholderTextColor={T.muted}
          />
        </Card>
      </ScrollView>
      <View style={st.footer}>
        <TouchableOpacity style={st.back} onPress={onBack} disabled={sending}><Text style={st.backText}>‹ Edit</Text></TouchableOpacity>
        <TouchableOpacity style={[st.cta, { flex: 1 }, sending && { opacity: 0.6 }]} onPress={send} disabled={sending}>
          {sending ? <ActivityIndicator color="#fff" /> : <Text style={st.ctaText}>{editing ? 'Save changes' : 'Send to supplier'}</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ════ ALREADY SENT TODAY ════ */
function SentView({ onEdit }) {
  const spec = useSpec();
  const { products, todayOrder } = spec;
  const status = statusOf(todayOrder);
  const items = normalizeItems(todayOrder.items);
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title="Today’s order" subtitle={fmtDay(todayOrder.date)} right={<StatusPill status={status} />} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 12, backgroundColor: T.bg, flexGrow: 1 }}>
        {status === 'queued' && <Banner tone="muted" title="Waiting for internet" text="This order is saved on the phone and is sent automatically." />}
        {todayOrder.manager_notification ? <Banner tone="info" title="Message from supplier" text={todayOrder.manager_notification} /> : null}
        <Card>
          <Text style={st.reviewCat}>{items.length} lines · ≈ {fmtPln(orderCost(todayOrder, products))}</Text>
          {items.map((it, i) => (
            <View key={`${it.name}-${it.unit}-${i}`} style={st.line}>
              <Text style={st.lineName}>{it.name}</Text>
              <Text style={st.lineQty}>{it.qty} × {it.unit}{it.totalKg ? ` (${it.totalKg} kg)` : ''}</Text>
            </View>
          ))}
          {todayOrder.supplier_note ? <Text style={st.noteShown}>Note: {todayOrder.supplier_note}</Text> : null}
        </Card>
        {canEdit(todayOrder)
          ? <Button title="Edit order" onPress={() => { spec.startEdit(); onEdit(); }} />
          : <Banner tone="info" title="Locked" text="The supplier has confirmed this order. Call the supplier to change it." />}
      </ScrollView>
    </SafeAreaView>
  );
}

function DoneView({ result, onClose }) {
  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <View style={st.done}>
        <View style={st.doneIcon}><Text style={st.doneIconText}>{result.queued ? '…' : '✓'}</Text></View>
        <Text style={st.doneTitle}>{result.edited ? 'Order updated' : 'Order sent'}</Text>
        <Text style={st.doneText}>
          {result.queued
            ? 'There is no internet right now. The order is saved on this phone and will be sent automatically.'
            : 'The supplier can see it now. You can change it until the supplier confirms.'}
        </Text>
        <Card style={{ alignSelf: 'stretch', marginTop: 20 }}>
          <View style={st.kv}><Text style={st.kvLabel}>Products</Text><Text style={st.kvValue}>{result.count}</Text></View>
          <View style={st.kv}><Text style={st.kvLabel}>Estimated cost</Text><Text style={st.kvValue}>≈ {fmtPln(result.cost)}</Text></View>
        </Card>
        <Button title="Done" onPress={onClose} style={{ alignSelf: 'stretch', marginTop: 16 }} />
      </View>
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={st.stat}>
      <Text style={st.statValue}>{value}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: T.bg },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: T.ink, textAlign: 'center' },
  emptyText: { fontSize: 14, color: T.inkSoft, marginTop: 6, textAlign: 'center' },

  toolbar: { backgroundColor: T.card, borderBottomWidth: 1, borderBottomColor: T.line, paddingTop: 10 },
  search: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 14, marginBottom: 10, backgroundColor: T.bg, borderRadius: 12, paddingHorizontal: 12 },
  searchIcon: { fontSize: 20, color: T.muted, marginRight: 6 },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 16, color: T.ink },
  searchClear: { fontSize: 16, color: T.muted, padding: 4 },
  chips: { paddingHorizontal: 14, paddingBottom: 10, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  chipOn: { backgroundColor: T.navy, borderColor: T.navy },
  chipText: { fontSize: 13, fontWeight: '700', color: T.inkSoft },
  chipTextOn: { color: '#fff' },

  listPad: { paddingBottom: 120, backgroundColor: T.bg, flexGrow: 1 },
  banners: { padding: 14, paddingBottom: 4, gap: 8 },
  group: { marginTop: 10, marginHorizontal: 14, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: T.line, backgroundColor: T.card },
  groupHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#F9FAFB' },
  groupTitle: { fontSize: 12, fontWeight: '900', color: T.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase' },
  groupCount: { fontSize: 12, fontWeight: '800', color: T.muted },
  more: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingVertical: 12, alignItems: 'center' },
  moreText: { color: T.brand, fontWeight: '800', fontSize: 14 },
  noResult: { padding: 24, alignItems: 'center' },
  cantFind: { marginHorizontal: 14, marginTop: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.brand, padding: 14, alignItems: 'center' },
  cantFindTitle: { color: T.brandDark, fontWeight: '900', fontSize: 15 },
  cantFindText: { color: T.inkSoft, fontSize: 13, marginTop: 2, textAlign: 'center' },
  clear: { alignItems: 'center', padding: 18 },
  clearText: { color: T.danger, fontWeight: '800' },

  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: T.card, borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: T.line },
  statValue: { fontSize: 19, fontWeight: '900', color: T.ink },
  statLabel: { fontSize: 12, color: T.muted, fontWeight: '700', marginTop: 2 },
  reviewCat: { fontSize: 12, fontWeight: '900', color: T.inkSoft, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  lineName: { flex: 1, fontSize: 14, color: T.ink, fontWeight: '600' },
  lineQty: { fontSize: 14, fontWeight: '900', color: T.ink, maxWidth: '45%', textAlign: 'right' },
  lineCost: { width: 44, textAlign: 'right', fontSize: 12, color: T.muted, fontWeight: '700' },
  note: { backgroundColor: T.bg, borderRadius: 10, padding: 12, minHeight: 70, fontSize: 15, color: T.ink, textAlignVertical: 'top' },
  noteShown: { marginTop: 10, color: T.inkSoft, fontStyle: 'italic' },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: T.navy, paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 26 : 12 },
  footerBig: { color: '#fff', fontSize: 19, fontWeight: '900' },
  footerSmall: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 1 },
  cta: { backgroundColor: T.brand, borderRadius: 12, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  back: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingVertical: 15, paddingHorizontal: 18 },
  backText: { color: '#fff', fontWeight: '900', fontSize: 15 },

  done: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: T.bg },
  doneIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: T.brandSoft, alignItems: 'center', justifyContent: 'center' },
  doneIconText: { fontSize: 36, fontWeight: '900', color: T.brandDark },
  doneTitle: { fontSize: 24, fontWeight: '900', color: T.ink, marginTop: 14 },
  doneText: { fontSize: 14, color: T.inkSoft, marginTop: 6, textAlign: 'center', lineHeight: 20 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  kvLabel: { color: T.inkSoft, fontSize: 15 },
  kvValue: { color: T.ink, fontSize: 15, fontWeight: '900' },
});
