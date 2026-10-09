/* Shareable SPEC order documents: plain text (WhatsApp, SMS, e-mail) and PDF.
   Labels are Polish because they go to the SPEC warehouse; the app UI stays English. */
import { Alert, Share } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, deleteAsync, moveAsync } from 'expo-file-system/legacy';
import { LOGO_DATA_URI } from './logoData';
import { categoryOf, findProduct, fmtPln, normalizeItems, num, orderCost, statusOf } from './logic';

const DAYS = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MONTHS = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
const STATUS_PL = { pending: 'Oczekuje na potwierdzenie', queued: 'Oczekuje na wysłanie', confirmed: 'Potwierdzone', delivered: 'Dostarczone', historical: 'Zamknięte' };

export function plDate(date) {
  const d = new Date(`${date}T12:00:00`);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function plTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function totalQty(r) {
  return /kg$/i.test(r.unit) ? `${r.qty} × ${r.unit}` : `${r.qty} ${r.unit}`.trim();
}
function qtyText(it) {
  const kg = num(it.totalKg);
  return kg ? `${it.qty} × ${it.unit} = ${kg} kg` : `${it.qty} ${it.unit || ''}`.trim();
}

/* Order lines grouped by catalogue category, in catalogue order. */
export function groupLines(order, products) {
  const rank = new Map(products.map((p, i) => [p.id, i]));
  const lines = normalizeItems(order.items).map(it => {
    const p = findProduct(products, it);
    return { ...it, cat: p ? categoryOf(p) : (it.cat || 'Inne'), name: p ? p.name : it.name, rank: p ? rank.get(p.id) : 9999 };
  }).sort((a, b) => a.rank - b.rank);
  const groups = [];
  lines.forEach(l => {
    let g = groups.find(x => x.cat === l.cat);
    if (!g) { g = { cat: l.cat, lines: [] }; groups.push(g); }
    g.lines.push(l);
  });
  return groups;
}

/* Sum of all branches' orders, per product and unit, with who ordered it. */
export function dayTotals(orders, products) {
  const rank = new Map(products.map((p, i) => [p.id, i]));
  const map = new Map();
  orders.forEach(o => normalizeItems(o.items).forEach(it => {
    const p = findProduct(products, it);
    const name = p ? p.name : it.name;
    const key = `${p ? p.id : it.name}|${it.unit || ''}`;
    if (!map.has(key)) map.set(key, { name, unit: it.unit || '', cat: p ? categoryOf(p) : (it.cat || 'Inne'), rank: p ? rank.get(p.id) : 9999, qty: 0, totalKg: 0, branches: [] });
    const row = map.get(key);
    row.qty += num(it.qty);
    row.totalKg += num(it.totalKg);
    row.branches.push(`${o.branch} ${num(it.qty)}`);
  }));
  const rows = [...map.values()].sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const groups = [];
  rows.forEach(r => {
    let g = groups.find(x => x.cat === r.cat);
    if (!g) { g = { cat: r.cat, rows: [] }; groups.push(g); }
    g.rows.push(r);
  });
  return groups;
}

/* ─── text ─────────────────────────────────────────────────── */
export function orderText(order, products) {
  const groups = groupLines(order, products);
  const count = groups.reduce((s, g) => s + g.lines.length, 0);
  const out = [
    '*DOSTANA KEBAB · ZAMÓWIENIE SPEC*',
    `Oddział: *${order.branch}*`,
    `Data: ${plDate(order.date)}${order.submitted_at ? ` · wysłane ${plTime(order.submitted_at)}` : ''}`,
    `Status: ${STATUS_PL[statusOf(order)] || STATUS_PL.pending}`,
    '',
  ];
  groups.forEach(g => {
    out.push(`*${g.cat.toUpperCase()}*`);
    g.lines.forEach(l => out.push(`• ${l.name}: ${qtyText(l)}`));
    out.push('');
  });
  if (order.supplier_note) out.push(`Uwagi oddziału: ${order.supplier_note}`);
  if (order.manager_notification) out.push(`Wiadomość dostawcy: ${order.manager_notification}`);
  const cost = orderCost(order, products);
  out.push(`Pozycji: ${count}${cost ? ` · szacunkowo ${fmtPln(cost)}` : ''}`);
  return out.join('\n');
}

export function dayText(date, orders, products, missing = []) {
  const out = [
    '*DOSTANA KEBAB · ZAMÓWIENIA SPEC*',
    `Data: ${plDate(date)}`,
    `Oddziały: ${orders.length}${missing.length ? ` · brak zamówienia: ${missing.join(', ')}` : ''}`,
    '',
    '*RAZEM DO KOMPLETACJI*',
  ];
  dayTotals(orders, products).forEach(g => {
    out.push('', `*${g.cat.toUpperCase()}*`);
    g.rows.forEach(r => out.push(`• ${r.name}: ${totalQty(r)}${r.totalKg ? ` (${r.totalKg} kg)` : ''}`));
  });
  out.push('', '*ODDZIAŁY*');
  orders.forEach(o => out.push(`• ${o.branch}: ${normalizeItems(o.items).length} poz. · ${STATUS_PL[statusOf(o)] || ''}`));
  return out.join('\n');
}

/* ─── PDF (HTML rendered by expo-print) ───────────────────── */
const CSS = `
  @page { margin: 18mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #1a1a1a; font-size: 12px; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #F39228; padding-bottom: 10px; margin-bottom: 14px; }
  .head img { height: 64px; }
  .head h1 { font-size: 20px; margin: 0; letter-spacing: 1px; }
  .head .sub { color: #F39228; font-weight: 700; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; margin-top: 2px; }
  .meta { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .meta td { padding: 4px 0; font-size: 13px; }
  .meta td:first-child { color: #666; width: 140px; }
  .branch { font-size: 22px; font-weight: 800; }
  table.items { width: 100%; border-collapse: collapse; }
  table.items th { text-align: left; font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #ccc; padding: 6px 4px; }
  table.items td { padding: 6px 4px; border-bottom: 1px solid #eee; font-size: 13px; vertical-align: top; }
  table.items td.qty { font-weight: 800; white-space: nowrap; text-align: right; }
  table.items td.who { color: #555; font-size: 11px; }
  tr.cat td { background: #FFF4E6; color: #B85F00; font-weight: 800; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; border-bottom: none; }
  .check { width: 18px; } .box { display: inline-block; width: 12px; height: 12px; border: 1.5px solid #999; border-radius: 2px; }
  .note { margin-top: 14px; padding: 10px 12px; background: #F6F6F6; border-left: 3px solid #F39228; font-size: 12px; }
  .foot { margin-top: 18px; color: #999; font-size: 10px; display: flex; justify-content: space-between; }
  .sign { margin-top: 28px; display: flex; gap: 40px; font-size: 11px; color: #666; }
  .sign div { flex: 1; border-top: 1px solid #aaa; padding-top: 4px; }
  .page { page-break-before: always; }
`;

function header(subtitle) {
  return `<div class="head"><img src="${LOGO_DATA_URI}"/><div><h1>DOSTANA KEBAB</h1><div class="sub">${esc(subtitle)}</div></div></div>`;
}

function orderSection(order, products) {
  const groups = groupLines(order, products);
  const count = groups.reduce((s, g) => s + g.lines.length, 0);
  const cost = orderCost(order, products);
  const rows = groups.map(g =>
    `<tr class="cat"><td colspan="3">${esc(g.cat)}</td></tr>` +
    g.lines.map(l => `<tr><td class="check"><span class="box"></span></td><td>${esc(l.name)}</td><td class="qty">${esc(qtyText(l))}</td></tr>`).join('')
  ).join('');
  return `
    ${header('Zamówienie SPEC')}
    <table class="meta">
      <tr><td>Oddział</td><td class="branch">${esc(order.branch)}</td></tr>
      <tr><td>Data zamówienia</td><td>${esc(plDate(order.date))}${order.submitted_at ? ` · wysłane ${plTime(order.submitted_at)}` : ''}</td></tr>
      <tr><td>Status</td><td>${esc(STATUS_PL[statusOf(order)] || '')}</td></tr>
      <tr><td>Pozycji</td><td>${count}${cost ? ` · szacunkowo ${esc(fmtPln(cost))}` : ''}</td></tr>
    </table>
    <table class="items"><tr><th></th><th>Produkt</th><th style="text-align:right">Ilość</th></tr>${rows}</table>
    ${order.supplier_note ? `<div class="note"><b>Uwagi oddziału:</b> ${esc(order.supplier_note)}</div>` : ''}
    ${order.manager_notification ? `<div class="note"><b>Wiadomość dostawcy:</b> ${esc(order.manager_notification)}</div>` : ''}
    <div class="sign"><div>Wydał (SPEC)</div><div>Odebrał (oddział)</div></div>`;
}

function footer() {
  const now = new Date();
  return `<div class="foot"><span>Dostana SPEC</span><span>Wygenerowano ${now.getDate()}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()} ${plTime(now.toISOString())}</span></div>`;
}

export function orderHtml(order, products) {
  return `<html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${orderSection(order, products)}${footer()}</body></html>`;
}

export function dayHtml(date, orders, products, missing = []) {
  const totals = dayTotals(orders, products).map(g =>
    `<tr class="cat"><td colspan="4">${esc(g.cat)}</td></tr>` +
    g.rows.map(r => `<tr><td class="check"><span class="box"></span></td><td>${esc(r.name)}</td><td class="qty">${esc(totalQty(r))}${r.totalKg ? `<br/><span style="font-weight:400;color:#666">${r.totalKg} kg</span>` : ''}</td><td class="who">${esc(r.branches.join(' · '))}</td></tr>`).join('')
  ).join('');
  const branches = orders.map(o => `<div class="page">${orderSection(o, products)}${footer()}</div>`).join('');
  return `<html><head><meta charset="utf-8"/><style>${CSS}</style></head><body>
    ${header('Zamówienia SPEC · razem')}
    <table class="meta">
      <tr><td>Data</td><td class="branch">${esc(plDate(date))}</td></tr>
      <tr><td>Oddziały</td><td>${orders.length} zamówień${missing.length ? ` · brak: ${esc(missing.join(', '))}` : ''}</td></tr>
    </table>
    <table class="items"><tr><th></th><th>Produkt</th><th style="text-align:right">Razem</th><th>Oddziały</th></tr>${totals}</table>
    ${footer()}
    ${branches}
  </body></html>`;
}

/* ─── sharing ──────────────────────────────────────────────── */
function safeName(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9_-]+/g, '_');
}

