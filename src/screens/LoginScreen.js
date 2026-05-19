import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { COLORS } from '../constants';

export default function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  function handleLogin() {
    setError('');
    const result = login(pin.trim());
    if (!result.ok) setError(result.error);
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.card}>
        <Text style={s.logo}>🌯</Text>
        <Text style={s.title}>Dostana Kebab</Text>
        <Text style={s.subtitle}>Management Portal</Text>

        <TextInput
          style={s.input}
          placeholder="Enter PIN"
          placeholderTextColor="#999"
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={4}
          onSubmitEditing={handleLogin}
        />

        {error ? <Text style={s.error}>{error}</Text> : null}

        <TouchableOpacity style={s.btn} onPress={handleLogin} activeOpacity={0.85}>
          <Text style={s.btnText}>Log In</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 32, width: '85%', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  logo: { fontSize: 52, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.text, marginBottom: 2 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 28 },
  input: { width: '100%', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 10, padding: 14, fontSize: 20, textAlign: 'center', letterSpacing: 8, marginBottom: 12, color: COLORS.text },
  error: { color: COLORS.danger, fontSize: 13, marginBottom: 10 },
  btn: { width: '100%', backgroundColor: COLORS.primary, borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
