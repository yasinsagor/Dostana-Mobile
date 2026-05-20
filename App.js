import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/hooks/useAuth';
import RootNavigator from './src/navigation/RootNavigator';

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
