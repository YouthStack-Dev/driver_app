import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './navigation/AppNavigator';
import { LocationProvider } from './context/LocationContext';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocationProvider>
        <AppNavigator />
      </LocationProvider>
    </GestureHandlerRootView>
  );
}