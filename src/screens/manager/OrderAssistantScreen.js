import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants';

const PILOT_BRANCH = 'Lopuszanska';
const PORTAL_API = process.env.EXPO_PUBLIC_PORTAL_API_URL || 'https://dostana-web-claude.vercel.app';
const STARTERS = [
  'Prepare the recommended SPEC order for the next 3 days.',
  'What products may run out based on recent sales?',
  'Make a smaller, cautious order for tomorrow only.',
];

export default function ManagerOrderAssistantScreen({ onReviewOrder }) {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Tell me what you need. I will use recent GoPOS sales and the SPEC catalogue to prepare a draft order for your review.' },
  ]);
  const [draft, setDraft] = useState(null);
  const enabled = user?.branch === PILOT_BRANCH;
  const canSend = enabled && !busy && input.trim().length > 0;
  const recentConversation = useMemo(() => messages.slice(-8).map(({ role, text }) => ({ role, text })), [messages]);

  async function send(text = input) {
    const prompt = String(text || '').trim();
    if (!prompt || busy) return;
    if (!user?.sessionPin) {
      Alert.alert('Sign in again', 'Log out and sign in with the branch PIN once to activate the AI Assistant securely.');
      return;
    }
    const userMessage = { role: 'user', text: prompt };
    setMessages(current => [...current, userMessage]);
    setInput('');
    setBusy(true);
    try {
      const response = await fetch(`${PORTAL_API}/api/mobile/order-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branch: user.branch,
          pin: user.sessionPin,
          message: prompt,
          conversation: [...recentConversation, userMessage],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Assistant request failed (${response.status})`);
      if (!data?.message) throw new Error('The assistant returned an empty response.');
      setMessages(current => [...current, { role: 'assistant', text: data.message }]);
      setDraft(data.draft?.items?.length ? data.draft : null);
    } catch (error) {
      const message = error?.message || 'The assistant is temporarily unavailable.';
      setMessages(current => [...current, { role: 'assistant', text: `I could not prepare the order: ${message}` }]);
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return <SafeAreaView style={s.safe}><View style={s.empty}><Text style={s.sparkle}>✨</Text><Text style={s.title}>AI Order Assistant</Text><Text style={s.muted}>The trial is currently available only for Łopuszańska.</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.pilot}><Text style={s.pilotText}>✨ Łopuszańska trial · AI creates a draft only</Text></View>
          {messages.map((message, index) => (
            <View key={`${message.role}-${index}`} style={[s.message, message.role === 'user' ? s.userMessage : s.aiMessage]}>
              <Text style={message.role === 'user' ? s.userText : s.aiText}>{message.text}</Text>
            </View>
          ))}
          {busy && <View style={[s.message, s.aiMessage, s.loading]}><ActivityIndicator color={COLORS.primary}/><Text style={s.muted}>Analysing sales and products…</Text></View>}
          {draft?.items?.length ? (
            <View style={s.draftCard}>
              <Text style={s.draftTitle}>Suggested SPEC draft</Text>
              {draft.items.map((item, index) => (
                <View key={`${item.product_id}-${index}`} style={s.itemRow}>
                  <View style={{ flex: 1 }}><Text style={s.itemName}>{item.name}</Text><Text style={s.reason}>{item.reason}</Text></View>
                  <Text style={s.qty}>{item.qty} {item.unit}</Text>
                </View>
              ))}
              <Text style={s.disclaimer}>Check current stock and all quantities before submitting.</Text>
              <TouchableOpacity style={s.reviewButton} onPress={() => onReviewOrder?.(draft)}><Text style={s.reviewText}>Review in SPEC Order →</Text></TouchableOpacity>
            </View>
          ) : null}
          {messages.length === 1 && <View style={s.starters}>{STARTERS.map(starter => <TouchableOpacity key={starter} style={s.starter} onPress={() => send(starter)}><Text style={s.starterText}>{starter}</Text></TouchableOpacity>)}</View>}
        </ScrollView>
        <View style={s.composer}>
          <TextInput value={input} onChangeText={setInput} editable={!busy} multiline maxLength={600} placeholder="e.g. Order for the weekend, we still have 2 oils…" style={s.input}/>
          <TouchableOpacity disabled={!canSend} onPress={() => send()} style={[s.send, !canSend && s.sendDisabled]}><Text style={s.sendText}>Send</Text></TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F4F6F8'}, scroll:{flex:1}, content:{padding:14,paddingBottom:24,gap:10},
  pilot:{alignSelf:'center',backgroundColor:'#E8F5E9',borderRadius:20,paddingHorizontal:14,paddingVertical:7,marginBottom:4},pilotText:{color:COLORS.primary,fontSize:12,fontWeight:'800'},
  message:{maxWidth:'88%',borderRadius:16,padding:12},userMessage:{alignSelf:'flex-end',backgroundColor:COLORS.primary,borderBottomRightRadius:4},aiMessage:{alignSelf:'flex-start',backgroundColor:'#fff',borderWidth:1,borderColor:'#E5E7EB',borderBottomLeftRadius:4},userText:{color:'#fff',fontSize:14,lineHeight:20},aiText:{color:'#222',fontSize:14,lineHeight:20},loading:{flexDirection:'row',alignItems:'center',gap:8},
  draftCard:{backgroundColor:'#fff',borderRadius:16,borderWidth:1.5,borderColor:'#B7E1C0',padding:14,gap:10,marginTop:4},draftTitle:{fontSize:17,fontWeight:'900',color:'#153D20'},itemRow:{flexDirection:'row',gap:12,borderTopWidth:1,borderTopColor:'#EEF1EE',paddingTop:9},itemName:{fontWeight:'800',color:'#222'},reason:{fontSize:11,color:'#777',marginTop:2},qty:{fontWeight:'900',color:COLORS.primary},disclaimer:{fontSize:11,color:'#B45309',backgroundColor:'#FFF7E6',padding:8,borderRadius:8},reviewButton:{backgroundColor:COLORS.primary,borderRadius:12,padding:13,alignItems:'center'},reviewText:{color:'#fff',fontWeight:'900'},
  starters:{gap:8,marginTop:4},starter:{backgroundColor:'#fff',borderWidth:1,borderColor:'#D7DCE0',padding:11,borderRadius:12},starterText:{color:'#374151',fontWeight:'700',fontSize:13},
  composer:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#E5E7EB'},input:{flex:1,maxHeight:100,minHeight:44,borderWidth:1,borderColor:'#D7DCE0',borderRadius:14,paddingHorizontal:12,paddingVertical:10,color:'#111'},send:{backgroundColor:COLORS.primary,borderRadius:12,paddingHorizontal:16,paddingVertical:13},sendDisabled:{opacity:.4},sendText:{color:'#fff',fontWeight:'900'},
  empty:{flex:1,alignItems:'center',justifyContent:'center',padding:30},sparkle:{fontSize:44},title:{fontSize:22,fontWeight:'900',marginTop:8},muted:{color:'#6B7280',textAlign:'center',lineHeight:20},
});
