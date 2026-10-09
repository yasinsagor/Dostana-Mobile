// Same Supabase project as the Dostana management app, so the owner dashboard
// and supplier portal see every order placed here.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fqjblkdolxxawvvyoewr.supabase.co';
export const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_uYyqG984_qGCZkF-T4cOqA_Vlb1ibgU';
export const PORTAL_API = process.env.EXPO_PUBLIC_PORTAL_API_URL || 'https://dostana-web-claude.vercel.app';

export const ORDER_CUTOFF_HOUR = 18;   // order before 18:00 for next-day delivery
export const SPEC_TARGET_PCT = 15;     // SPEC cost above this % of revenue is flagged
export const HISTORY_DAYS = 60;        // history and "usual products" window
export const AI_BRANCHES = ['Lopuszanska']; // AI assistant trial

// Used only when the branch list cannot be loaded and nothing is cached.
export const FALLBACK_BRANCHES = [
  { name: 'Krakowskie Przedmiescie', pin: '1001' },
  { name: 'Turystyczna', pin: '1002' },
  { name: 'Sympatyczna', pin: '1003' },
  { name: 'Kozubszczyzna', pin: '1004' },
  { name: 'Ryki', pin: '1005' },
  { name: 'Lopuszanska', pin: '1006' },
  { name: 'Raszyn', pin: '1007' },
  { name: 'Mlawa', pin: '1008' },
  { name: 'Lodz', pin: '1009' },
  { name: 'Wroclawska', pin: '1010' },
  { name: 'Lubartow', pin: '1011' },
];
