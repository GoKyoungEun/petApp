import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { colors } from './src/theme';
import { queryClient } from './src/queryClient';
import { usePets } from './src/queries/pets';
import { StoreProvider, useStore } from './src/store';
import { getSession, onAuthChange } from './src/auth';
import HomeScreen from './src/screens/HomeScreen';
import AllRecordsScreen from './src/screens/AllRecordsScreen';
import CalendarScreen from './src/screens/CalendarScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import StatsScreen from './src/screens/StatsScreen';
import WeightScreen from './src/screens/WeightScreen';
import MyScreen from './src/screens/MyScreen';
import LegalScreen from './src/screens/LegalScreen';
import LoginScreen from './src/screens/LoginScreen';
import BottomNav from './src/components/BottomNav';
import QuickRecordSheet from './src/components/QuickRecordSheet';
import Snackbar from './src/components/Snackbar';
import PetMenu from './src/components/PetMenu';
import PetForm from './src/components/PetForm';
import ScheduleForm from './src/components/ScheduleForm';
import MedicalForm from './src/components/MedicalForm';
import EditRecordSheet from './src/components/EditRecordSheet';
import HealthPhotoSheet from './src/components/HealthPhotoSheet';

// Must run before the first render — the native splash is already on screen by
// then and this is what stops it hiding on its own.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Holds the native splash until the app has something real to show. The timeout
// is a backstop: a splash that never lifts is worse than one that lifts early.
function SplashGate({ ready }) {
  useEffect(() => {
    const hide = () => SplashScreen.hideAsync().catch(() => {});
    if (ready) {
      hide();
      return undefined;
    }
    const timer = setTimeout(hide, 3000);
    return () => clearTimeout(timer);
  }, [ready]);

  return null;
}

// Only mounted once signed in. Pets come from the server now, so the first frame
// after login has none and the header would flash empty — wait for that read.
// Querying pets while signed out would just hit RLS and come back empty.
function PetsSplashGate() {
  const { isFetched } = usePets();
  return <SplashGate ready={isFetched} />;
}

function Root() {
  const { tab } = useStore();
  return (
    <>
      <View style={styles.screen}>
        {tab === 'home' ? (
          <HomeScreen />
        ) : tab === 'records' ? (
          <AllRecordsScreen />
        ) : tab === 'calendar' ? (
          <CalendarScreen />
        ) : tab === 'schedule' ? (
          <ScheduleScreen />
        ) : tab === 'stats' ? (
          <StatsScreen />
        ) : tab === 'weight' ? (
          <WeightScreen />
        ) : tab === 'legal' ? (
          <LegalScreen />
        ) : (
          <MyScreen />
        )}
      </View>
      <BottomNav />
      <Snackbar />
      <QuickRecordSheet />
      <HealthPhotoSheet />
      <PetMenu />
      <PetForm />
      <ScheduleForm />
      <MedicalForm />
      <EditRecordSheet />
    </>
  );
}

// 로그인 게이트. 세션이 없으면 앱 본체를 마운트하지 않는다 —
// 11_ChangeLog 2026-07-29 "로그인 필수". 모든 데이터가 RLS 뒤에 있어서
// 세션 없이 마운트해 봐야 빈 화면에 실패한 조회만 쌓인다.
function AuthGate() {
  // undefined = 아직 확인 중. null(로그아웃)과 구분해야 앱을 켤 때마다
  // 로그인 화면이 한 번 번쩍이지 않는다.
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    getSession().then(setSession).catch(() => setSession(null));
    // 로그인·로그아웃뿐 아니라 토큰 갱신과 재시작 복원도 여기로 들어온다.
    return onAuthChange(setSession);
  }, []);

  // 계정이 바뀌면 이전 계정의 기록이 캐시에 남아 잠깐 보인다. 로그아웃 시점에
  // 통째로 비운다.
  useEffect(() => {
    if (session === null) queryClient.clear();
  }, [session]);

  // 세션을 확인하는 동안은 스플래시가 그대로 덮고 있다. 아래 스피너는 확인이
  // 3초를 넘겨 백스톱이 스플래시를 내렸을 때 보이는 화면이다.
  if (session === undefined) {
    return (
      <View style={styles.loading}>
        <SplashGate ready={false} />
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <SplashGate ready />
        <LoginScreen />
      </>
    );
  }

  return (
    // key: 계정이 바뀌면 store의 지역 상태(선택된 펫, 열린 시트)까지 새로 시작한다.
    <StoreProvider key={session.user.id}>
      <PetsSplashGate />
      <Root />
    </StoreProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* StoreProvider 바깥 — store는 자기 데이터를 query 훅으로 읽는다. */}
      <QueryClientProvider client={queryClient}>
        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <AuthGate />
        </SafeAreaView>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  screen: { flex: 1, backgroundColor: '#fff' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
