import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANCHES, OWNER_PIN, SUPPLIER_PIN, ROLES, setRuntimeBranches } from '../constants';
import { fetchActiveBranches } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      const [rawUser, rawBranches] = await Promise.all([
        AsyncStorage.getItem('dostana_user'),
        AsyncStorage.getItem('dostana_branches'),
      ]);
      if (rawBranches) {
        try { setRuntimeBranches(JSON.parse(rawBranches)); } catch {}
      }
      try {
        const remoteBranches = await Promise.race([
          fetchActiveBranches(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Branch refresh timed out')), 7000)),
        ]);
        if (remoteBranches.length) {
          setRuntimeBranches(remoteBranches);
          await AsyncStorage.setItem('dostana_branches', JSON.stringify(remoteBranches));
        }
      } catch {
        // Cached or bundled branches keep PIN login available while offline.
      }
      if (!active) return;
      if (rawUser) {
        try {
          const cachedUser = JSON.parse(rawUser);
          if (cachedUser.role !== ROLES.MANAGER || BRANCHES.some(branch => branch.name === cachedUser.branch)) setUser(cachedUser);
          else await AsyncStorage.removeItem('dostana_user');
        } catch {}
      }
      setLoading(false);
    }
    void bootstrap();
    return () => { active = false; };
  }, []);

  function login(pin) {
    if (pin === OWNER_PIN) {
      const u = { role: ROLES.OWNER, branch: null, name: 'Owner' };
      setUser(u);
      AsyncStorage.setItem('dostana_user', JSON.stringify(u));
      return { ok: true };
    }
    if (pin === SUPPLIER_PIN) {
      const u = { role: ROLES.SUPPLIER, name: 'Supplier' };
      setUser(u);
      AsyncStorage.setItem('dostana_user', JSON.stringify(u));
      return { ok: true };
    }
    const branch = BRANCHES.find(b => b.pin === pin);
    if (branch) {
      const u = { role: ROLES.MANAGER, branch: branch.name, name: branch.name };
      setUser(u);
      AsyncStorage.setItem('dostana_user', JSON.stringify(u));
      return { ok: true };
    }
    return { ok: false, error: 'Invalid PIN' };
  }

  function logout() {
    setUser(null);
    AsyncStorage.removeItem('dostana_user');
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
