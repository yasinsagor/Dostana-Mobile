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
import {
  deactivateHaccpEquipment,
  fetchHaccpCompletion,
  fetchHaccpEquipment,
  fetchHaccpInstructions,
  insertHaccpEntry,
  saveHaccpEquipment,
} from '../../lib/supabase';
import { COLORS } from '../../constants';

const REGISTER_TYPES = [
  { code: 'temperature', label: 'Temperature', icon: '🌡️' },
  { code: 'pest_control', label: 'Pests', icon: '🔎' },
  { code: 'cleaning_room', label: 'Cleaning rooms', icon: '🧹' },
  { code: 'cleaning_equipment', label: 'Cleaning equipment', icon: '🧼' },
];

const EQUIPMENT_GROUPS = [
  {
    key: 'fridge',
    label: 'Fridge',
    register_type: 'temperature',
    unit: 'C',
    min: 2,
    max: 8,
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Safe range: +2 to +8°C. Exact logging frequency is not specified in the uploaded book, so set it here for this branch.',
  },
  {
    key: 'freezer',
    label: 'Freezer',
    register_type: 'temperature',
    unit: 'C',
    min: null,
    max: -18,
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Safe limit: -18°C or colder. Exact logging frequency is not specified in the uploaded book, so set it here for this branch.',
  },
  {
    key: 'bemar',
    label: 'Bemar / hot hold',
    register_type: 'temperature',
    unit: 'C',
    min: 60,
    max: 65,
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Safe range: +60 to +65°C. Exact logging frequency is not specified in the uploaded book, so set it here for this branch.',
  },
  {
    key: 'room',
    label: 'Room cleaning',
    register_type: 'cleaning_room',
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Confirm the room was cleaned and disinfected. Exact cleaning frequency is not specified in the uploaded book, so set it here for this branch.',
  },
  {
    key: 'machine_tool',
    label: 'Machine / tool',
    register_type: 'cleaning_equipment',
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Confirm machines, knives, boards and work tools were washed, disinfected and dried. Set the required frequency for this branch.',
  },
  {
    key: 'cold_unit',
    label: 'Cold unit cleaning',
    register_type: 'cleaning_equipment',
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Confirm fridge/freezer/cold unit surfaces were cleaned and disinfected. Set the required frequency for this branch.',
  },
  {
    key: 'pest_area',
    label: 'Pest check area',
    register_type: 'pest_control',
    frequency_count: 1,
    frequency_unit: 'day',
    instructions: 'Check the configured area for pest activity. Exact check frequency is not specified in the uploaded book, so set it here for this branch.',
  },
];

