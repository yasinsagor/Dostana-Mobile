import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth';
import { useSpec } from '../store';
import { Banner, Button, Card, Header, StatusPill, T } from '../components/ui';
import {
  budgetInfo, canEdit, cutoffInfo, fmtDay, fmtPln, normalizeItems, orderCost, statusOf,
} from '../lib/logic';
import { SPEC_TARGET_PCT } from '../config';

export default function TodayScreen({ navigation }) {
  const { logout } = useAuth();
  const spec = useSpec();
  const { branch, today, todayOrder, lastOrder, totals, origin, products, offline, failed, queued } = spec;
  const [refreshing, setRefreshing] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 60000); return () => clearInterval(t); }, []);

  const cutoff = cutoffInfo();
  const budget = budgetInfo(spec.monthSpend, spec.revenue);

  async function onRefresh() { setRefreshing(true); await spec.refresh(); setRefreshing(false); }

  return (
    <SafeAreaView style={st.safe} edges={['top']}>
      <Header
        title="Dostana SPEC"
        subtitle={`${branch} · ${fmtDay(today)}`}
        right={<TouchableOpacity onPress={logout} hitSlop={10}><Text style={st.logout}>Log out</Text></TouchableOpacity>}
      />
      <ScrollView contentContainerStyle={st.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {offline && <Banner tone="muted" title="No internet" text="Showing the last saved data. Orders are kept on the phone and sent automatically." />}
        {failed.map(f => (
          <Banner key={f.at} tone="danger" title="An order change could not be sent" text={f.error} action="OK" onAction={spec.clearFailed} />
        ))}
        {!todayOrder && <Banner tone={cutoff.tone} text={cutoff.text} />}

        <Card>
          <View style={st.cardHead}>
            <Text style={st.cardTitle}>Today’s order</Text>
            {todayOrder ? <StatusPill status={statusOf(todayOrder)} /> : <View style={st.notSent}><Text style={st.notSentText}>Not sent</Text></View>}
          </View>
          {todayOrder ? (
            <>
              <Text style={st.cardText}>
                {normalizeItems(todayOrder.items).length} lines · ≈ {fmtPln(orderCost(todayOrder, products))}
                {todayOrder.submitted_at ? ` · sent ${new Date(todayOrder.submitted_at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </Text>
              {todayOrder.manager_notification ? <Banner tone="info" title="Message from supplier" text={todayOrder.manager_notification} /> : null}
              <Button
                title={canEdit(todayOrder) ? 'View or edit order' : 'View order'}
                kind="ghost"
                onPress={() => navigation.navigate('Order')}
                style={{ marginTop: 12 }}
              />
            </>
          ) : (
            <>
              <Text style={st.cardText}>
                {totals.count
                  ? `${totals.count} products ready · ≈ ${fmtPln(totals.cost)}${origin?.kind === 'last' ? ` · from ${fmtDay(origin.date)}` : ''}`
                  : 'Nothing selected yet.'}
              </Text>
              <Button title={totals.count ? 'Continue order' : 'Start order'} onPress={() => navigation.navigate('Order')} style={{ marginTop: 12 }} />
            </>
          )}
          {queued.length > 0 && <Text style={st.queued}>Waiting for internet to send. Keep the app open when you are online.</Text>}
        </Card>

        {budget && (
          <Card>
            <View style={st.cardHead}>
              <Text style={st.cardTitle}>This month: {budget.pct}% of revenue</Text>
              <Text style={[st.target, { color: budget.tone === 'ok' ? T.brand : budget.tone === 'warn' ? T.warn : T.danger }]}>target ≤ {SPEC_TARGET_PCT}%</Text>
            </View>
            <View style={st.track}>
              <View style={[st.fill, {
                width: `${Math.min(100, (budget.pct / (SPEC_TARGET_PCT * 1.5)) * 100)}%`,
                backgroundColor: budget.tone === 'ok' ? T.brand : budget.tone === 'warn' ? '#D97706' : T.danger,
              }]} />
              <View style={st.mark} />
            </View>
            <Text style={st.cardText}>{fmtPln(spec.monthSpend)} ordered · {fmtPln(spec.revenue)} revenue</Text>
          </Card>
        )}

        {lastOrder && (
          <Card>
            <View style={st.cardHead}>
              <Text style={st.cardTitle}>Last order · {fmtDay(lastOrder.date)}</Text>
              <StatusPill status={statusOf(lastOrder)} />
            </View>
            <Text style={st.cardText}>{normalizeItems(lastOrder.items).length} lines · ≈ {fmtPln(orderCost(lastOrder, products))}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('History')}><Text style={st.link}>All orders ›</Text></TouchableOpacity>
          </Card>
        )}
        {spec.lastSync && <Text style={st.sync}>Updated {spec.lastSync.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })} · pull down to refresh</Text>}
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.navy },
  content: { padding: 14, gap: 12, backgroundColor: T.bg, flexGrow: 1 },
  logout: { color: 'rgba(255,255,255,0.75)', fontWeight: '800' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 17, fontWeight: '900', color: T.ink, flexShrink: 1 },
  cardText: { fontSize: 14, color: T.inkSoft, lineHeight: 20, marginBottom: 6 },
  notSent: { backgroundColor: T.dangerSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  notSentText: { color: T.danger, fontWeight: '800', fontSize: 12 },
  queued: { marginTop: 10, color: T.warn, fontSize: 12, fontWeight: '700' },
  target: { fontSize: 12, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, backgroundColor: T.bg, overflow: 'hidden', marginVertical: 8 },
  fill: { height: 10, borderRadius: 5 },
  mark: { position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 2, backgroundColor: T.ink, opacity: 0.35 },
  link: { color: T.brand, fontWeight: '900', marginTop: 4 },
  sync: { textAlign: 'center', color: T.muted, fontSize: 12, marginTop: 4 },
});
