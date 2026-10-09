import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cachedBranches, loadBranches } from './lib/api';
import { FALLBACK_BRANCHES, SUPPLIER_PIN } from './config';

const USER_KEY = 'spec_app_user_v1';
const AuthContext = createContext(null);

async function knownBranches() {
  try {
    const remote = await Promise.race([
      loadBranches(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000)),
    ]);
    if (remote.length) return remote;
  } catch {}
  const cached = await cachedBranches();
  return cached.length ? cached : FALLBACK_BRANCHES;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(USER_KEY)
      .then(raw => { if (raw) setUser(JSON.parse(raw)); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  async function login(pin) {
    const value = String(pin || '').trim();
    if (!value) return { ok: false, error: 'Enter your PIN.' };
    if (value === SUPPLIER_PIN) {
      const supplier = { role: 'supplier' };
      setUser(supplier);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(supplier));
      return { ok: true };
    }
    const branches = await knownBranches();
    const branch = branches.find(b => b.pin === value);
    if (!branch) return { ok: false, error: 'Wrong PIN. Try again.' };
    // The PIN is kept for AI search, which re-checks it on the server.
    const next = { role: 'manager', branch: branch.name, pin: value };
    setUser(next);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
    return { ok: true };
  }

  async function logout() {
    setUser(null);
    await AsyncStorage.removeItem(USER_KEY);
  }

  return <AuthContext.Provider value={{ user, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
