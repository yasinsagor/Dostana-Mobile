import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { useSpec } from '../store';
import { Button, Header, T } from '../components/ui';
import { PORTAL_API } from '../config';

const STARTERS = [
  'Prepare the recommended SPEC order for the next 3 days.',
  'What products may run out based on recent sales?',
  'Make a smaller, cautious order for tomorrow only.',
];

/* Uses the existing Dostana portal endpoint (GoPOS sales + SPEC catalogue).
   The AI only prepares a draft; the manager reviews and sends it. */
export default function AssistantScreen({ navigation }) {
  const { user } = useAuth();
  const spec = useSpec();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Tell me what you need. I use your recent sales and the SPEC product list to prepare a draft order for you to check.' },
  ]);
  const history = useMemo(() => messages.slice(-8).map(({ role, text }) => ({ role, text })), [messages]);

  async function send(text = input) {
    const prompt = String(text || '').trim();
    if (!prompt || busy) return;
    const userMessage = { role: 'user', text: prompt };
    setMessages(m => [...m, userMessage]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch(`${PORTAL_API}/api/mobile/order-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch: user.branch, pin: user.pin, message: prompt, conversation: [...history, userMessage] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      if (!data?.message) throw new Error('The assistant returned an empty answer.');
      setMessages(m => [...m, { role: 'assistant', text: data.message }]);
      setDraft(data.draft?.items?.length ? data.draft : null);
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', text: `I could not prepare the order: ${e.message || 'the assistant is unavailable.'}` }]);
    } finally {
      setBusy(false);
    }
  }

  function applyDraft() {
    if (spec.todayOrder && !spec.editing) {
      Alert.alert('Today’s order is already sent', 'Open the Order tab and tap Edit order first.');
      return;
    }
    const items = draft.items.map(it => ({ id: it.product_id || it.id, name: it.name, qty: it.qty, unit: it.unit }));
    spec.loadItems(items, spec.editing ? { kind: 'edit' } : { kind: 'ai' }, {
      review: true,
      noteText: draft.note !== undefined ? draft.note : spec.note,
    });
    navigation.navigate('Order');
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title="AI assistant" subtitle="Trial · prepares a draft only" />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {messages.map((m, i) => (
            <View key={i} style={[st.msg, m.role === 'user' ? st.userMsg : st.aiMsg]}>
              <Text style={m.role === 'user' ? st.userText : st.aiText}>{m.text}</Text>
            </View>
          ))}
          {busy && <View style={[st.msg, st.aiMsg, st.row]}><ActivityIndicator color={T.brand} /><Text style={st.aiText}>Checking sales and products…</Text></View>}
          {draft?.items?.length ? (
            <View style={st.draft}>
              <Text style={st.draftTitle}>Suggested order · {draft.items.length} products</Text>
              {draft.items.map((it, i) => (
                <View key={`${it.product_id}-${i}`} style={st.draftLine}>
                  <View style={{ flex: 1 }}>
                    <Text style={st.draftName}>{it.name}</Text>
                    {it.reason ? <Text style={st.reason}>{it.reason}</Text> : null}
                  </View>
                  <Text style={st.draftQty}>{it.qty} {it.unit}</Text>
                </View>
              ))}
              <Button title="Check and send this order ›" onPress={applyDraft} style={{ marginTop: 6 }} />
            </View>
          ) : null}
          {messages.length === 1 && STARTERS.map(s => (
            <TouchableOpacity key={s} style={st.starter} onPress={() => send(s)}><Text style={st.starterText}>{s}</Text></TouchableOpacity>
          ))}
        </ScrollView>
        <View style={st.composer}>
          <TextInput
            style={st.input}
            value={input}
            onChangeText={setInput}
            editable={!busy}
            multiline
            maxLength={600}
            placeholder="e.g. order for the weekend, we still have 2 oils"
            placeholderTextColor={T.muted}
          />
          <TouchableOpacity style={[st.send, (!input.trim() || busy) && { opacity: 0.4 }]} disabled={!input.trim() || busy} onPress={() => send()}>
            <Text style={st.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  content: { padding: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  msg: { maxWidth: '88%', borderRadius: 16, padding: 12 },
  userMsg: { alignSelf: 'flex-end', backgroundColor: T.brand, borderBottomRightRadius: 4 },
  aiMsg: { alignSelf: 'flex-start', backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderBottomLeftRadius: 4 },
  userText: { color: '#fff', fontSize: 15, lineHeight: 21 },
  aiText: { color: T.ink, fontSize: 15, lineHeight: 21 },
  draft: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1.5, borderColor: '#B7E1C0', padding: 14, gap: 8 },
  draftTitle: { fontSize: 17, fontWeight: '900', color: T.brandDark },
  draftLine: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: '#EEF1EE', paddingTop: 8 },
  draftName: { fontWeight: '800', color: T.ink },
  reason: { fontSize: 12, color: T.inkSoft, marginTop: 2 },
  draftQty: { fontWeight: '900', color: T.brand },
  starter: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12 },
  starterText: { color: T.inkSoft, fontWeight: '700' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 10, backgroundColor: T.card, borderTopWidth: 1, borderTopColor: T.line },
  input: { flex: 1, maxHeight: 110, minHeight: 46, borderWidth: 1, borderColor: T.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: T.ink },
  send: { backgroundColor: T.brand, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14 },
  sendText: { color: '#fff', fontWeight: '900' },
});
