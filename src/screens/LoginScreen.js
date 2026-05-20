import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Animated, Dimensions, StatusBar, Platform,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';

const { width, height } = Dimensions.get('window');
const PIN_LENGTH = 4;

/* ─── decorative circle ─────────────────────────────────── */
function DecoCircle({ size, top, left, opacity }) {
  return (
    <View style={{
      position: 'absolute', top, left,
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 1, borderColor: `rgba(255,255,255,${opacity})`,
    }} />
  );
}

/* ─── numpad key ─────────────────────────────────────────── */
function Key({ label, sub, onPress, variant }) {
  const scale = useRef(new Animated.Value(1)).current;

  function press() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.88, duration: 70, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();
    onPress?.();
  }

  if (variant === 'empty') return <View style={k.key} />;

  const isAction = variant === 'del' || variant === 'go';
  return (
    <TouchableOpacity onPress={press} activeOpacity={1}>
      <Animated.View style={[k.key, isAction && k.keyAction, { transform: [{ scale }] }]}>
        {variant === 'del' ? (
          <Text style={k.delTxt}>⌫</Text>
        ) : variant === 'go' ? (
          <Text style={k.goTxt}>✓</Text>
        ) : (
          <>
            <Text style={k.digit}>{label}</Text>
            {sub ? <Text style={k.sub}>{sub}</Text> : null}
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}
const k = StyleSheet.create({
  key:       { width: (width - 80) / 3, height: 64, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', margin: 6 },
  keyAction: { backgroundColor: 'transparent' },
  digit:     { fontSize: 26, fontWeight: '300', color: '#fff', lineHeight: 30 },
  sub:       { fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, marginTop: -2 },
  delTxt:    { fontSize: 22, color: 'rgba(255,255,255,0.6)' },
  goTxt:     { fontSize: 28, color: '#4CAF50', fontWeight: '700' },
});

/* ═══════════════════════════════════════════════════════════ */
export default function LoginScreen() {
  const { login } = useAuth();
  const [pin, setPin]     = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  /* dot animations */
  const dotScales = useRef([...Array(PIN_LENGTH)].map(() => new Animated.Value(1))).current;
  /* error shake */
  const shakeAnim = useRef(new Animated.Value(0)).current;
  /* logo fade-in */
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 700, delay: 100, useNativeDriver: true }),
      Animated.timing(logoY,       { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  function animateDot(idx) {
    Animated.sequence([
      Animated.timing(dotScales[idx], { toValue: 1.4, duration: 100, useNativeDriver: true }),
      Animated.timing(dotScales[idx], { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  }

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 60,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 40,  useNativeDriver: true }),
    ]).start();
  }

  function pressDigit(d) {
    if (pin.length >= PIN_LENGTH) return;
    setError('');
    const next = pin + d;
    animateDot(pin.length);
    setPin(next);
    if (next.length === PIN_LENGTH) {
      setTimeout(() => attemptLogin(next), 180);
    }
  }

  function pressDelete() {
    setError('');
    setPin(p => p.slice(0, -1));
  }

  function attemptLogin(p = pin) {
    const result = login((p || pin).trim());
    if (!result.ok) {
      setError(result.error || 'Invalid PIN');
      setPin('');
      triggerShake();
    }
  }

  const KEYS = [
    ['1','','2','ABC','3','DEF'],
    ['4','GHI','5','JKL','6','MNO'],
    ['7','PQRS','8','TUV','9','WXYZ'],
    ['empty','','0','+','del',''],
  ];

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#1A3A1A" />

      {/* Background decorative circles */}
      <DecoCircle size={300} top={-80}  left={-100} opacity={0.06} />
      <DecoCircle size={200} top={-30}  left={-50}  opacity={0.08} />
      <DecoCircle size={400} top={height-200} left={width-180} opacity={0.05} />
      <DecoCircle size={220} top={height-120} left={width-100} opacity={0.08} />

      {/* Logo + branding */}
      <Animated.View style={[s.logoWrap, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
        <View style={s.logoRing}>
          <Image
            source={require('../../assets/logo.png')}
            style={s.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={s.brand}>DOSTANA KEBAB</Text>
        <Text style={s.portal}>Management Portal</Text>
      </Animated.View>

      {/* PIN area */}
      <Animated.View style={[s.pinArea, { transform: [{ translateX: shakeAnim }] }]}>
        {/* Dots */}
        <View style={s.dotsRow}>
          {[...Array(PIN_LENGTH)].map((_, i) => {
            const filled = i < pin.length;
            return (
              <Animated.View
                key={i}
                style={[
                  s.dot,
                  filled && s.dotFilled,
                  { transform: [{ scale: dotScales[i] }] },
                ]}
              />
            );
          })}
        </View>

        {/* Error */}
        <View style={s.errorWrap}>
          {error ? <Text style={s.errorTxt}>{error}</Text> : null}
        </View>
      </Animated.View>

      {/* Numpad */}
      <View style={s.numpad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {[0, 2, 4].map(ci => {
              const label   = row[ci];
              const sub     = row[ci + 1];
              if (label === 'empty') return <Key key={ci} variant="empty" />;
              if (label === 'del')   return <Key key={ci} variant="del" onPress={pressDelete} />;
              return <Key key={ci} label={label} sub={sub} onPress={() => pressDigit(label)} />;
            })}
          </View>
        ))}
        {/* Enter key — full width when PIN filled */}
        {pin.length === PIN_LENGTH && (
          <TouchableOpacity style={s.enterBtn} onPress={() => attemptLogin()} activeOpacity={0.85}>
            <Text style={s.enterTxt}>Enter →</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.hint}>Enter your 4-digit PIN</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#1B3D1B', alignItems: 'center', justifyContent: 'space-between', paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 30 },

  logoWrap:  { alignItems: 'center', gap: 10 },
  logoRing:  {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#4CAF50', shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  logo:      { width: 96, height: 96, borderRadius: 48 },
  brand:     { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: 2.5, marginTop: 4 },
  portal:    { fontSize: 13, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, fontWeight: '500' },

  pinArea:   { alignItems: 'center', width: '100%' },
  dotsRow:   { flexDirection: 'row', gap: 20, marginBottom: 12 },
  dot:       { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'transparent' },
  dotFilled: { backgroundColor: '#4CAF50', borderColor: '#4CAF50', shadowColor: '#4CAF50', shadowOpacity: 0.7, shadowRadius: 6, elevation: 4 },
  errorWrap: { height: 22, justifyContent: 'center' },
  errorTxt:  { color: '#EF5350', fontSize: 13, fontWeight: '600', letterSpacing: 0.3 },

  numpad:    { width: '100%', alignItems: 'center', paddingHorizontal: 20 },
  keyRow:    { flexDirection: 'row', justifyContent: 'center' },
  enterBtn:  { width: (width - 80), height: 56, borderRadius: 16, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center', marginTop: 6, shadowColor: '#4CAF50', shadowOpacity: 0.4, shadowRadius: 10, elevation: 6 },
  enterTxt:  { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },

  hint:      { fontSize: 12, color: 'rgba(255,255,255,0.25)', letterSpacing: 0.5 },
});
