import { useState, useEffect, createContext, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BRANCHES, OWNER_PIN, SUPPLIER_PIN, ROLES } from '../constants';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('dostana_user').then(raw => {
      if (raw) setUser(JSON.parse(raw));
      setLoading(false);
    });
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
