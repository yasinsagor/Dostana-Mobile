import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS } from '../../constants';

const ORANGE = '#E65100';

export default function SupplierSettingsScreen() {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of the supplier portal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log Out', style: 'destructive', onPress: logout },
      ]
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>⚙️ Settings</Text>
        <Text style={s.sub}>Supplier Portal</Text>
      </View>

      <View style={s.content}>
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>🏭</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.userName}>{user?.name || 'Supplier'}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleTxt}>Supplier Account</Text>
            </View>
          </View>
        </View>

        {/* Info rows */}
        <View style={s.section}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Role</Text>
            <Text style={s.rowValue}>Supplier</Text>
          </View>
          <View style={s.row}>
            <Text style={s.rowLabel}>Access</Text>
            <Text style={s.rowValue}>All branches · Read orders</Text>
          </View>
          <View style={[s.row, { borderBottomWidth: 0 }]}>
            <Text style={s.rowLabel}>Portal</Text>
            <Text style={s.rowValue}>Dostana Kebab Management</Text>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={s.logoutTxt}>🚪 Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F4F6F8' },
  header:      { backgroundColor: ORANGE, paddingHorizontal: 16, paddingVertical: 18 },
  title:       { fontSize: 20, fontWeight: '900', color: '#fff' },
  sub:         { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  content:     { padding: 16, gap: 14 },
  profileCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 3, borderTopColor: ORANGE },
  avatar:      { width: 52, height: 52, borderRadius: 26, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:   { fontSize: 26 },
  userName:    { fontSize: 16, fontWeight: '900', color: '#222', marginBottom: 4 },
  roleBadge:   { backgroundColor: '#FFF3E0', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  roleTxt:     { fontSize: 11, fontWeight: '800', color: ORANGE },
  section:     { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  row:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  rowLabel:    { fontSize: 13, color: '#666', fontWeight: '600' },
  rowValue:    { fontSize: 13, color: '#222', fontWeight: '700', textAlign: 'right', flex: 1, marginLeft: 20 },
  logoutBtn:   { backgroundColor: COLORS.danger, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  logoutTxt:   { color: '#fff', fontSize: 15, fontWeight: '900' },
});
