import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthProvider, useAuth } from './src/auth';
import { SpecProvider, useSpec } from './src/store';
import { T } from './src/components/ui';
import { AI_BRANCHES } from './src/config';
import LoginScreen from './src/screens/LoginScreen';
import TodayScreen from './src/screens/TodayScreen';
import OrderScreen from './src/screens/OrderScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import AssistantScreen from './src/screens/AssistantScreen';

const Tab = createBottomTabNavigator();
const ICONS = { Today: '◉', Order: '＋', History: '☰', AI: '✦' };

class ErrorBoundary extends React.Component {
  state = { error: null };
  componentDidCatch(error) { this.setState({ error: `${error}\n\n${error?.stack || ''}` }); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 17, fontWeight: '900', color: T.danger }}>Something went wrong</Text>
        <Text style={{ marginTop: 6, color: T.inkSoft }}>Close and reopen the app. Your draft order is saved on the phone.</Text>
        <ScrollView style={{ marginTop: 14 }}><Text style={{ fontSize: 11, color: '#555' }}>{this.state.error}</Text></ScrollView>
      </View>
    );
  }
}

function Tabs() {
  const { user } = useAuth();
  const spec = useSpec();
  const orderBadge = !spec.todayOrder && spec.totals.count ? spec.totals.count : undefined;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: T.brand,
        tabBarInactiveTintColor: T.muted,
        tabBarStyle: { height: 70, paddingBottom: 12, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800' },
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 18, fontWeight: '900' }}>{ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen name="Today" component={TodayScreen} />
      <Tab.Screen name="Order" component={OrderScreen} options={{ tabBarBadge: orderBadge, tabBarBadgeStyle: { backgroundColor: T.brand } }} />
      <Tab.Screen name="History" component={HistoryScreen} />
      {AI_BRANCHES.includes(user.branch) && <Tab.Screen name="AI" component={AssistantScreen} />}
    </Tab.Navigator>
  );
}

function Root() {
  const { user, ready } = useAuth();
  if (!ready) {
    return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.navy }}><ActivityIndicator color="#fff" size="large" /></View>;
  }
  if (!user) return <LoginScreen />;
  return (
    <SpecProvider key={user.branch} branch={user.branch}>
      <NavigationContainer>
        <Tabs />
      </NavigationContainer>
    </SpecProvider>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <ErrorBoundary>
          <AuthProvider>
            <Root />
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
