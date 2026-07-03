import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDatabase } from './src/db/database';
import AppNavigator from './src/navigation/AppNavigator';
import { Colors } from './src/utils/colors';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getDatabase()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('DB init error:', e);
        setReady(true);
      });
  }, []);

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.text} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
  },
});