const FALLBACK_INSTRUCTIONS = [
  {
    code: 'temperature',
    register_type: 'temperature',
    title: 'Temperature register',
    description: 'Each branch sets its own fridges, freezers and bemars. The uploaded book gives limits, but not exact input frequency, so the manager sets the frequency.',
    steps: ['Fridge: +2 to +8°C.', 'Freezer: -18°C or below.', 'Bemar / hot holding: +60 to +65°C.', 'If outside limit, write corrective action before saving.'],
  },
  {
    code: 'cleaning_room',
    register_type: 'cleaning_room',
    title: 'Room cleaning and disinfection',
    description: 'Rooms are configured branch by branch. The manager sets how often each cleaning/disinfection register must be completed.',
    steps: ['Remove waste and food residues.', 'Wash, disinfect and let surfaces dry.', 'Record initials/name and any issue found.'],
  },
  {
    code: 'cleaning_equipment',
    register_type: 'cleaning_equipment',
    title: 'Machines, tools and cold units',
    description: 'Managers add the machines, tools and cold units used in their branch and set the required frequency.',
    steps: ['Switch off equipment safely where needed.', 'Wash, rinse, disinfect and dry.', 'Report faults immediately.'],
  },
  {
    code: 'pest_control',
    register_type: 'pest_control',
    title: 'Pest control register',
    description: 'Check configured pest-control areas. The manager sets the required frequency because the uploaded book does not define exact counts.',
    steps: ['Check storage, waste area and entry points.', 'Protect food immediately if evidence is found.', 'Write action taken before saving.'],
  },
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(value) {
  if (!String(value).trim()) return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function limitText(item) {
  if (!item) return '';
  const min = item.minimum_limit ?? item.min;
  const max = item.maximum_limit ?? item.max;
  if (min != null && max != null) return `${min}°C to ${max}°C`;
  if (min != null) return `minimum ${min}°C`;
  if (max != null) return `maximum ${max}°C`;
  return 'no numeric limit';
}

function frequencyLabel(item) {
  const count = Number(item?.frequency_count || 1);
  const unit = item?.frequency_unit || 'day';
  if (unit === 'day') return count === 1 ? '1 time per day' : `${count} times per day`;
  if (unit === 'week') return count === 1 ? '1 time per week' : `${count} times per week`;
  return count === 1 ? '1 time per month' : `${count} times per month`;
}

function groupConfig(key) {
  return EQUIPMENT_GROUPS.find(item => item.key === key) || EQUIPMENT_GROUPS[0];
}

function compliantTemperature(reading, item) {
  if (reading == null || !item) return null;
  const min = item.minimum_limit ?? item.min;
  const max = item.maximum_limit ?? item.max;
  if (min != null && reading < min) return false;
  if (max != null && reading > max) return false;
  return true;
}

export default function HaccpScreen() {
  const { user } = useAuth();
  const branch = user?.branch || '';
  const [mode, setMode] = useState('record');
  const [type, setType] = useState('temperature');
  const [instructions, setInstructions] = useState(FALLBACK_INSTRUCTIONS);
  const [equipment, setEquipment] = useState([]);
  const [completion, setCompletion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedEquipmentId, setSelectedEquipmentId] = useState(null);
  const [submittedBy, setSubmittedBy] = useState('');
  const [subject, setSubject] = useState('');
  const [reading, setReading] = useState('');
  const [manualCompliant, setManualCompliant] = useState(true);
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [recheckReading, setRecheckReading] = useState('');
  const [notes, setNotes] = useState('');

  const [setupGroup, setSetupGroup] = useState('fridge');
  const [setupName, setSetupName] = useState('');
  const [setupCount, setSetupCount] = useState('1');
  const [setupUnit, setSetupUnit] = useState('day');
  const [setupInstructions, setSetupInstructions] = useState(EQUIPMENT_GROUPS[0].instructions);

  async function loadData() {
    setLoading(true);
    try {
      const [instructionRows, equipmentRows, completionRows] = await Promise.all([
        fetchHaccpInstructions().catch(() => []),
        fetchHaccpEquipment(branch).catch(() => []),
        fetchHaccpCompletion(branch, todayStr()).catch(() => []),
      ]);
      if (instructionRows.length) setInstructions(instructionRows);
      setEquipment(equipmentRows);
      setCompletion(completionRows);
      const first = equipmentRows.find(item => item.register_type === type);
      setSelectedEquipmentId(first?.id || null);
      setSubject(first?.name || '');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const selectedEquipment = equipment.find(item => item.id === selectedEquipmentId);
  const equipmentForType = equipment.filter(item => item.register_type === type);
  const activeInstruction = instructions.find(item => item.register_type === type) || FALLBACK_INSTRUCTIONS.find(item => item.register_type === type);
  const isTemperature = type === 'temperature';
  const numericReading = parseNumber(reading);
  const temperatureOk = compliantTemperature(numericReading, selectedEquipment);
  const isCompliant = isTemperature ? temperatureOk : manualCompliant;
  const missingDaily = completion.filter(item => !item.is_complete);
  const dailyConfigured = completion.length > 0;
  const dailyComplete = dailyConfigured && missingDaily.length === 0;

  function resetRecord(nextType = type) {
    const first = equipment.find(item => item.register_type === nextType);
    setSelectedEquipmentId(first?.id || null);
    setSubject(first?.name || '');
    setReading('');
    setManualCompliant(true);
    setCorrectiveAction('');
    setRecheckReading('');
    setNotes('');
  }

  function changeType(nextType) {
    setType(nextType);
    resetRecord(nextType);
  }

  function chooseEquipment(item) {
    setSelectedEquipmentId(item.id);
    setSubject(item.name);
    setReading('');
    setCorrectiveAction('');
    setRecheckReading('');
    setManualCompliant(true);
  }

  function changeSetupGroup(nextGroup) {
    const cfg = groupConfig(nextGroup);
    setSetupGroup(nextGroup);
    setSetupUnit(cfg.frequency_unit);
    setSetupCount(String(cfg.frequency_count));
    setSetupInstructions(cfg.instructions);
  }

  async function addEquipment() {
    const cfg = groupConfig(setupGroup);
    const name = setupName.trim();
    if (!name) return Alert.alert('Name required', 'Example: Fridge 1, Freezer kitchen, Bemar front, Main room.');
    setSaving(true);
    try {
      await saveHaccpEquipment({
        branch,
        register_type: cfg.register_type,
        equipment_group: cfg.key,
        name,
        minimum_limit: cfg.min ?? null,
        maximum_limit: cfg.max ?? null,
        unit: cfg.unit || null,
        frequency_count: Math.max(1, Number(setupCount) || 1),
        frequency_unit: setupUnit,
        instructions: setupInstructions.trim() || cfg.instructions,
      });
      setSetupName('');
      await loadData();
      Alert.alert('Added', `${name} was added for ${branch}.`);
    } catch (error) {
      Alert.alert('Could not add', error?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function removeEquipment(item) {
    Alert.alert('Remove from active HACCP setup?', item.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deactivateHaccpEquipment(item.id);
            await loadData();
          } catch (error) {
            Alert.alert('Could not remove', error?.message || 'Please try again.');
          }
        },
      },
    ]);
  }

  async function submitRecord() {
    const person = submittedBy.trim();
    const itemName = subject.trim();
    if (!person) return Alert.alert('Name required', 'Enter manager name or initials.');
    if (!itemName) return Alert.alert('Subject required', 'Select configured equipment or enter the subject.');
    if (equipmentForType.length && !selectedEquipment) return Alert.alert('Select setup item', 'Choose the fridge, freezer, room, tool or pest area for this check.');
    if (isTemperature && numericReading == null) return Alert.alert('Temperature required', 'Enter a valid measured temperature.');
    if (isCompliant === null) return Alert.alert('Complete the check', 'Enter the measurement or select a result.');
    if (!isCompliant && correctiveAction.trim().length < 3) {
      return Alert.alert('Corrective action required', 'Write what was moved, isolated, disposed, cleaned, rejected or reported.');
    }

    setSaving(true);
    try {
      await insertHaccpEntry({
        branch,
        register_type: type,
        instruction_code: activeInstruction?.code || type,
        submitted_by: person,
        subject: itemName,
        reading: isTemperature ? numericReading : null,
        unit: isTemperature ? 'C' : null,
        minimum_limit: isTemperature ? selectedEquipment?.minimum_limit ?? null : null,
        maximum_limit: isTemperature ? selectedEquipment?.maximum_limit ?? null : null,
        is_compliant: Boolean(isCompliant),
        corrective_action: isCompliant ? null : correctiveAction.trim(),
        recheck_reading: isTemperature ? parseNumber(recheckReading) : null,
        notes: notes.trim() || null,
        details: {
          equipment_id: selectedEquipment?.id || null,
          equipment_name: selectedEquipment?.name || itemName,
          equipment_group: selectedEquipment?.equipment_group || null,
          frequency: selectedEquipment ? frequencyLabel(selectedEquipment) : null,
          instruction_title: activeInstruction?.title || null,
        },
        source: 'mobile',
      });
      Alert.alert('Saved', 'This HACCP/GMP record is saved and visible in the web portal.');
      resetRecord();
      await loadData();
    } catch (error) {
      Alert.alert('Could not save', error?.message || 'Check connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>HACCP / GMP Register</Text>
            <Text style={styles.subtitle}>{branch || 'Branch'} · manager signed records</Text>
          </View>
          <Text style={styles.badge}>{dailyComplete ? '✓' : '!'}</Text>
        </View>

        <View style={styles.modeTabs}>
          {[
            ['record', 'New record'],
            ['setup', 'Equipment setup'],
            ['instructions', 'Instructions'],
          ].map(([key, label]) => (
            <TouchableOpacity key={key} style={[styles.modeTab, mode === key && styles.modeTabActive]} onPress={() => setMode(key)}>
              <Text style={[styles.modeText, mode === key && styles.modeTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /><Text style={styles.muted}>Loading HACCP setup...</Text></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {mode === 'record' && (
              <>
                <DailyStatus configured={dailyConfigured} complete={dailyComplete} missing={missingDaily} onSetup={() => setMode('setup')} />
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
                  <View style={styles.notice}>
                    <Text style={styles.noticeTitle}>{activeInstruction.title || 'Instruction'}</Text>
                    <Text style={styles.noticeText}>{activeInstruction.description}</Text>
                  </View>
                )}

                {equipmentForType.length > 0 && (
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>Select configured item</Text>
                    {equipmentForType.map(item => (
                      <TouchableOpacity key={item.id} style={[styles.equipmentRow, selectedEquipmentId === item.id && styles.equipmentRowActive]} onPress={() => chooseEquipment(item)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.equipmentName}>{item.name}</Text>
                          <Text style={styles.equipmentMeta}>{groupConfig(item.equipment_group).label} · {frequencyLabel(item)}{item.register_type === 'temperature' ? ` · ${limitText(item)}` : ''}</Text>
                        </View>
                        <Text style={styles.checkMark}>{selectedEquipmentId === item.id ? '✓' : ''}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {equipmentForType.length === 0 && ['temperature', 'cleaning_room', 'cleaning_equipment', 'pest_control'].includes(type) && (
                  <TouchableOpacity style={styles.warning} onPress={() => setMode('setup')}>
                    <Text style={styles.warningTitle}>No branch setup for this register</Text>
                    <Text style={styles.warningText}>Tap here to add the branch fridges, freezers, rooms, tools, cold units or pest areas first.</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.card}>
                  <Field label="Completed by / initials" value={submittedBy} onChangeText={setSubmittedBy} placeholder="Manager name or initials" />
                  <Field label={isTemperature ? 'Equipment / food' : 'Subject'} value={subject} onChangeText={setSubject} placeholder="Select above or type subject" />

                  {isTemperature ? (
                    <>
                      <Text style={styles.fieldLabel}>Measured temperature</Text>
                      <View style={styles.readingRow}>
                        <TextInput style={styles.readingInput} value={reading} onChangeText={setReading} keyboardType="decimal-pad" placeholder="0.0" placeholderTextColor="#AAB4AD" />
                        <Text style={styles.degree}>°C</Text>
                      </View>
                      {selectedEquipment && <Text style={styles.helper}>Required limit: {limitText(selectedEquipment)}</Text>}
                      {temperatureOk !== null && (
                        <View style={[styles.result, temperatureOk ? styles.resultOk : styles.resultBad]}>
                          <Text style={[styles.resultText, temperatureOk ? styles.resultTextOk : styles.resultTextBad]}>
                            {temperatureOk ? '✓ Within HACCP limit' : `! Outside ${limitText(selectedEquipment)}`}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.fieldLabel}>Result</Text>
                      <View style={styles.resultButtons}>
                        <TouchableOpacity style={[styles.resultButton, manualCompliant && styles.resultButtonOk]} onPress={() => setManualCompliant(true)}>
                          <Text style={[styles.resultButtonText, manualCompliant && styles.resultButtonTextActive]}>✓ Completed / OK</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.resultButton, !manualCompliant && styles.resultButtonBad]} onPress={() => setManualCompliant(false)}>
                          <Text style={[styles.resultButtonText, !manualCompliant && styles.resultButtonTextActive]}>! Issue found</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {isCompliant === false && (
                    <>
                      <Field label="Corrective action (required)" value={correctiveAction} onChangeText={setCorrectiveAction} placeholder="Moved product, disposed, called service, cleaned again..." multiline />
                      {isTemperature && <Field label="Recheck temperature (optional)" value={recheckReading} onChangeText={setRecheckReading} placeholder="0.0 °C" keyboardType="decimal-pad" />}
                    </>
                  )}
                  <Field label="Notes (optional)" value={notes} onChangeText={setNotes} placeholder="Extra details for inspection record" multiline />
                </View>

                <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={submitRecord} disabled={saving} activeOpacity={0.8}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save signed HACCP/GMP record</Text>}
                </TouchableOpacity>
              </>
            )}

            {mode === 'setup' && (
              <>
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>Branch equipment setup</Text>
                  <Text style={styles.noticeText}>Add exactly what this location has. The uploaded HACCP/GMP-GHP book does not define exact daily/weekly/monthly counts, so set the required frequency here for each item.</Text>
                </View>
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Add item</Text>
                  <Text style={styles.sectionLabel}>TYPE</Text>
                  <View style={styles.groupGrid}>
                    {EQUIPMENT_GROUPS.map(item => (
                      <TouchableOpacity key={item.key} style={[styles.groupChip, setupGroup === item.key && styles.groupChipActive]} onPress={() => changeSetupGroup(item.key)}>
                        <Text style={[styles.groupText, setupGroup === item.key && styles.groupTextActive]}>{item.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Field label="Name" value={setupName} onChangeText={setSetupName} placeholder="Example: Fridge 1, Freezer back, Bemar front" />
                  <View style={styles.twoCols}>
                    <Field label="How many times" value={setupCount} onChangeText={setSetupCount} keyboardType="number-pad" placeholder="1" />
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={styles.fieldLabel}>Period</Text>
                      <View style={styles.periodRow}>
                        {['day', 'week', 'month'].map(unit => (
                          <TouchableOpacity key={unit} style={[styles.periodChip, setupUnit === unit && styles.periodChipActive]} onPress={() => setSetupUnit(unit)}>
                            <Text style={[styles.periodText, setupUnit === unit && styles.periodTextActive]}>{unit}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  <Field label="Instruction shown to manager" value={setupInstructions} onChangeText={setSetupInstructions} multiline />
                  <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.65 }]} onPress={addEquipment} disabled={saving}>
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add to this branch</Text>}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Active setup for {branch}</Text>
                  {equipment.length === 0 ? (
                    <Text style={styles.muted}>No equipment or register items added yet.</Text>
                  ) : equipment.map(item => (
                    <View key={item.id} style={styles.setupListRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.equipmentName}>{item.name}</Text>
                        <Text style={styles.equipmentMeta}>{groupConfig(item.equipment_group).label} · {frequencyLabel(item)}{item.register_type === 'temperature' ? ` · ${limitText(item)}` : ''}</Text>
                      </View>
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removeEquipment(item)}>
                        <Text style={styles.removeTxt}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </>
            )}

            {mode === 'instructions' && (
              <>
                <View style={styles.notice}>
                  <Text style={styles.noticeTitle}>Based on your HACCP + GMP/GHP book</Text>
                  <Text style={styles.noticeText}>This app stores the signed register. The full approved book remains the controlling document for inspection.</Text>
                </View>
                {instructions.map((item, index) => (
                  <View key={item.code || `${item.register_type}-${index}`} style={styles.card}>
                    <Text style={styles.cardEyebrow}>PROCEDURE {index + 1}</Text>
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
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Current branch frequency setup</Text>
                  {equipment.length === 0 ? <Text style={styles.muted}>No branch items configured yet.</Text> : equipment.map(item => (
                    <Text key={item.id} style={styles.instructionLine}>• {item.name}: {frequencyLabel(item)}{item.instructions ? ` — ${item.instructions}` : ''}</Text>
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DailyStatus({ configured, complete, missing, onSetup }) {
  if (!configured) {
    return (
      <TouchableOpacity style={styles.warning} onPress={onSetup}>
        <Text style={styles.warningTitle}>HACCP setup required before reports</Text>
        <Text style={styles.warningText}>Add branch fridges, freezers, bemars, rooms/tools/cold units and pest areas first.</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View style={[styles.notice, complete ? styles.noticeOk : styles.noticeBad]}>
      <Text style={styles.noticeTitle}>{complete ? 'Daily HACCP complete' : 'Daily HACCP not complete'}</Text>
      <Text style={styles.noticeText}>
        {complete ? 'The daily report can be submitted for today.' : `Missing: ${missing.slice(0, 4).map(item => item.requirement_name).join(', ')}${missing.length > 4 ? '...' : ''}`}
      </Text>
    </View>
  );
}

function Field({ label, multiline, style, ...props }) {
  return (
    <View style={[{ gap: 6, flex: 1 }, style]}>
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
  badge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#D6A52A', color: '#fff', textAlign: 'center', textAlignVertical: 'center', fontSize: 21, fontWeight: '900', overflow: 'hidden' },
  modeTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#DDE7E0' },
  modeTab: { flex: 1, alignItems: 'center', paddingVertical: 13, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  modeTabActive: { borderBottomColor: '#15803D' },
  modeText: { color: '#647067', fontSize: 12, fontWeight: '800' },
  modeTextActive: { color: '#14532D' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  content: { padding: 14, gap: 12, paddingBottom: 36 },
  sectionLabel: { color: '#647067', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  typeRow: { gap: 8, paddingRight: 12 },
  typeChip: { minWidth: 82, backgroundColor: '#fff', borderWidth: 1, borderColor: '#DDE7E0', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', gap: 3 },
  typeChipActive: { backgroundColor: '#E8F5EC', borderColor: '#15803D' },
  typeIcon: { fontSize: 20 },
  typeLabel: { color: '#526159', fontSize: 10, fontWeight: '800' },
  typeLabelActive: { color: '#14532D' },
  notice: { backgroundColor: '#FFF8E7', borderWidth: 1, borderColor: '#EDD58D', borderRadius: 14, padding: 13 },
  noticeOk: { backgroundColor: '#E8F5EC', borderColor: '#B7E2C3' },
  noticeBad: { backgroundColor: '#FDECEC', borderColor: '#F6B4B4' },
  noticeTitle: { color: '#14532D', fontSize: 13, fontWeight: '900' },
  noticeText: { color: '#356044', fontSize: 11, lineHeight: 16, marginTop: 4 },
  warning: { backgroundColor: '#FDECEC', borderLeftWidth: 4, borderLeftColor: '#B42318', borderRadius: 14, padding: 14 },
  warningTitle: { color: '#8A1C16', fontSize: 13, fontWeight: '900' },
  warningText: { color: '#7A2E28', fontSize: 11, lineHeight: 16, marginTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 15, gap: 13, borderWidth: 1, borderColor: '#E1E9E3' },
  cardEyebrow: { color: '#15803D', fontSize: 9, letterSpacing: 1, fontWeight: '900' },
  cardTitle: { color: '#17251B', fontSize: 16, fontWeight: '900' },
  description: { color: '#526159', fontSize: 13, lineHeight: 19 },
  muted: { color: '#748178', fontSize: 12 },
  helper: { color: '#647067', fontSize: 11 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNumber: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8F5EC', alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: '#15803D', fontSize: 11, fontWeight: '900' },
  stepText: { flex: 1, color: '#33443A', fontSize: 12, lineHeight: 18 },
  equipmentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: '#DDE7E0', borderRadius: 12, padding: 12, backgroundColor: '#FAFCFA' },
  equipmentRowActive: { borderColor: '#15803D', backgroundColor: '#E8F5EC' },
  equipmentName: { color: '#17251B', fontSize: 13, fontWeight: '900' },
  equipmentMeta: { color: '#66746C', fontSize: 10, marginTop: 3 },
  checkMark: { color: '#15803D', fontSize: 18, fontWeight: '900' },
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
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  groupChip: { borderWidth: 1.5, borderColor: '#DDE5DF', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#FAFCFA' },
  groupChipActive: { backgroundColor: '#15803D', borderColor: '#15803D' },
  groupText: { color: '#526159', fontSize: 11, fontWeight: '900' },
  groupTextActive: { color: '#fff' },
  twoCols: { flexDirection: 'row', gap: 10 },
  periodRow: { flexDirection: 'row', gap: 5, minHeight: 44 },
  periodChip: { flex: 1, borderWidth: 1.5, borderColor: '#DDE5DF', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  periodChipActive: { backgroundColor: '#E8F5EC', borderColor: '#15803D' },
  periodText: { color: '#526159', fontSize: 10, fontWeight: '900' },
  periodTextActive: { color: '#14532D' },
  setupListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: '#EEF3F0', paddingBottom: 10 },
  removeBtn: { backgroundColor: '#FDECEC', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  removeTxt: { color: '#B42318', fontSize: 10, fontWeight: '900' },
  instructionLine: { color: '#33443A', fontSize: 12, lineHeight: 18 },
});
