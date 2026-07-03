import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';
import { fetchHaccpInstructions, insertHaccpEntry } from '../../lib/supabase';
import { COLORS } from '../../constants';

const REGISTER_TYPES = [
  { code: 'temperature', label: 'Temperature', icon: '🌡️' },
  { code: 'delivery', label: 'Delivery', icon: '📦' },
  { code: 'cleaning_room', label: 'Rooms', icon: '🧹' },
  { code: 'cleaning_equipment', label: 'Equipment', icon: '🧼' },
  { code: 'pest_control', label: 'Pests', icon: '🔎' },
  { code: 'oil', label: 'Oil', icon: '🍟' },
  { code: 'training', label: 'Training', icon: '🎓' },
];

const TEMPERATURE_PRESETS = [
  { label: 'Salads', min: 2, max: 6 },
  { label: 'Sauces', min: 2, max: 4 },
  { label: 'Hot holding', min: 60, max: null },
  { label: 'Bain-marie', min: 60, max: 75 },
  { label: 'Cooled meat', min: 0, max: 4 },
  { label: 'Reheating', min: 70, max: null },
  { label: 'Defrosted food', min: -1, max: 3 },
];

const FALLBACK_INSTRUCTIONS = [
  {
    code: 'temperature', register_type: 'temperature', title: 'Temperature control',
    description: 'Use a clean, disinfected thermometer and record the real value.',
    steps: ['Disinfect the probe before and after use.', 'Measure the centre of the food.', 'If outside the limit, isolate food and record corrective action.'],
  },
  {
    code: 'delivery', register_type: 'delivery', title: 'Goods receipt',
    description: 'Check packaging, date, transport hygiene and temperature where applicable.',
    steps: ['Identify supplier and product.', 'Reject or isolate nonconforming goods.', 'Record what was done.'],
  },
  {
    code: 'cleaning_room', register_type: 'cleaning_room', title: 'Room cleaning',
    description: 'Protect food, remove waste, wash, disinfect and allow the surface to dry.',
    steps: ['Use the approved chemical and concentration.', 'Clean the tools after use.', 'Record the room or surface.'],
  },
  {
    code: 'cleaning_equipment', register_type: 'cleaning_equipment', title: 'Equipment cleaning',
    description: 'Switch off and empty equipment safely before washing and disinfection.',
    steps: ['Remove residues and detachable parts.', 'Wash, rinse, disinfect and dry.', 'Report faults immediately.'],
  },
  {
    code: 'pest_control', register_type: 'pest_control', title: 'Pest check',
    description: 'Inspect food storage, waste areas and entry points every day.',
    steps: ['Protect food if evidence is found.', 'Notify the manager and DDD provider.', 'Discard affected food.'],
  },
  {
    code: 'oil', register_type: 'oil', title: 'Frying oil',
    description: 'Check colour, smell, smoke and residue; replace unsuitable oil.',
    steps: ['Do not hide deterioration by topping up.', 'Use the dedicated waste-oil container.', 'Record replacement.'],
  },
  {
    code: 'training', register_type: 'training', title: 'GHP / GMP / HACCP training',
    description: 'Record induction and annual refresher training.',
    steps: ['Record participant, trainer and topic.', 'Cover hygiene, checks and corrective actions.', 'Confirm acknowledgement.'],
  },
];

