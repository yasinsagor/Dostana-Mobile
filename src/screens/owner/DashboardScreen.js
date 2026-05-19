import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants';

export default function OwnerDashboardScreen() {
  const { logout } = useAuth();
  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>🏠 Owner Dashboard</Text>
        <TouchableOpacity onPress={logout}><Text style={s.logoutBtn}>Log out</Text></TouchableOpacity>
      </View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.placeholder}>Dashboard — coming soon</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  logoutBtn: { fontSize: 13, color: COLORS.danger, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 16 },
  placeholder: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 40 },
});
