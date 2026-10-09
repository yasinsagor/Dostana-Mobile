/* ─── Product search ─────────────────────────────────────────
   - Polish letters don't matter: "smieci" finds "śmieci", "maka" finds "mąka"
   - Words in any order, each word may be the start of a word: "gouda 2,5", "box 750"
   - One typo allowed in longer words: "majoenz" finds "Majonez"
   - Everyday words work: "fries" → Frytki, "gloves" → Rękawice
   ─────────────────────────────────────────────────────────── */

const NICKNAMES = {
  fries: 'frytki', chips: 'frytki', frites: 'frytki',
  chicken: 'kurczak', lamb: 'baranina', mutton: 'baranina', meat: 'mieso',
  bread: 'pieczywo', bun: 'bulka', buns: 'bulka', wrap: 'tortilla', wraps: 'tortilla', lavash: 'lawasz',
  cheese: 'ser', feta: 'salatkowy', gouda: 'gouda', buttermilk: 'maslanka',
  mayo: 'majonez', mayonnaise: 'majonez', yogurt: 'jogurt', yoghurt: 'jogurt', garlic: 'czosnek',
  sauce: 'sos', sauces: 'sos', hot: 'ostry', spicy: 'ostry', cranberry: 'zurawina', tomato: 'pomidor',
  mustard: 'musztardowo', honey: 'miodowy',
  oil: 'olej', olive: 'oliwa', vinegar: 'ocet', lemon: 'cytryn', salt: 'sol', sugar: 'cukier',
  pepper: 'pieprz', cumin: 'kmin', ginger: 'imbir', turmeric: 'kurkuma', dill: 'koperek', parsley: 'natka',
  flour: 'maka', starch: 'ziemniaczana', semolina: 'manna', soda: 'soda', herbs: 'ziola', paprika: 'papryka',
  onion: 'cebula', rings: 'krazki', corn: 'kukurydza', olives: 'oliwki', pickles: 'ogorki', cucumber: 'ogorki',
  frozen: 'mrozonki', nuggets: 'nuggetsy',
  water: 'woda', drink: 'napoje', drinks: 'napoje', juice: 'nektar',
  napkin: 'serwetki', napkins: 'serwetki', fork: 'widelec', forks: 'widelec', plate: 'talerz', plates: 'talerz',
  bag: 'reklamowka', bags: 'reklamowka', container: 'pojemnik', cup: 'pojemnik', lid: 'wieczko',
  foil: 'folia', wrapfoil: 'folia', envelope: 'koperta',
  glove: 'rekawice', gloves: 'rekawice', towel: 'recznik', towels: 'recznik', paper: 'papierowy',
  trash: 'smieci', garbage: 'smieci', bin: 'smieci', cleaner: 'plyn', floor: 'podlog', bleach: 'domestos',
  receipt: 'rolka', roll: 'rolka', rolls: 'rolka', blade: 'ostrze', knife: 'ostrze',
};

export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } // swapped letters
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

function wordMatches(queryWord, words) {
  return words.some(w => w.startsWith(queryWord)
    || (queryWord.length >= 5 && withinOneEdit(queryWord, w.slice(0, queryWord.length + 1)))
    || (queryWord.length >= 5 && withinOneEdit(queryWord, w)));
}

export function buildSearchIndex(products) {
  const index = new Map();
  products.forEach(p => {
    const text = [p.name, p.category, p.unit, p.pack_size].filter(Boolean).join(' ');
    index.set(p.id, normalize(text).split(' '));
  });
  return index;
}

/* Returns the products that match every word of the query, best matches first. */
export function searchProducts(products, index, query, usage = {}) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return products;
  const scored = [];
  products.forEach(p => {
    const hay = index.get(p.id) || [];
    let score = 0;
    for (const w of words) {
      const alias = NICKNAMES[w];
      if (wordMatches(w, hay)) score += hay[0]?.startsWith(w) ? 3 : 2;
      else if (alias && wordMatches(alias, hay)) score += 2;
      else return;
    }
    scored.push({ p, score: score * 100 + (usage[p.id] || 0) });
  });
  return scored.sort((a, b) => b.score - a.score).map(x => x.p);
}
