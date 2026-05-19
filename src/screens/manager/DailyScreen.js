import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../../constants';

export default function ManagerDailyScreen() {
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>Daily</Text></View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.placeholder}>DailyScreen — coming soon</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  scroll: { flex: 1 },
  content: { padding: 16 },
  placeholder: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
});
