import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, StatusBar } from 'react-native';
import { COLORS } from '../constants';

export default function SplashScreen({ onDone }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 5, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => onDone());
    }, 2200);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <Animated.View style={[s.logoWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Text style={s.emoji}>🌯</Text>
      </Animated.View>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
        <Text style={s.brand}>Dostana Kebab</Text>
        <Text style={s.sub}>Management Portal</Text>
      </Animated.View>
      <Animated.View style={[s.footer, { opacity: fadeAnim }]}>
        <View style={s.dot} /><View style={[s.dot, s.dotMid]} /><View style={s.dot} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  logoWrap: { width: 120, height: 120, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  emoji: { fontSize: 64 },
  brand: { fontSize: 28, fontWeight: '900', color: '#fff', textAlign: 'center', letterSpacing: 0.5 },
  sub: { fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 6, letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 60, flexDirection: 'row', gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotMid: { backgroundColor: '#fff' },
});
