import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T } from './ui';
import { aiNeedsSize, findProduct, inCart } from '../lib/logic';

/* Shows what the AI matched: each product with the quantity it understood,
   an Add button, and "Add all". Products that need a choice (meat cone size)
   get a "Choose size" button instead. */
export function AiResults({ state, products, cart, onAdd, onAddAll, onChooseSize, onRetry, onAddUnmatched, compact }) {
  if (!state || state.status === 'idle') return null;
  if (state.status === 'loading') {
    return (
      <View style={[st.box, st.row]}>
        <ActivityIndicator color={T.brand} />
        <Text style={st.loading}>AI is matching “{state.query}”…</Text>
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={[st.box, st.errorBox]}>
        <Text style={st.errorText}>{state.error}</Text>
        {onRetry ? <TouchableOpacity onPress={onRetry}><Text style={st.link}>Try again</Text></TouchableOpacity> : null}
      </View>
    );
  }
  const { items = [], unmatched = [], message } = state.result || {};
  const rows = items.map(it => ({ it, p: findProduct(products, { id: it.product_id, name: it.name }) })).filter(r => r.p);
  const addable = rows.filter(r => !aiNeedsSize(r.p, r.it) && !inCart(cart, r.p, r.it));
  return (
    <View style={st.box}>
      <View style={st.head}>
        <Text style={st.title}>✦ AI found {rows.length ? `${rows.length} product${rows.length > 1 ? 's' : ''}` : 'nothing'}</Text>
        {addable.length > 1 && onAddAll ? (
          <TouchableOpacity style={st.addAll} onPress={() => onAddAll(addable.map(r => r.it))}>
            <Text style={st.addAllText}>Add all {addable.length}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {message && !compact ? <Text style={st.message}>{message}</Text> : null}
      {rows.map(({ it, p }) => {
        const needsSize = aiNeedsSize(p, it);
        const added = inCart(cart, p, it);
        return (
          <View key={`${p.id}-${it.unit}`} style={st.item}>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{p.name}</Text>
              <Text style={st.qty}>
                {it.qty != null ? `${it.qty} × ${it.unit || p.unit || ''}` : needsSize ? 'size not given' : 'no quantity given · adds 1'}
              </Text>
              {it.reason && !compact ? <Text style={st.reason}>{it.reason}</Text> : null}
            </View>
            {needsSize ? (
              <TouchableOpacity style={st.btnGhost} onPress={() => onChooseSize?.(p)}><Text style={st.btnGhostText}>Choose size</Text></TouchableOpacity>
            ) : added ? (
              <View style={st.added}><Text style={st.addedText}>✓ In order</Text></View>
            ) : (
              <TouchableOpacity style={st.btn} onPress={() => onAdd(it)}><Text style={st.btnText}>Add</Text></TouchableOpacity>
            )}
          </View>
        );
      })}
      {unmatched.length ? (
        <View style={st.unmatched}>
          <Text style={st.unmatchedText}>Not in the catalogue: {unmatched.join(', ')}</Text>
          {onAddUnmatched ? <TouchableOpacity onPress={() => onAddUnmatched(unmatched)}><Text style={st.link}>Add to note for supplier</Text></TouchableOpacity> : null}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  box: { marginHorizontal: 14, marginTop: 12, borderRadius: 14, borderWidth: 1.5, borderColor: '#C7D2FE', backgroundColor: '#F5F7FF', padding: 12, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  loading: { color: T.info, fontWeight: '700', flex: 1 },
  errorBox: { borderColor: '#FCA5A5', backgroundColor: T.dangerSoft },
  errorText: { color: T.danger, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontSize: 15, fontWeight: '900', color: '#3730A3', flexShrink: 1 },
  message: { color: T.inkSoft, fontSize: 13 },
  addAll: { backgroundColor: '#4338CA', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  addAllText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#E0E7FF' },
  name: { fontSize: 15, fontWeight: '800', color: T.ink },
  qty: { fontSize: 13, color: '#4338CA', fontWeight: '700', marginTop: 2 },
  reason: { fontSize: 12, color: T.inkSoft, marginTop: 2 },
  btn: { backgroundColor: T.brand, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { color: '#fff', fontWeight: '900' },
  btnGhost: { borderWidth: 1.5, borderColor: T.meat, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  btnGhostText: { color: T.meat, fontWeight: '900', fontSize: 13 },
  added: { paddingHorizontal: 8, paddingVertical: 9 },
  addedText: { color: T.brandDark, fontWeight: '900' },
  unmatched: { borderTopWidth: 1, borderTopColor: '#E0E7FF', paddingTop: 8, gap: 4 },
  unmatchedText: { color: T.warn, fontSize: 13, fontWeight: '700' },
  link: { color: T.info, fontWeight: '900', marginTop: 4 },
});
