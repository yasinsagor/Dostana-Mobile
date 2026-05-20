import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';

// DIAGNOSTIC: temporarily show a plain screen first to confirm native layer works
const DIAGNOSTIC_MODE = true;

class ErrorBoundary extends React.Component {
  state = { error: null };
  componentDidMount() {
    if (global.__FATAL_ERROR__) this.setState({ error: global.__FATAL_ERROR__ });
  }
  componentDidCatch(error) {
    this.setState({ error: error.toString() + '\n\n' + (error.stack || '') });
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: 'red', marginTop: 60 }}>App Error:</Text>
          <ScrollView>
            <Text style={{ fontSize: 11, marginTop: 10, color: '#333', fontFamily: 'monospace' }}>
              {this.state.error}
            </Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  if (DIAGNOSTIC_MODE) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>Dostana Kebab</Text>
        <Text style={{ color: '#E8891A', fontSize: 16, marginTop: 12 }}>Native layer OK</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

