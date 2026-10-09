import React, { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { Button, T } from '../components/ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError('');
    const result = await login(pin);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <SafeAreaView style={st.safe}>
      <KeyboardAvoidingView style={st.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Image source={require('../../assets/logo.png')} style={st.logo} resizeMode="contain" />
        <Text style={st.title}>Dostana SPEC</Text>
        <Text style={st.sub}>Order supplies for your branch</Text>
        <View style={st.card}>
          <Text style={st.label}>Branch PIN</Text>
          <TextInput
            style={st.input}
            value={pin}
            onChangeText={t => { setPin(t.replace(/\D/g, '')); setError(''); }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={8}
            placeholder="••••"
            placeholderTextColor={T.muted}
            onSubmitEditing={submit}
            autoFocus
          />
          {error ? <Text style={st.error}>{error}</Text> : null}
          {busy ? <ActivityIndicator color={T.brand} style={{ marginTop: 16 }} /> : (
            <Button title="Log in" onPress={submit} disabled={pin.length < 4} style={{ marginTop: 16 }} />
          )}
          <Text style={st.hint}>Use the same PIN as in the Dostana app. You stay logged in on this phone.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  wrap: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { width: 84, height: 84, alignSelf: 'center', marginBottom: 12 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', textAlign: 'center' },
  sub: { color: 'rgba(255,255,255,0.65)', fontSize: 15, textAlign: 'center', marginTop: 4, marginBottom: 28 },
  card: { backgroundColor: T.card, borderRadius: 18, padding: 20 },
  label: { fontSize: 13, fontWeight: '800', color: T.inkSoft, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: T.line, borderRadius: 12, fontSize: 28, letterSpacing: 10, textAlign: 'center', paddingVertical: 12, color: T.ink, backgroundColor: '#FAFAFA' },
  error: { color: T.danger, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  hint: { color: T.muted, fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 17 },
});
