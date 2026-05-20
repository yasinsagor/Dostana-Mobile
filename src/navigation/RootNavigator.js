import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { ROLES, COLORS } from '../constants';
import LoginScreen from '../screens/LoginScreen';
import SplashScreen from '../screens/SplashScreen';
import OwnerNavigator from './OwnerNavigator';
import ManagerNavigator from './ManagerNavigator';
import SupplierNavigator from './SupplierNavigator';

export default function RootNavigator() {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === ROLES.OWNER ? (
        <OwnerNavigator />
      ) : user.role === ROLES.SUPPLIER ? (
        <SupplierNavigator />
      ) : (
        <ManagerNavigator />
      )}
    </NavigationContainer>
  );
}
