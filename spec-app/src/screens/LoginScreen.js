import React, { useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { T } from '../components/ui';

const PIN_LENGTH = 4;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

/* Dostana-branded welcome: charcoal background, logo with white wordmark,
   orange accents, and a PIN keypad that logs in on the fourth digit. */
export default function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  function wobble() {
    Animated.sequence([10, -10, 6, -6, 0].map(v => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true }))).start();
  }

  async function submit(value) {
    setBusy(true);
    const result = await login(value);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      setPin('');
      wobble();
    }
  }

  function press(key) {
    if (busy) return;
    setError('');
    if (key === 'del') { setPin(p => p.slice(0, -1)); return; }
    if (!key || pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) submit(next);
  }

  return (
    <SafeAreaView style={st.safe}>
      <View style={st.top}>
        <Image source={require('../../assets/logo-light.png')} style={st.logo} resizeMode="contain" />
        <View style={st.badge}><Text style={st.badgeText}>SPEC ORDERING</Text></View>
        <Text style={st.tag}>Order supplies for your branch</Text>
      </View>

      <Animated.View style={[st.pinArea, { transform: [{ translateX: shake }] }]}>
        <View style={st.dots}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[st.dot, i < pin.length && st.dotOn]} />
          ))}
        </View>
        <View style={st.status}>
          {busy ? <ActivityIndicator color={T.orange} /> : error ? <Text style={st.error}>{error}</Text> : <Text style={st.hint}>Enter your PIN</Text>}
        </View>
      </Animated.View>

      <View style={st.pad}>
        {KEYS.map((k, i) => (
          <TouchableOpacity
            key={i}
            style={[st.key, !k && st.keyEmpty]}
            onPress={() => press(k)}
            disabled={!k}
            activeOpacity={0.6}
            accessibilityLabel={k === 'del' ? 'Delete' : k}
          >
            <Text style={[st.keyText, k === 'del' && st.keyDel]}>{k === 'del' ? '⌫' : k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={st.foot}>Managers: branch PIN · Supplier: SPEC PIN</Text>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy, justifyContent: 'space-between', paddingVertical: 16 },
  top: { alignItems: 'center', paddingTop: 12 },
  logo: { width: 230, height: 163 },
  badge: { marginTop: 14, borderWidth: 1.5, borderColor: T.orange, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 5 },
  badgeText: { color: T.orange, fontWeight: '900', letterSpacing: 3, fontSize: 12 },
  tag: { color: 'rgba(255,255,255,0.55)', marginTop: 10, fontSize: 14 },
  pinArea: { alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 18 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  dotOn: { backgroundColor: T.orange, borderColor: T.orange },
  status: { height: 28, justifyContent: 'center', marginTop: 10 },
  hint: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
  error: { color: '#F87171', fontWeight: '700', fontSize: 14 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', paddingHorizontal: 34, gap: 14 },
  key: { width: 76, height: 64, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  keyEmpty: { backgroundColor: 'transparent' },
  keyText: { color: '#fff', fontSize: 26, fontWeight: '700' },
  keyDel: { color: T.orange, fontSize: 24 },
  foot: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 },
});
