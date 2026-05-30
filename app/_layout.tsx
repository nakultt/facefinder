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
import { resetLivenessTracker } from '@/src/ml/LivenessDetector';
import { createLogger } from '@/src/utils/logger';

const log = createLogger('RootLayout');

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
        log.info('Database initialized');

        // 2. Check if user has enrolled
        const enrolled = await hasEnrolledPersonnel();
        setEnrolled(enrolled);
        setFirstLaunch(!enrolled);
        log.info(`Enrollment status: ${enrolled}`);

        // 3. ML Models
        // Face detection: ML Kit initializes automatically via VisionCamera frame processor plugin
        setModelLoaded('detector', true);

        // Face recognition: MobileFaceNet TFLite model loaded via useTensorflowModel hook
        // (will be set to true when the hook loads in enroll/auth screens)
        setModelLoaded('recognizer', true); // demo mode fallback always available

        // Liveness: Uses ML Kit classification (no separate model) + image processing
        resetLivenessTracker();
        setModelLoaded('passiveLiveness', true);
        setModelLoaded('activeLiveness', true);

        log.info('Bootstrap complete');
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
