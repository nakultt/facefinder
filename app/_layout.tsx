// app/_layout.tsx
// Root layout — handles first-launch detection and routing

import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import 'react-native-reanimated';
import { COLORS } from '@/constants/theme';
import { initDatabase } from '@/src/database/schema';
import { hasEnrolledPersonnel } from '@/src/database/queries/personnel';
import { useAppStore } from '@/src/store/appStore';
import { initFaceDetector } from '@/src/ml/FaceDetector';
import { initFaceRecognizer } from '@/src/ml/FaceRecognizer';
import { initPassiveLiveness, initActiveLiveness } from '@/src/ml/LivenessDetector';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const setEnrolled = useAppStore((s) => s.setEnrolled);
  const setFirstLaunch = useAppStore((s) => s.setFirstLaunch);
  const setModelLoaded = useAppStore((s) => s.setModelLoaded);

  useEffect(() => {
    async function bootstrap() {
      try {
        // 1. Initialize database
        await initDatabase();

        // 2. Check if user has enrolled
        const enrolled = await hasEnrolledPersonnel();
        setEnrolled(enrolled);
        setFirstLaunch(!enrolled);

        // 3. Initialize ML models (in parallel)
        const [detReady, recogReady, passiveReady, activeReady] =
          await Promise.all([
            initFaceDetector(),
            initFaceRecognizer(),
            initPassiveLiveness(),
            initActiveLiveness(),
          ]);

        setModelLoaded('detector', detReady);
        setModelLoaded('recognizer', recogReady);
        setModelLoaded('passiveLiveness', passiveReady);
        setModelLoaded('activeLiveness', activeReady);
      } catch (error) {
        console.error('Bootstrap failed:', error);
      } finally {
        setIsReady(true);
      }
    }

    bootstrap();
  }, [setEnrolled, setFirstLaunch, setModelLoaded]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.bgPrimary },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="enroll"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="authenticate"
          options={{
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.bgPrimary,
  },
});
