import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { COLORS } from '../constants';

import ManagerDailyScreen from '../screens/manager/DailyScreen';
import ManagerSpecScreen from '../screens/manager/SpecScreen';
import ManagerCashflowScreen from '../screens/manager/CashflowScreen';
import ManagerHistoryScreen from '../screens/manager/HistoryScreen';
import ManagerSettingsScreen from '../screens/manager/SettingsScreen';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Daily Report', component: ManagerDailyScreen, icon: '📝' },
  { name: 'SPEC Order', component: ManagerSpecScreen, icon: '📦' },
  { name: 'Cash Flow', component: ManagerCashflowScreen, icon: '💰' },
  { name: 'History', component: ManagerHistoryScreen, icon: '🗂️' },
  { name: 'Settings', component: ManagerSettingsScreen, icon: '⚙️' },
];

export default function ManagerNavigator() {
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
