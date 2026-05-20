/* ─── FALLBACK_PRODUCTS ────────────────────────────────────────
   50 products across Mięso / Sosy / Oleje / Opakowania.
   Prices are realistic PLN estimates.
   ─────────────────────────────────────────────────────────── */
export const FALLBACK_PRODUCTS = [
  // ── Mięso ──────────────────────────────────────────────────
  { id: 'p1',  name: 'Kurczak',                  unit: 'kg',    cat: 'Mięso',      price: 8  },
  { id: 'p2',  name: 'Baranina',                 unit: 'kg',    cat: 'Mięso',      price: 22 },
  { id: 'p3',  name: 'Pita 55',                  unit: 'pckt',  cat: 'Mięso',      price: 20 },
  { id: 'p4',  name: 'Pita 65',                  unit: 'pckt',  cat: 'Mięso',      price: 22 },
  { id: 'p5',  name: 'Pita 110',                 unit: 'pckt',  cat: 'Mięso',      price: 28 },
  { id: 'p6',  name: 'Pita 85',                  unit: 'pckt',  cat: 'Mięso',      price: 24 },
  { id: 'p7',  name: 'Tortilla 30cm',            unit: 'opak',  cat: 'Mięso',      price: 18 },
  { id: 'p8',  name: 'Tortilla 35cm',            unit: 'opak',  cat: 'Mięso',      price: 20 },
  { id: 'p9',  name: 'Lawasz',                   unit: 'opak',  cat: 'Mięso',      price: 15 },
  { id: 'p10', name: 'Bułka',                    unit: 'szt',   cat: 'Mięso',      price: 3  },
  { id: 'p11', name: 'Frytki',                   unit: 'karton',cat: 'Mięso',      price: 45 },
  { id: 'p12', name: 'Cebula',                   unit: 'kg',    cat: 'Mięso',      price: 3  },
  { id: 'p13', name: 'Nuggetsy',                 unit: 'kg',    cat: 'Mięso',      price: 30 },
  { id: 'p14', name: 'Falafel',                  unit: 'kg',    cat: 'Mięso',      price: 25 },

  // ── Sosy ───────────────────────────────────────────────────
  { id: 'p15', name: 'Sos Czosnkowy',            unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p16', name: 'Sos Ostry',                unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p17', name: 'Sos Pomidorowy',           unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p18', name: 'Sos Musztardowo-Miodowy',  unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p19', name: 'Sos Paprykowy Ostry',      unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p20', name: 'Sos Jalapeño',             unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p21', name: 'Sos Serowy',               unit: 'szt',   cat: 'Sosy',       price: 12 },
  { id: 'p22', name: 'Ketchup 10kg',             unit: 'szt',   cat: 'Sosy',       price: 60 },
  { id: 'p23', name: 'Majonez 10kg',             unit: 'szt',   cat: 'Sosy',       price: 65 },
  { id: 'p24', name: 'Jogurt 10kg',              unit: 'szt',   cat: 'Sosy',       price: 40 },
  { id: 'p25', name: 'Ayran',                    unit: 'szt',   cat: 'Sosy',       price: 8  },
  { id: 'p26', name: 'Ostry Sambal 10kg',        unit: 'szt',   cat: 'Sosy',       price: 70 },
  { id: 'p27', name: 'Sos Mango',               unit: 'szt',   cat: 'Sosy',       price: 15 },
  { id: 'p28', name: 'Sos Barbecue',             unit: 'szt',   cat: 'Sosy',       price: 14 },

  // ── Oleje ──────────────────────────────────────────────────
  { id: 'p29', name: 'Olej Rzepakowy',           unit: 'l',     cat: 'Oleje',      price: 7  },
  { id: 'p30', name: 'Olej Słonecznikowy',       unit: 'l',     cat: 'Oleje',      price: 6  },
  { id: 'p31', name: 'Olej do Frytury',          unit: 'szt',   cat: 'Oleje',      price: 25 },
  { id: 'p32', name: 'Olej do Kapusty 5kg',      unit: 'szt',   cat: 'Oleje',      price: 30 },
  { id: 'p33', name: 'Oliwa z Oliwek',           unit: 'l',     cat: 'Oleje',      price: 20 },
  { id: 'p34', name: 'Cynamon',                  unit: 'szt',   cat: 'Oleje',      price: 8  },
  { id: 'p35', name: 'Ocet',                     unit: 'szt',   cat: 'Oleje',      price: 5  },
  { id: 'p36', name: 'Sól',                      unit: 'kg',    cat: 'Oleje',      price: 3  },
  { id: 'p37', name: 'Domestos 5L',              unit: 'szt',   cat: 'Oleje',      price: 18 },
  { id: 'p38', name: 'Woda Niegazowana',         unit: 'pak',   cat: 'Oleje',      price: 12 },
  { id: 'p39', name: 'Ocet Winny',               unit: 'szt',   cat: 'Oleje',      price: 8  },
  { id: 'p40', name: 'Folia Aluminiowa',         unit: 'box',   cat: 'Oleje',      price: 15 },

  // ── Opakowania ─────────────────────────────────────────────
  { id: 'p41', name: 'Opakowanie Małe',          unit: 'szt',   cat: 'Opakowania', price: 10 },
  { id: 'p42', name: 'Opakowanie Duże',          unit: 'szt',   cat: 'Opakowania', price: 15 },
  { id: 'p43', name: 'Tacka',                    unit: 'szt',   cat: 'Opakowania', price: 8  },
  { id: 'p44', name: 'Folie',                    unit: 'szt',   cat: 'Opakowania', price: 6  },
  { id: 'p45', name: 'Torba',                    unit: 'szt',   cat: 'Opakowania', price: 4  },
  { id: 'p46', name: 'Koperta Kebab',            unit: 'szt',   cat: 'Opakowania', price: 10 },
  { id: 'p47', name: 'Box Obiadowy 750ml',       unit: 'szt',   cat: 'Opakowania', price: 15 },
  { id: 'p48', name: 'Kubek Plastikowy 200ml',   unit: 'szt',   cat: 'Opakowania', price: 8  },
  { id: 'p49', name: 'Serwetka 15x15',           unit: 'opak',  cat: 'Opakowania', price: 5  },
  { id: 'p50', name: 'Rękawiczki Nitrylowe L',   unit: 'opak',  cat: 'Opakowania', price: 15 },
];
