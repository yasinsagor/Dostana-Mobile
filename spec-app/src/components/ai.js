import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { T } from './ui';
import { aiAction, aiNeedsSize, findProduct, num } from '../lib/logic';

/* Shows what the AI matched: each product with the quantity it understood,
   an Add button, and "Add all". Products that need a choice (meat cone size)
   get a "Choose size" button instead. */
const LOADING = { voice: 'Listening to your message…', photo: 'Looking at your photo…', text: 'Finding the right products…' };

export function AiResults({ state, products, cart, onAdd, onAddAll, onChooseSize, onAddUnmatched, onClose }) {
  if (!state || state.status === 'idle') return null;
  const close = onClose ? (
    <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close AI results"><Text style={st.close}>✕</Text></TouchableOpacity>
  ) : null;
  if (state.status === 'loading') {
    return (
      <View style={[st.box, st.row]}>
        {state.photo ? <Image source={{ uri: state.photo }} style={st.photo} /> : null}
        <ActivityIndicator color="#4338CA" />
        <Text style={st.loading}>{LOADING[state.source] || LOADING.text}</Text>
        {close}
      </View>
    );
  }
  if (state.status === 'error') {
    return (
      <View style={[st.box, st.errorBox]}>
        <View style={st.head}><Text style={[st.errorText, { flex: 1 }]}>{state.error}</Text>{close}</View>
        {state.retry ? <TouchableOpacity onPress={state.retry}><Text style={st.link}>Try again</Text></TouchableOpacity> : null}
      </View>
    );
  }
  const { items = [], unmatched = [], message, transcript } = state.result || {};
  const rows = items.map(it => ({ it, p: findProduct(products, { id: it.product_id, name: it.name }) })).filter(r => r.p);
  const addable = rows.filter(r => !aiNeedsSize(r.p, r.it) && aiAction(cart, r.p, r.it) !== 'done');
  return (
    <View style={st.box}>
      <View style={st.head}>
        {state.photo ? <Image source={{ uri: state.photo }} style={st.photo} /> : null}
        <Text style={[st.title, { flex: 1 }]}>✦ AI found {rows.length ? `${rows.length} product${rows.length > 1 ? 's' : ''}` : 'nothing'}</Text>
        {addable.length > 1 && onAddAll ? (
          <TouchableOpacity style={st.addAll} onPress={() => onAddAll(addable.map(r => r.it))}>
            <Text style={st.addAllText}>Use all {addable.length}</Text>
          </TouchableOpacity>
        ) : null}
        {close}
      </View>
      {transcript ? <Text style={st.transcript}>You said: “{transcript}”</Text> : null}
      {message && (!rows.length || unmatched.length) ? <Text style={st.message}>{message}</Text> : null}
      {rows.map(({ it, p }) => {
        const needsSize = aiNeedsSize(p, it);
        const action = aiAction(cart, p, it);
        const nowQty = p && !needsSize ? (it.unit && /kg$/i.test(it.unit) ? num((cart.sizes[p.id] || {})[it.unit.toLowerCase()]) : num(cart.qty[p.id])) : 0;
        return (
          <View key={`${p.id}-${it.unit}`} style={st.item}>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{p.name}</Text>
              <Text style={st.qty}>
                {needsSize
                  ? 'Choose the cone size'
                  : `${it.qty != null ? it.qty : 1} × ${it.unit || p.unit || ''}${it.qty == null ? '  (no amount given)' : ''}`}
              </Text>
              {it.reason ? <Text style={st.reason}>{it.reason}</Text> : null}
            </View>
            {needsSize ? (
              <TouchableOpacity style={st.btnGhost} onPress={() => onChooseSize?.(p)}><Text style={st.btnGhostText}>Choose size</Text></TouchableOpacity>
            ) : action === 'done' ? (
              <View style={st.added}><Text style={st.addedText}>✓ In order</Text></View>
            ) : action === 'update' ? (
              <TouchableOpacity style={st.btnUpdate} onPress={() => onAdd(it)}>
                <Text style={st.btnText}>Update</Text>
                <Text style={st.btnSub}>now {nowQty}</Text>
              </TouchableOpacity>
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
  loading: { color: '#3730A3', fontWeight: '800', flex: 1 },
  close: { color: T.muted, fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  photo: { width: 40, height: 40, borderRadius: 8, backgroundColor: T.bg },
  transcript: { color: T.ink, fontSize: 14, fontStyle: 'italic' },
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
  btnUpdate: { backgroundColor: '#4338CA', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  btnSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '700' },
  btnGhost: { borderWidth: 1.5, borderColor: T.meat, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  btnGhostText: { color: T.meat, fontWeight: '900', fontSize: 13 },
  added: { paddingHorizontal: 8, paddingVertical: 9 },
  addedText: { color: T.brandDark, fontWeight: '900' },
  unmatched: { borderTopWidth: 1, borderTopColor: '#E0E7FF', paddingTop: 8, gap: 4 },
  unmatchedText: { color: T.warn, fontSize: 13, fontWeight: '700' },
  link: { color: T.info, fontWeight: '900', marginTop: 4 },
});

/* Microphone and camera buttons next to a search box. While recording, the
   whole bar becomes a red "Listening" strip with a Stop button. */
export function AiInputButtons({ voice, onPhoto, size = 44 }) {
  const box = { width: size, height: size, borderRadius: 12 };
  return (
    <View style={io.inputs}>
      <TouchableOpacity style={[io.inputBtn, box]} onPress={voice.start} accessibilityLabel="Search by voice">
        <Text style={io.inputIcon}>🎤</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[io.inputBtn, box]} onPress={onPhoto} accessibilityLabel="Search with a photo">
        <Text style={io.inputIcon}>📷</Text>
      </TouchableOpacity>
    </View>
  );
}

export function RecordingBar({ voice }) {
  if (!voice.recording) return null;
  const s = voice.seconds;
  return (
    <View style={io.recording}>
      <View style={io.recDot} />
      <View style={{ flex: 1 }}>
        <Text style={io.recTitle}>Listening… {Math.floor(s / 60)}:{String(s % 60).padStart(2, '0')}</Text>
        <Text style={io.recText}>Say products and amounts in any language. Stops at 0:30.</Text>
      </View>
      <TouchableOpacity style={io.recStop} onPress={voice.stop}><Text style={io.recStopText}>Done</Text></TouchableOpacity>
    </View>
  );
}

const io = StyleSheet.create({
  inputs: { flexDirection: 'row', gap: 6 },
  inputBtn: { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  inputIcon: { fontSize: 20 },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: '#FEF2F2', borderWidth: 1.5, borderColor: '#FCA5A5' },
  recDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#DC2626' },
  recTitle: { color: '#B91C1C', fontWeight: '900', fontSize: 15 },
  recText: { color: '#7F1D1D', fontSize: 12, marginTop: 2 },
  recStop: { backgroundColor: '#DC2626', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  recStopText: { color: '#fff', fontWeight: '900' },
});
