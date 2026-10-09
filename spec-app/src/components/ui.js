import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import {
  STATUS, fmtK, isSizedMeat, lineCost, lineQty, meatSizes, num, priceOf, unitOptionFor, unitOptions,
} from '../lib/logic';

export const T = {
  // Dostana Kebab brand: charcoal + turban orange (from the logo). Green stays for actions.
  orange: '#F39228', orangeDark: '#B85F00', orangeSoft: '#FFF4E6',
  brand: '#2E7D32', brandDark: '#1B5E20', brandSoft: '#E8F5E9',
  navy: '#1A1A1A', ink: '#111827', inkSoft: '#4B5563', muted: '#9CA3AF',
  line: '#E5E7EB', bg: '#F3F4F6', card: '#FFFFFF',
  danger: '#B91C1C', dangerSoft: '#FEE2E2', warn: '#92400E', warnSoft: '#FEF3C7',
  info: '#1D4ED8', infoSoft: '#DBEAFE', meat: '#C2410C', meatSoft: '#FFF7ED',
};
const TONES = {
  ok: { fg: T.brandDark, bg: T.brandSoft },
  warn: { fg: T.warn, bg: T.warnSoft },
  danger: { fg: T.danger, bg: T.dangerSoft },
  info: { fg: T.info, bg: T.infoSoft },
  muted: { fg: T.inkSoft, bg: '#E5E7EB' },
};

