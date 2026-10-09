export function haccpCutoff(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const target = new Date(Date.UTC(Number(values.year), Number(values.month) - 4, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(Number(values.day), lastDay));
  return target.toISOString().slice(0, 10);
}

export function expiredHaccp(timestamp, now = new Date()) {
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return false;
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
  return day < haccpCutoff(now);
}
