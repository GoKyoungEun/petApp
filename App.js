import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import HomeScreen from './src/screens/HomeScreen';
import AllRecordsScreen from './src/screens/AllRecordsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import StubScreen from './src/screens/StubScreen';
import BottomNav from './src/components/BottomNav';
import QuickRecordSheet from './src/components/QuickRecordSheet';
import Snackbar from './src/components/Snackbar';
import PetMenu from './src/components/PetMenu';
import PetForm from './src/components/PetForm';

function Root() {
  const { tab } = useStore();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <View style={styles.screen}>
        {tab === 'home' ? (
          <HomeScreen />
        ) : tab === 'records' ? (
          <AllRecordsScreen />
        ) : tab === 'calendar' ? (
          <CalendarScreen />
        ) : (
          <StubScreen name={tab} />
        )}
      </View>
      <BottomNav />
      <Snackbar />
      <QuickRecordSheet />
      <PetMenu />
      <PetForm />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Root />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff' },
});
