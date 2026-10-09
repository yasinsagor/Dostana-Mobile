import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpec } from '../store';
import { Button, Header, T } from '../components/ui';
import { AiResults, RecordingBar } from '../components/ai';
import { useAiSearch } from '../lib/useAiSearch';

/* AI helper: the manager speaks, photographs or types what they need, in any
   language, and the AI finds the correct catalogue products and order units.
   It never sends anything: products go into the order for review. */
export default function AssistantScreen({ navigation }) {
  const spec = useSpec();
  const ai = useAiSearch('order');
  const [text, setText] = useState('');

  function canChange() {
    if (spec.todayOrder && !spec.editing) {
      Alert.alert('Today’s order is already sent', 'Open the Order tab and tap Edit order first.');
      return false;
    }
    return true;
  }
  function add(items) { if (canChange()) spec.applyAiItems(items); }
  function addAndOpen(items) { if (canChange()) { spec.applyAiItems(items); navigation.navigate('Order'); } }
  function addUnmatched(words) {
    const lines = words.map(w => `+ ${w}`).join('\n');
    spec.setNote(spec.note ? `${spec.note}\n${lines}` : lines);
    Alert.alert('Added to the note', 'These will be sent to the supplier as a note with your order.');
  }

  const busy = ai.state.status === 'loading' || ai.voice.recording;

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title="AI helper" subtitle="Find the right product and unit · any language" />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: T.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
          <View style={st.actions}>
            <TouchableOpacity style={[st.action, st.actionVoice, busy && st.off]} disabled={busy} onPress={ai.voice.start}>
              <Text style={st.actionIcon}>🎤</Text>
              <Text style={st.actionTitle}>Speak</Text>
              <Text style={st.actionText}>Say what you need</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.action, st.actionPhoto, busy && st.off]} disabled={busy} onPress={ai.choosePhoto}>
              <Text style={st.actionIcon}>📷</Text>
              <Text style={st.actionTitle}>Photo</Text>
              <Text style={st.actionText}>Product, label or list</Text>
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 12 }}><RecordingBar voice={ai.voice} /></View>

          <View style={st.typeBox}>
            <Text style={st.typeLabel}>Or type it</Text>
            <TextInput
              style={st.typeInput}
              value={text}
              onChangeText={setText}
              multiline
              maxLength={600}
              placeholder={'e.g. 2 baranina 15, kurczak 2×20, 6 pita 110, 10 kg frytki, rękawice XL'}
              placeholderTextColor={T.muted}
            />
            <Button title="Find products" onPress={() => ai.searchText(text.trim())} disabled={!text.trim() || busy} style={{ marginTop: 10 }} />
          </View>

          <AiResults
            state={ai.state}
            products={spec.products}
            cart={spec.cart}
            onAdd={it => add([it])}
            onAddAll={addAndOpen}
            onChooseSize={() => navigation.navigate('Order')}
            onAddUnmatched={addUnmatched}
            onClose={ai.clear}
          />
          {ai.state.status === 'done' && ai.state.result.items.length > 0 && (
            <Button title="Go to my order ›" kind="ghost" onPress={() => navigation.navigate('Order')} style={{ marginHorizontal: 14, marginTop: 12 }} />
          )}

          {ai.state.status === 'idle' && (
            <View style={st.help}>
              <Text style={st.helpTitle}>What the AI does</Text>
              <Text style={st.helpText}>• Understands Polish, English, Bengali, Urdu, Hindi, Turkish and more, with typos.</Text>
              <Text style={st.helpText}>• Picks the right unit: “10 kg frytki” becomes 1 karton (4 × 2.5 kg).</Text>
              <Text style={st.helpText}>• Reads photos of a product, its label, an empty box or your written list.</Text>
              <Text style={st.helpText}>• Only adds products from the SPEC list. You check everything before sending.</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  actions: { flexDirection: 'row', gap: 10, marginHorizontal: 14, marginTop: 14 },
  action: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1.5 },
  actionVoice: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  actionPhoto: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  off: { opacity: 0.5 },
  actionIcon: { fontSize: 34 },
  actionTitle: { fontSize: 17, fontWeight: '900', color: T.ink, marginTop: 4 },
  actionText: { fontSize: 12, color: T.inkSoft, marginTop: 2, textAlign: 'center' },
  typeBox: { marginHorizontal: 14, backgroundColor: T.card, borderRadius: 14, borderWidth: 1, borderColor: T.line, padding: 14 },
  typeLabel: { fontSize: 15, fontWeight: '900', color: T.ink, marginBottom: 8 },
  typeInput: { minHeight: 90, maxHeight: 200, borderWidth: 1, borderColor: T.line, borderRadius: 12, padding: 12, fontSize: 16, color: T.ink, textAlignVertical: 'top', backgroundColor: '#FAFAFA' },
  help: { margin: 14, padding: 14, borderRadius: 14, backgroundColor: T.card, borderWidth: 1, borderColor: T.line, gap: 6 },
  helpTitle: { fontSize: 15, fontWeight: '900', color: T.ink },
  helpText: { fontSize: 14, color: T.inkSoft, lineHeight: 20 },
});
