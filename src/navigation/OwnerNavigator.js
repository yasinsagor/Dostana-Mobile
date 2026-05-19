import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { COLORS } from '../constants';

// Screens (to be built out)
import OwnerDashboardScreen from '../screens/owner/DashboardScreen';
import OwnerPerformanceScreen from '../screens/owner/PerformanceScreen';
import OwnerSpecScreen from '../screens/owner/SpecScreen';
import OwnerCashflowScreen from '../screens/owner/CashflowScreen';
import OwnerSettingsScreen from '../screens/owner/SettingsScreen';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Dashboard', component: OwnerDashboardScreen, icon: '🏠' },
  { name: 'Performance', component: OwnerPerformanceScreen, icon: '📊' },
  { name: 'SPEC', component: OwnerSpecScreen, icon: '📦' },
  { name: 'Cash Flow', component: OwnerCashflowScreen, icon: '💰' },
  { name: 'Settings', component: OwnerSettingsScreen, icon: '⚙️' },
];

export default function OwnerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarIcon: ({ focused }) => {
          const tab = tabs.find(t => t.name === route.name);
          return <Text style={{ fontSize: focused ? 22 : 18 }}>{tab?.icon}</Text>;
        },
      })}
    >
      {tabs.map(t => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}
