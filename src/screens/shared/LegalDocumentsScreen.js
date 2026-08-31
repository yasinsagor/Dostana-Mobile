import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants';

const COLLECTION_ORIGIN = 'https://dostana-web-claude.vercel.app';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,}$/;

function collectionUrl(value) {
  const input = value.trim();
  if (TOKEN_PATTERN.test(input)) {
    return `${COLLECTION_ORIGIN}/employee-information/${input}`;
  }

  try {
    const url = new URL(input);
    const allowedHost = url.hostname === 'dostana-web-claude.vercel.app'
      || url.hostname.endsWith('.dostana-kebab-s-projects.vercel.app');
    const match = url.pathname.match(/^\/employee-information\/([A-Za-z0-9_-]{40,})\/?$/);
    return url.protocol === 'https:' && allowedHost && match ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function LegalDocumentsScreen() {
  const [secureLink, setSecureLink] = useState('');
  const [opening, setOpening] = useState(false);

  async function openForm() {
    const url = collectionUrl(secureLink);
    if (!url) {
      Alert.alert(
        'Invalid secure link',
        'Paste the complete employee-information link sent by the owner or HR.',
      );
      return;
    }

    setOpening(true);
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) throw new Error('This device cannot open the secure form.');
      await Linking.openURL(url);
      setSecureLink('');
    } catch (error) {
      Alert.alert('Could not open form', error.message || 'Please try again.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.header}>
            <Text style={s.headerIcon}>🛂</Text>
            <Text style={s.title}>Legal Documents</Text>
            <Text style={s.subtitle}>
              Submit employee information without copying it into the mobile database.
            </Text>
          </View>

          <View style={s.card}>
            <Text style={s.step}>1 · GET YOUR PRIVATE LINK</Text>
            <Text style={s.body}>
              The owner generates a separate 30-day collection link for each employee.
              Never forward your link to another person.
            </Text>

            <Text style={s.label}>Secure employee-information link</Text>
            <TextInput
              value={secureLink}
              onChangeText={setSecureLink}
              placeholder="https://…/employee-information/…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
              style={s.input}
            />

            <TouchableOpacity
              style={[s.button, (!secureLink.trim() || opening) && s.buttonDisabled]}
              onPress={openForm}
              disabled={!secureLink.trim() || opening}
              activeOpacity={0.8}
            >
              <Text style={s.buttonText}>{opening ? 'Opening…' : 'Open secure form'}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.step}>2 · COMPLETE AND ATTACH</Text>
            {[
              ['📍', 'Current workplace', 'Confirm Dostana, Moza, both, or another workplace.'],
              ['🛃', 'Passport copy', 'Upload a PDF, choose photos, or take photos with the rear camera.'],
              ['🪪', 'TRC / Karta Pobytu', 'Attach up to five clear pages or images.'],
              ['📄', 'Work permit', 'Attach the complete permit as PDF or photos.'],
            ].map(([icon, title, description]) => (
              <View key={title} style={s.item}>
                <Text style={s.itemIcon}>{icon}</Text>
                <View style={s.itemText}>
                  <Text style={s.itemTitle}>{title}</Text>
                  <Text style={s.itemBody}>{description}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.security}>
            <Text style={s.securityTitle}>🔒 Privacy</Text>
            <Text style={s.securityText}>
              This app does not save your link, passport, TRC, work permit, PESEL,
              bank account, or form answers on the device. Files go directly to the
              private legal-document service.
            </Text>
          </View>

          <Text style={s.footer}>
            Accepted: PDF, JPG, PNG, HEIC · 10 MB per file · maximum 5 files per document
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F4F6F8' },
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 36, gap: 14 },
  header: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  headerIcon: { fontSize: 38, marginBottom: 8 },
  title: { color: '#fff', fontSize: 23, fontWeight: '900' },
  subtitle: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  step: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  body: { color: '#59636E', fontSize: 13, lineHeight: 20, marginTop: 8 },
  label: { color: '#27313A', fontSize: 13, fontWeight: '700', marginTop: 18, marginBottom: 7 },
  input: {
    borderWidth: 1.5,
    borderColor: '#D9DEE3',
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: '#111',
    fontSize: 13,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 12,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  item: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F4',
  },
  itemIcon: { fontSize: 24 },
  itemText: { flex: 1 },
  itemTitle: { color: '#20262C', fontSize: 14, fontWeight: '800' },
  itemBody: { color: '#737D87', fontSize: 12, lineHeight: 18, marginTop: 2 },
  security: {
    borderWidth: 1,
    borderColor: '#B8DCC4',
    backgroundColor: '#EFFAF2',
    borderRadius: 14,
    padding: 14,
  },
  securityTitle: { color: '#176B37', fontSize: 13, fontWeight: '900' },
  securityText: { color: '#356445', fontSize: 12, lineHeight: 18, marginTop: 5 },
  footer: { color: '#87919B', fontSize: 11, lineHeight: 17, textAlign: 'center', paddingHorizontal: 12 },
});
