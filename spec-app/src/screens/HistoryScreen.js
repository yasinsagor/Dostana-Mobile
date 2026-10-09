import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSpec } from '../store';
import { Banner, Button, Card, Header, StatusPill, T } from '../components/ui';
import { fmtDay, fmtPln, normalizeItems, orderCost, statusOf } from '../lib/logic';
import { HISTORY_DAYS } from '../config';

export default function HistoryScreen({ navigation }) {
  const spec = useSpec();
  const { orders, products, todayOrder, today } = spec;
  const [open, setOpen] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  function reorder(order) {
    if (todayOrder) {
      Alert.alert('Today’s order is already sent', 'Open Today to view or edit it.');
      return;
    }
    spec.loadItems(order.items, { kind: 'reorder', date: order.date });
    navigation.navigate('Order');
  }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header title="My orders" subtitle={`Last ${HISTORY_DAYS} days · ${orders.length} order${orders.length === 1 ? '' : 's'}`} />
      <ScrollView
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await spec.refresh(); setRefreshing(false); }} />}
      >
        {orders.length === 0 && <Banner tone="muted" title="No orders yet" text="Orders you send appear here with their status." />}
        {orders.map(o => {
          const items = normalizeItems(o.items);
          const isOpen = open === o.date;
          return (
            <Card key={o.date} style={{ padding: 0 }}>
              <TouchableOpacity style={st.head} onPress={() => setOpen(isOpen ? null : o.date)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={st.date}>{o.date === today ? 'Today' : fmtDay(o.date)}</Text>
                  <Text style={st.meta}>{items.length} lines · ≈ {fmtPln(orderCost(o, products))}</Text>
                </View>
                <StatusPill status={statusOf(o)} />
                <Text style={st.chev}>{isOpen ? '▴' : '▾'}</Text>
              </TouchableOpacity>
              {isOpen && (
                <View style={st.body}>
                  {o.manager_notification ? <Banner tone="info" title="Message from supplier" text={o.manager_notification} /> : null}
                  {items.map((it, i) => (
                    <View key={`${it.name}-${it.unit}-${i}`} style={st.line}>
                      <Text style={st.lineName}>{it.name}</Text>
                      <Text style={st.lineQty}>{it.qty} × {it.unit}{it.totalKg ? ` (${it.totalKg} kg)` : ''}</Text>
                    </View>
                  ))}
                  {o.supplier_note ? <Text style={st.note}>Note: {o.supplier_note}</Text> : null}
                  {o.date !== today && <Button title="Order the same again" kind="ghost" onPress={() => reorder(o)} style={{ marginTop: 10 }} />}
                </View>
              )}
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  content: { padding: 14, gap: 10, backgroundColor: T.bg, flexGrow: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },
  date: { fontSize: 16, fontWeight: '900', color: T.ink },
  meta: { fontSize: 13, color: T.inkSoft, marginTop: 2 },
  chev: { color: T.muted, fontSize: 16, marginLeft: 2 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 4 },
  line: { flexDirection: 'row', gap: 8, paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  lineName: { flex: 1, fontSize: 14, color: T.ink },
  lineQty: { fontSize: 14, fontWeight: '800', color: T.ink },
  note: { marginTop: 8, color: T.inkSoft, fontStyle: 'italic' },
});
