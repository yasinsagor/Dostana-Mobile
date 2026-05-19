import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { COLORS } from '../constants';

import ManagerHomeScreen     from '../screens/manager/HomeScreen';
import ManagerSubmitScreen   from '../screens/manager/SubmitScreen';
import ManagerSpecScreen     from '../screens/manager/SpecScreen';
import ManagerHistoryScreen  from '../screens/manager/HistoryScreen';
import ManagerSettingsScreen from '../screens/manager/SettingsScreen';

const Tab = createBottomTabNavigator();

const tabs = [
  { name: 'Home',         component: ManagerHomeScreen,     icon: '🏠' },
  { name: 'Submit',       component: ManagerSubmitScreen,   icon: '📤' },
  { name: 'SPEC Order',   component: ManagerSpecScreen,     icon: '📦' },
  { name: 'History',      component: ManagerHistoryScreen,  icon: '🗂️' },
  { name: 'Settings',     component: ManagerSettingsScreen, icon: '⚙️' },
];

export default function ManagerNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: { paddingBottom: 4, height: 60 },
        tabBarLabelStyle: { fontSize: 10 },
        tabBarIcon: ({ focused }) => {
          const tab = tabs.find(t => t.name === route.name);
          return <Text style={{ fontSize: focused ? 22 : 17 }}>{tab?.icon}</Text>;
        },
      })}
    >
      {tabs.map(t => (
        <Tab.Screen key={t.name} name={t.name} component={t.component} />
      ))}
    </Tab.Navigator>
  );
}
