import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { COLORS, BRANCHES } from '../../constants';

function Row({ label, sub, right, onPress, danger }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={s.rowLeft}>
        <Text style={[s.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionBody}>{children}</View>
    </View>
  );
}

export default function OwnerSettingsScreen() {
  const { user, logout } = useAuth();
  const [notif, setNotif] = useState(false);

  function confirmLogout() {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}><Text style={s.title}>⚙️ Settings</Text></View>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Profile */}
        <View style={s.profileCard}>
          <Text style={s.profileIcon}>👑</Text>
          <View>
            <Text style={s.profileName}>Owner</Text>
            <Text style={s.profileSub}>Full access — all {BRANCHES.length} branches</Text>
          </View>
        </View>

        {/* Branches */}
        <Section title="BRANCHES">
          {BRANCHES.map((b, i) => (
            <Row
              key={b.name}
              label={b.name}
              sub={'PIN: ' + b.pin}
              right={<Text style={s.branchNum}>#{i + 1}</Text>}
            />
          ))}
        </Section>

        {/* Preferences */}
        <Section title="PREFERENCES">
          <Row
            label="Push Notifications"
            sub="Daily report reminders"
            right={
              <Switch
                value={notif}
                onValueChange={setNotif}
                trackColor={{ true: COLORS.primary }}
              />
            }
          />
        </Section>

        {/* App info */}
        <Section title="APP INFO">
          <Row label="App Name" right={<Text style={s.val}>Dostana Mobile</Text>} />
          <Row label="Version" right={<Text style={s.val}>1.0.0</Text>} />
          <Row label="Backend" right={<Text style={s.val}>Supabase</Text>} />
          <Row label="Total Branches" right={<Text style={s.val}>{BRANCHES.length}</Text>} />
        </Section>

        {/* Account */}
        <Section title="ACCOUNT">
          <Row
            label="Log Out"
            sub="You will need your PIN to log back in"
            onPress={confirmLogout}
            danger
            right={<Text style={s.arrow}>›</Text>}
          />
        </Section>

        <Text style={s.footer}>Dostana Kebab Management · v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: '900', color: COLORS.text },
  scroll: { flex: 1 },
  content: { padding: 14, paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.primary, borderRadius: 14, padding: 16, marginBottom: 20 },
  profileIcon: { fontSize: 36 },
  profileName: { fontSize: 18, fontWeight: '900', color: '#fff' },
  profileSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, letterSpacing: 1, marginBottom: 6, marginLeft: 4 },
  sectionBody: { backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowLeft: { flex: 1 },
  rowLabel: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  rowSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  val: { fontSize: 13, color: COLORS.textSecondary },
  branchNum: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
  arrow: { fontSize: 20, color: COLORS.textSecondary },
  footer: { textAlign: 'center', color: COLORS.textSecondary, fontSize: 11, marginTop: 10 },
});
