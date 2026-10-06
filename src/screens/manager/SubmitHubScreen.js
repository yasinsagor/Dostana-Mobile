import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import ManagerSubmitScreen from './SubmitScreen';
import ManagerSpecScreen from './SpecScreen';
import ManagerOrderAssistantScreen from './OrderAssistantScreen';
import { COLORS } from '../../constants';

export default function ManagerSubmitHubScreen({ route }) {
  const requestedTab = route?.params?.tab;
  const [tab, setTab] = useState(['spec', 'assistant'].includes(requestedTab) ? requestedTab : 'report');
  const [assistantDraft, setAssistantDraft] = useState(null);
  useEffect(() => {
    if (route?.params?.tab) setTab(['spec', 'assistant'].includes(route.params.tab) ? route.params.tab : 'report');
  }, [route?.params?.tab]);

  function reviewAssistantDraft(draft) {
    setAssistantDraft({ ...draft, nonce: Date.now() });
    setTab('spec');
  }

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'report' && styles.tabActive]} onPress={() => setTab('report')}>
          <Text style={[styles.label, tab === 'report' && styles.labelActive]}>📝 Report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'spec' && styles.tabActive]} onPress={() => setTab('spec')}>
          <Text style={[styles.label, tab === 'spec' && styles.labelActive]}>📦 SPEC Order</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'assistant' && styles.tabActive]} onPress={() => setTab('assistant')}>
          <Text style={[styles.label, tab === 'assistant' && styles.labelActive]}>✨ AI Assistant</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {tab === 'report' && <ManagerSubmitScreen />}
        {tab === 'assistant' && <ManagerOrderAssistantScreen onReviewOrder={reviewAssistantDraft} />}
        {tab === 'spec' && <ManagerSpecScreen initialDraft={assistantDraft} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F4F6F8' },
  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary, backgroundColor: '#F0FFF4' },
  label: { fontSize: 14, fontWeight: '700', color: '#777' },
  labelActive: { color: COLORS.primary, fontWeight: '900' },
  content: { flex: 1 },
});
