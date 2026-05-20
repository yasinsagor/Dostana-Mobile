import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import SupplierOrdersScreen from '../screens/supplier/OrdersScreen';
import SupplierPricesScreen from '../screens/supplier/PricesScreen';
import SupplierSettingsScreen from '../screens/supplier/SettingsScreen';

const Tab = createBottomTabNavigator();

const SUPPLIER_COLOR = '#E65100';

function icon(emoji) {
  return ({ focused }) => (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{emoji}</Text>
  );
}

export default function SupplierNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: SUPPLIER_COLOR,
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#E0E0E0',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="SupplierOrders"
        component={SupplierOrdersScreen}
        options={{ tabBarLabel: 'Orders', tabBarIcon: icon('📦') }}
      />
      <Tab.Screen
        name="SupplierPrices"
        component={SupplierPricesScreen}
        options={{ tabBarLabel: 'Prices', tabBarIcon: icon('💰') }}
      />
      <Tab.Screen
        name="SupplierSettings"
        component={SupplierSettingsScreen}
        options={{ tabBarLabel: 'Settings', tabBarIcon: icon('⚙️') }}
      />
    </Tab.Navigator>
  );
}
