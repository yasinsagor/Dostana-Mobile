import React from 'react';
import { View, Text } from 'react-native';
import { registerRootComponent } from 'expo';

function App() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 28, fontWeight: 'bold' }}>Dostana Kebab</Text>
      <Text style={{ color: '#E8891A', fontSize: 16, marginTop: 12 }}>WORKS - Native OK</Text>
    </View>
  );
}

registerRootComponent(App);
