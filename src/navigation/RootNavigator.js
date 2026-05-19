import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { ROLES, COLORS } from '../constants';
import LoginScreen from '../screens/LoginScreen';
import OwnerNavigator from './OwnerNavigator';
import ManagerNavigator from './ManagerNavigator';

export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <LoginScreen />
      ) : user.role === ROLES.OWNER ? (
        <OwnerNavigator />
      ) : (
        <ManagerNavigator />
      )}
    </NavigationContainer>
  );
}