export async function sharePdf(html, name) {
  const { uri } = await Print.printToFileAsync({ html });
  let target = uri;
  try {
    // A readable file name shows up in WhatsApp / e-mail instead of a random id.
    const dest = `${cacheDirectory}${safeName(name)}.pdf`;
    await deleteAsync(dest, { idempotent: true });
    await moveAsync({ from: uri, to: dest });
    target = dest;
  } catch {}
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this phone.');
  await Sharing.shareAsync(target, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name });
}

export async function shareText(text, title) {
  await Share.share({ message: text, title });
}

/* Asks "PDF or text?" and shares. make() returns { html, text, name }. */
export function askShare(title, make) {
  const run = async kind => {
    try {
      const doc = make();
      if (kind === 'pdf') await sharePdf(doc.html, doc.name);
      else await shareText(doc.text, doc.name);
    } catch (e) {
      Alert.alert('Could not share', e.message || 'Please try again.');
    }
  };
  Alert.alert(title, 'PDF looks like a printed document. Text is best for WhatsApp or SMS.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Text', onPress: () => run('text') },
    { text: 'PDF', onPress: () => run('pdf') },
  ]);
}

export function orderDocument(order, products) {
  return { html: orderHtml(order, products), text: orderText(order, products), name: `SPEC_${order.branch}_${order.date}` };
}
export function dayDocument(date, orders, products, missing) {
  return { html: dayHtml(date, orders, products, missing), text: dayText(date, orders, products, missing), name: `SPEC_wszystkie_oddzialy_${date}` };
}