export function Header({ title, subtitle, right }) {
  return (
    <View style={s.header}>
      <Image source={require('../../assets/logo-mark.png')} style={s.headerMark} resizeMode="contain" />
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>{title}</Text>
        {subtitle ? <Text style={s.headerSub}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Banner({ tone = 'info', title, text, action, onAction }) {
  const c = TONES[tone] || TONES.info;
  return (
    <View style={[s.banner, { backgroundColor: c.bg }]}>
      <View style={{ flex: 1 }}>
        {title ? <Text style={[s.bannerTitle, { color: c.fg }]}>{title}</Text> : null}
        {text ? <Text style={[s.bannerText, { color: c.fg }]}>{text}</Text> : null}
      </View>
      {action ? (
        <TouchableOpacity style={[s.bannerBtn, { borderColor: c.fg }]} onPress={onAction} hitSlop={8}>
          <Text style={[s.bannerBtnText, { color: c.fg }]}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', disabled, style }) {
  const styles = { primary: [s.btn, s.btnPrimary], ghost: [s.btn, s.btnGhost], danger: [s.btn, s.btnDanger] }[kind];
  const text = { primary: s.btnPrimaryText, ghost: s.btnGhostText, danger: s.btnDangerText }[kind];
  return (
    <TouchableOpacity style={[...styles, disabled && { opacity: 0.45 }, style]} onPress={onPress} disabled={disabled} activeOpacity={0.8}>
      <Text style={text}>{title}</Text>
    </TouchableOpacity>
  );
}

export function StatusPill({ status, label }) {
  const cfg = STATUS[status] || STATUS.pending;
  const c = TONES[cfg.tone];
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <View style={[s.pillDot, { backgroundColor: c.fg }]} />
      <Text style={[s.pillText, { color: c.fg }]}>{label || cfg.label}</Text>
    </View>
  );
}

export function Stepper({ value, onChange }) {
  const v = num(value);
  const [typing, setTyping] = useState(null); // keeps "0," or "1." visible while typing decimals
  const set = next => onChange(Math.max(0, Math.round(next * 100) / 100));
  return (
    <View style={s.stepper}>
      <TouchableOpacity style={[s.stepBtn, v <= 0 && { opacity: 0.35 }]} disabled={v <= 0} onPress={() => { setTyping(null); set(v - 1); }} hitSlop={6} accessibilityLabel="Less">
        <Text style={s.stepMinus}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={[s.stepInput, v > 0 && s.stepInputOn]}
        value={typing ?? (v > 0 ? String(v) : '')}
        onChangeText={t => { setTyping(t); set(num(t)); }}
        onBlur={() => setTyping(null)}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={T.muted}
        selectTextOnFocus
      />
      <TouchableOpacity style={[s.stepBtn, s.stepPlus]} onPress={() => { setTyping(null); set(v + 1); }} hitSlop={6} accessibilityLabel="More">
        <Text style={s.stepPlusText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

/* Shows the product photo when the catalogue has one; tap to enlarge. */
export function ProductPhoto({ product, size = 44 }) {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!product?.image_url || broken) return null;
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityLabel={`Photo of ${product.name}`}>
        <Image source={{ uri: product.image_url }} style={[s.thumb, { width: size, height: size }]} onError={() => setBroken(true)} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.photoShade} onPress={() => setOpen(false)}>
          <Image source={{ uri: product.image_url }} style={s.photoBig} resizeMode="contain" />
          <Text style={s.photoCaption}>{product.name}</Text>
        </Pressable>
      </Modal>
    </>
  );
}

function LastHint({ prev, now, suffix }) {
  if (!prev) return null;
  const diff = Math.round((now - prev) * 100) / 100;
  const color = !now ? T.muted : diff > 0 ? T.brand : diff < 0 ? T.danger : T.muted;
  return (
    <Text style={[s.last, { color }]}>
      Last: {prev}{suffix}{now > 0 && diff ? `  ${diff > 0 ? '▲' : '▼'}${Math.abs(diff)}${suffix}` : ''}
    </Text>
  );
}

function MeatSizes({ product, sizes, onSizes }) {
  const current = sizes || {};
  const change = (size, delta) => onSizes({ ...current, [size]: Math.max(0, num(current[size]) + delta) });
  return (
    <View style={s.sizeRow}>
      {meatSizes(product).map(size => {
        const n = num(current[size]);
        return (
          <View key={size} style={[s.sizeCell, n > 0 && s.sizeCellOn]}>
            <TouchableOpacity style={s.sizeTop} onPress={() => change(size, 1)} accessibilityLabel={`Add one ${size} cone`}>
              <Text style={[s.sizeLabel, n > 0 && { color: T.meat }]}>{size}</Text>
              <Text style={[s.sizeQty, n > 0 && { color: T.meat }]}>{n > 0 ? `×${n}` : '+'}</Text>
            </TouchableOpacity>
            {n > 0 && (
              <TouchableOpacity style={s.sizeMinus} onPress={() => change(size, -1)} accessibilityLabel={`Remove one ${size} cone`}>
                <Text style={s.sizeMinusText}>−</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

export const ProductRow = React.memo(function ProductRow({ product, cart, prev, setQty, setUnit, setSizes }) {
  const qty = lineQty(cart, product);
  const sized = isSizedMeat(product);
  const options = unitOptions(product);
  const option = unitOptionFor(product, cart.unit[product.id]);
  const price = priceOf(product);
  const cost = lineCost(cart, product);
  return (
    <View style={[s.row, qty > 0 && s.rowOn]}>
      <View style={s.rowHead}>
        <ProductPhoto product={product} />
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{product.name}</Text>
          <Text style={s.meta}>
            {price ? `${Math.round(price * 100) / 100} PLN / ${sized ? 'kg' : option.label}` : `no price · ${sized ? 'kg' : option.label}`}
            {qty > 0 && cost > 0 ? <Text style={s.metaCost}>{`   ≈ ${fmtK(cost)} PLN`}</Text> : null}
          </Text>
          <LastHint prev={prev} now={qty} suffix={sized ? ' kg' : ''} />
        </View>
        {sized
          ? (qty > 0 ? <View style={s.kgBadge}><Text style={s.kgBadgeText}>{qty} kg</Text></View> : null)
          : <Stepper value={cart.qty[product.id]} onChange={v => setQty(product, v)} />}
      </View>
      {sized && <MeatSizes product={product} sizes={cart.sizes[product.id]} onSizes={v => setSizes(product, v)} />}
      {!sized && options.length > 1 && (
        <View style={s.unitRow}>
          {options.map(o => (
            <TouchableOpacity key={o.unit} style={[s.unitChip, o.unit === option.unit && s.unitChipOn]} onPress={() => setUnit(product, o.unit)}>
              <Text style={[s.unitText, o.unit === option.unit && s.unitTextOn]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
});

export const s = StyleSheet.create({
  header: { backgroundColor: T.navy, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 3, borderBottomColor: T.orange },
  headerMark: { width: 34, height: 40 },
  headerTitle: { color: '#fff', fontSize: 22, fontWeight: '900' },
  headerSub: { color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 2 },

  card: { backgroundColor: T.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: T.line },

  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 12 },
  bannerTitle: { fontSize: 14, fontWeight: '900' },
  bannerText: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  bannerBtn: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  bannerBtnText: { fontSize: 13, fontWeight: '900' },

  btn: { borderRadius: 12, paddingVertical: 15, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: T.brand },
  btnPrimaryText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  btnGhost: { backgroundColor: T.card, borderWidth: 1, borderColor: T.line },
  btnGhostText: { color: T.inkSoft, fontSize: 15, fontWeight: '800' },
  btnDanger: { backgroundColor: T.dangerSoft },
  btnDangerText: { color: T.danger, fontSize: 15, fontWeight: '900' },

  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' },
  pillDot: { width: 7, height: 7, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '800' },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: T.bg, alignItems: 'center', justifyContent: 'center' },
  stepPlus: { backgroundColor: T.brand },
  stepMinus: { fontSize: 22, fontWeight: '800', color: T.inkSoft, marginTop: -2 },
  stepPlusText: { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: -2 },
  stepInput: { width: 52, height: 40, textAlign: 'center', borderWidth: 1, borderColor: T.line, borderRadius: 10, fontSize: 16, fontWeight: '800', color: T.ink, backgroundColor: '#fff', paddingVertical: 0 },
  stepInputOn: { borderColor: T.brand, backgroundColor: T.brandSoft, color: T.brandDark },

  row: { paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: T.card },
  rowOn: { backgroundColor: '#F6FBF6' },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 15, fontWeight: '700', color: T.ink },
  meta: { fontSize: 12, color: T.muted, marginTop: 2 },
  metaCost: { color: T.brandDark, fontWeight: '800' },
  last: { fontSize: 12, marginTop: 3, fontWeight: '700' },
  kgBadge: { backgroundColor: T.meat, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  kgBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  thumb: { borderRadius: 8, backgroundColor: T.bg },
  photoShade: { flex: 1, backgroundColor: 'rgba(15,23,42,0.92)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  photoBig: { width: '100%', height: '70%' },
  photoCaption: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: 14, textAlign: 'center' },

  sizeRow: { flexDirection: 'row', gap: 6, marginTop: 10 },
  sizeCell: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff', overflow: 'hidden' },
  sizeCellOn: { borderColor: T.meat, backgroundColor: T.meatSoft },
  sizeTop: { alignItems: 'center', paddingVertical: 9 },
  sizeLabel: { fontSize: 13, fontWeight: '800', color: T.inkSoft },
  sizeQty: { fontSize: 15, fontWeight: '900', color: T.muted, marginTop: 2 },
  sizeMinus: { borderTopWidth: 1, borderTopColor: '#FED7AA', alignItems: 'center', paddingVertical: 4 },
  sizeMinusText: { fontSize: 18, fontWeight: '900', color: T.meat },

  unitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  unitChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: T.line, backgroundColor: '#fff' },
  unitChipOn: { borderColor: T.brand, backgroundColor: T.brandSoft },
  unitText: { fontSize: 12, fontWeight: '700', color: T.inkSoft },
  unitTextOn: { color: T.brandDark, fontWeight: '900' },
});