function parseNumber(value) {
  if (!String(value).trim()) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function limitText(preset) {
  if (preset.min != null && preset.max != null) return `${preset.min}°C to ${preset.max}°C`;
  if (preset.min != null) return `minimum ${preset.min}°C`;
  return `maximum ${preset.max}°C`;
}

export default function HaccpScreen() {
  const { user } = useAuth();
  const [mode, setMode] = useState('register');
  const [type, setType] = useState('temperature');
  const [instructions, setInstructions] = useState(FALLBACK_INSTRUCTIONS);
  const [loadingInstructions, setLoadingInstructions] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState(TEMPERATURE_PRESETS[0]);
  const [submittedBy, setSubmittedBy] = useState('');
  const [subject, setSubject] = useState(TEMPERATURE_PRESETS[0].label);
  const [reading, setReading] = useState('');
  const [manualCompliant, setManualCompliant] = useState(true);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [recheckReading, setRecheckReading] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchHaccpInstructions()
      .then(rows => { if (active && rows.length) setInstructions(rows); })
      .catch(() => {})
      .finally(() => { if (active) setLoadingInstructions(false); });
    return () => { active = false; };
  }, []);

  const numericReading = parseNumber(reading);
  const isTemperature = type === 'temperature';
  const temperatureCompliant = useMemo(() => {
    if (numericReading == null || !selectedPreset) return null;
    if (selectedPreset.min != null && numericReading < selectedPreset.min) return false;
    if (selectedPreset.max != null && numericReading > selectedPreset.max) return false;
    return true;
  }, [numericReading, selectedPreset]);
  const isCompliant = isTemperature ? temperatureCompliant : manualCompliant;
  const activeInstruction = instructions.find(item => item.register_type === type);

  function changeType(nextType) {
    setType(nextType);
    setReading('');
    setCorrectiveAction('');
    setRecheckReading('');
    setNotes('');
    setManualCompliant(true);
    if (nextType === 'temperature') {
      setSelectedPreset(TEMPERATURE_PRESETS[0]);
      setSubject(TEMPERATURE_PRESETS[0].label);
    } else {
      setSubject('');
    }
  }

  function choosePreset(preset) {
    setSelectedPreset(preset);
    setSubject(preset.label);
    setReading('');
    setCorrectiveAction('');
    setRecheckReading('');
  }

  async function submit() {
    const person = submittedBy.trim();
    const item = subject.trim();
    if (!person) return Alert.alert('Name required', 'Enter the name of the person completing this check.');
    if (!item) return Alert.alert('Subject required', 'Enter the product, room, equipment, supplier or training topic.');
    if (isTemperature && numericReading == null) return Alert.alert('Temperature required', 'Enter a valid measured temperature.');
    if (isCompliant === null) return Alert.alert('Complete the check', 'Enter the measurement or select a result.');
    if (!isCompliant && correctiveAction.trim().length < 3) {
      return Alert.alert('Corrective action required', 'Explain what was isolated, discarded, moved, cleaned, rejected or reported.');
    }

    setSaving(true);
    try {
      await insertHaccpEntry({
        branch: user?.branch,
        register_type: type,
        instruction_code: activeInstruction?.code || type,
        submitted_by: person,
        subject: item,
        reading: isTemperature ? numericReading : null,
        unit: isTemperature ? 'C' : null,
        minimum_limit: isTemperature ? selectedPreset?.min : null,
        maximum_limit: isTemperature ? selectedPreset?.max : null,
        is_compliant: Boolean(isCompliant),
        corrective_action: isCompliant ? null : correctiveAction.trim(),
        recheck_reading: isTemperature ? parseNumber(recheckReading) : null,
        notes: notes.trim() || null,
        details: { instruction_title: activeInstruction?.title || null },
        source: 'mobile',
      });
      Alert.alert('Saved', 'The HACCP record is now available in the manager portal.');
      setReading('');
      setCorrectiveAction('');
      setRecheckReading('');
      setNotes('');
      setManualCompliant(true);
      if (!isTemperature) setSubject('');
    } catch (error) {
      Alert.alert('Could not save', error?.message || 'Check the internet connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>HACCP Register</Text>
            <Text style={styles.subtitle}>{user?.branch || 'Branch'} · signed operational records</Text>
          </View>
          <Text style={styles.shield}>✓</Text>
        </View>

        <View style={styles.modeTabs}>
          <TouchableOpacity style={[styles.modeTab, mode === 'register' && styles.modeTabActive]} onPress={() => setMode('register')}>
            <Text style={[styles.modeText, mode === 'register' && styles.modeTextActive]}>New record</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modeTab, mode === 'instructions' && styles.modeTabActive]} onPress={() => setMode('instructions')}>
            <Text style={[styles.modeText, mode === 'instructions' && styles.modeTextActive]}>Instructions</Text>
          </TouchableOpacity>
        </View>

        {mode === 'instructions' ? (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Your HACCP and GMP/GHP book remains the controlling document</Text>
              <Text style={styles.noticeText}>These short instructions help complete daily records. Follow the full approved book whenever more detail is required.</Text>
            </View>
            {loadingInstructions && <ActivityIndicator color={COLORS.primary} />}
            {instructions.map((item, index) => (
              <View key={item.code} style={styles.card}>
                <Text style={styles.cardEyebrow}>{REGISTER_TYPES.find(t => t.code === item.register_type)?.icon} PROCEDURE {index + 1}</Text>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.description}>{item.description}</Text>
                {(Array.isArray(item.steps) ? item.steps : []).map((step, stepIndex) => (
                  <View key={`${item.code}-${stepIndex}`} style={styles.stepRow}>
                    <View style={styles.stepNumber}><Text style={styles.stepNumberText}>{stepIndex + 1}</Text></View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.sectionLabel}>REGISTER TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
              {REGISTER_TYPES.map(item => (
                <TouchableOpacity key={item.code} style={[styles.typeChip, type === item.code && styles.typeChipActive]} onPress={() => changeType(item.code)}>
                  <Text style={styles.typeIcon}>{item.icon}</Text>
                  <Text style={[styles.typeLabel, type === item.code && styles.typeLabelActive]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {activeInstruction && (
              <TouchableOpacity style={styles.instructionStrip} onPress={() => setMode('instructions')} activeOpacity={0.8}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.instructionTitle}>{activeInstruction.title}</Text>
                  <Text style={styles.instructionText} numberOfLines={2}>{activeInstruction.description}</Text>
                </View>
                <Text style={styles.instructionLink}>Read ›</Text>
              </TouchableOpacity>
            )}

            {isTemperature && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>What are you measuring?</Text>
                <View style={styles.presetGrid}>
                  {TEMPERATURE_PRESETS.map(preset => (
                    <TouchableOpacity key={preset.label} style={[styles.preset, selectedPreset?.label === preset.label && styles.presetActive]} onPress={() => choosePreset(preset)}>
                      <Text style={[styles.presetName, selectedPreset?.label === preset.label && styles.presetNameActive]}>{preset.label}</Text>
                      <Text style={[styles.presetLimit, selectedPreset?.label === preset.label && styles.presetLimitActive]}>{limitText(preset)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Field label="Completed by" value={submittedBy} onChangeText={setSubmittedBy} placeholder="Employee or manager name" />
              <Field
                label={isTemperature ? 'Food / equipment' : 'Subject'}
                value={subject}
                onChangeText={setSubject}
                placeholder={type === 'delivery' ? 'Supplier and product' : type === 'training' ? 'Participant and topic' : 'Room, equipment or check point'}
              />

              {isTemperature ? (
                <>
                  <Text style={styles.fieldLabel}>Measured temperature</Text>
                  <View style={styles.readingRow}>
                    <TextInput style={styles.readingInput} value={reading} onChangeText={setReading} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#AAB4AD" />
                    <Text style={styles.degree}>°C</Text>
                  </View>
                  {temperatureCompliant !== null && (
                    <View style={[styles.result, temperatureCompliant ? styles.resultOk : styles.resultBad]}>
                      <Text style={[styles.resultText, temperatureCompliant ? styles.resultTextOk : styles.resultTextBad]}>
                        {temperatureCompliant ? '✓ Within HACCP limit' : `! Outside ${limitText(selectedPreset)}`}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Result</Text>
                  <View style={styles.resultButtons}>
                    <TouchableOpacity style={[styles.resultButton, manualCompliant && styles.resultButtonOk]} onPress={() => setManualCompliant(true)}>
                      <Text style={[styles.resultButtonText, manualCompliant && styles.resultButtonTextActive]}>✓ Compliant</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.resultButton, !manualCompliant && styles.resultButtonBad]} onPress={() => setManualCompliant(false)}>
                      <Text style={[styles.resultButtonText, !manualCompliant && styles.resultButtonTextActive]}>! Issue found</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {isCompliant === false && (
                <>
                  <Field label="Corrective action (required)" value={correctiveAction} onChangeText={setCorrectiveAction} placeholder="Isolated, discarded, moved, rejected, cleaned, reported…" multiline />
                  {isTemperature && <Field label="Recheck temperature (optional)" value={recheckReading} onChangeText={setRecheckReading} placeholder="0.0 °C" keyboardType="decimal-pad" />}
                </>
              )}
              <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Batch, supplier, equipment number or other details" multiline />
            </View>

            <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={submit} disabled={saving} activeOpacity={0.8}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save signed HACCP record</Text>}
            </TouchableOpacity>
            <Text style={styles.auditNote}>Date, time, branch and source are recorded automatically.</Text>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, multiline, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        placeholderTextColor="#AAB4AD"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F6F3' },
  header: { backgroundColor: '#14532D', paddingHorizontal: 18, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#BBF7D0', fontSize: 11, marginTop: 3 },
  shield: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D6A52A', color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 21, fontWeight: '900', overflow: 'hidden' },
  modeTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#DDE7E0' },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: '#15803D' },
  modeText: { color: '#647067', fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: '#14532D' },
  content: { padding: 14, gap: 12, paddingBottom: 36 },
  sectionLabel: { color: '#647067', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  typeRow: { gap: 8, paddingRight: 12 },
  typeChip: { minWidth: 82, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE7E0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', gap: 3 },
  typeChipActive: { backgroundColor: '#E8F5EC', borderColor: '#15803D' },
  typeIcon: { fontSize: 20 },
  typeLabel: { color: '#526159', fontSize: 10, fontWeight: '800' },
  typeLabelActive: { color: '#14532D' },
  instructionStrip: { backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#EDD58D', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 10 },
  instructionTitle: { color: '#62480A', fontSize: 13, fontWeight: '900' },
  instructionText: { color: '#725E2A', fontSize: 11, lineHeight: 16, marginTop: 2 },
  instructionLink: { color: '#7A5700', fontSize: 12, fontWeight: '900' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, gap: 13, borderWidth: 1, borderColor: '#E1E9E3' },
  cardEyebrow: { color: '#15803D', fontSize: 9, letterSpacing: 1, fontWeight: '900' },
  cardTitle: { color: '#17251B', fontSize: 16, fontWeight: '900' },
  description: { color: '#526159', fontSize: 13, lineHeight: 19 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8F5EC', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#15803D', fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, color: '#33443A', fontSize: 12, lineHeight: 18 },
  notice: { backgroundColor: '#E8F5EC', borderLeftWidth: 4, borderLeftColor: '#15803D', borderRadius: 12, padding: 14 },
  noticeTitle: { color: '#14532D', fontSize: 13, fontWeight: '900' },
  noticeText: { color: '#356044', fontSize: 11, lineHeight: 16, marginTop: 4 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  preset: { width: '48%', borderWidth: 1.5, borderColor: '#DDE7E0', borderRadius: 12, padding: 10, backgroundColor: '#FAFCFA' },
  presetActive: { borderColor: '#15803D', backgroundColor: '#E8F5EC' },
  presetName: { color: '#33443A', fontSize: 12, fontWeight: '800' },
  presetNameActive: { color: '#14532D' },
  presetLimit: { color: '#748178', fontSize: 10, marginTop: 3 },
  presetLimitActive: { color: '#15803D', fontWeight: '700' },
  fieldLabel: { color: '#435248', fontSize: 11, fontWeight: '800', marginTop: 2 },
  input: { borderWidth: 1.5, borderColor: '#DDE5DF', borderRadius: 11, backgroundColor: '#FAFCFA', paddingHorizontal: 12, minHeight: 44, color: '#17251B', fontSize: 14 },
  multiline: { minHeight: 82, paddingTop: 11 },
  readingRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#B8CDBE', borderRadius: 13, backgroundColor: '#F8FBF9', paddingHorizontal: 14 },
  readingInput: { flex: 1, height: 58, color: '#102B19', fontSize: 27, fontWeight: '900' },
  degree: { color: '#14532D', fontSize: 20, fontWeight: '900' },
  result: { borderRadius: 10, padding: 10 },
  resultOk: { backgroundColor: '#E8F5EC' },
  resultBad: { backgroundColor: '#FDECEC' },
  resultText: { fontSize: 12, fontWeight: '900' },
  resultTextOk: { color: '#166534' },
  resultTextBad: { color: '#B42318' },
  resultButtons: { flexDirection: 'row', gap: 8 },
  resultButton: { flex: 1, borderWidth: 1.5, borderColor: '#DDE5DF', borderRadius: 11, alignItems: 'center', paddingVertical: 12 },
  resultButtonOk: { backgroundColor: '#15803D', borderColor: '#15803D' },
  resultButtonBad: { backgroundColor: '#B42318', borderColor: '#B42318' },
  resultButtonText: { color: '#526159', fontSize: 12, fontWeight: '900' },
  resultButtonTextActive: { color: '#fff' },
  saveButton: { backgroundColor: '#15803D', minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  auditNote: { color: '#748178', fontSize: 10, textAlign: 'center' },
});
