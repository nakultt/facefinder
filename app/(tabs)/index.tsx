// app/(tabs)/index.tsx
// Dashboard Home Screen — primary entry point
// Redirects to enrollment on first launch, shows dashboard after enrollment

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';

import { COLORS, SPACING, FONT, RADIUS } from '@/constants/theme';
import { GlassCard } from '@/src/components/GlassCard';
import { useAppStore } from '@/src/store/appStore';
import { getTodayAttendanceCount } from '@/src/database/queries/attendance';
import { getPersonnelCount } from '@/src/database/queries/personnel';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isEnrolled = useAppStore((s) => s.isEnrolled);
  const todayCount = useAppStore((s) => s.todayCount);
  const setTodayCount = useAppStore((s) => s.setTodayCount);
  const modelsLoaded = useAppStore((s) => s.modelsLoaded);
  const modelLoadProgress = useAppStore((s) => s.modelLoadProgress);

  // Redirect to enrollment if first launch
  useEffect(() => {
    if (!isEnrolled) {
      router.replace('/enroll' as any);
    }
  }, [isEnrolled, router]);

  // Load dashboard data
  const loadData = useCallback(async () => {
    try {
      const count = await getTodayAttendanceCount();
      setTodayCount(count);
    } catch {
      // ignore
    }
  }, [setTodayCount]);

  useEffect(() => {
    if (isEnrolled) {
      loadData();
    }
  }, [isEnrolled, loadData]);

  if (!isEnrolled) {
    return <View style={[styles.container, { paddingTop: insets.top }]} />;
  }

  const modelCount = Object.values(modelLoadProgress).filter(Boolean).length;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <Text style={styles.greeting}>FaceFort</Text>
          <Text style={styles.subtitle}>Offline Biometric Authentication</Text>
        </Animated.View>

        {/* Quick Action: Authenticate */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push('/authenticate' as any)}
            style={styles.authButton}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.authButtonGradient}
            >
              <Text style={styles.authButtonIcon}>🔐</Text>
              <Text style={styles.authButtonTitle}>Authenticate</Text>
              <Text style={styles.authButtonSub}>
                Tap to verify your identity
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Stats Grid */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(600)}
          style={styles.statsGrid}
        >
          <GlassCard style={styles.statCard}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={styles.statValue}>{todayCount}</Text>
            <Text style={styles.statLabel}>Today's Scans</Text>
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <Text style={styles.statIcon}>🤖</Text>
            <Text style={styles.statValue}>{modelCount}/4</Text>
            <Text style={styles.statLabel}>Models Loaded</Text>
          </GlassCard>
        </Animated.View>

        {/* Model Status */}
        <Animated.View entering={FadeInUp.delay(400).duration(600)}>
          <GlassCard style={styles.modelCard}>
            <Text style={styles.sectionTitle}>System Status</Text>
            <View style={styles.modelList}>
              {[
                { key: 'detector', label: 'Face Detection (YuNet)', size: '0.33MB' },
                { key: 'recognizer', label: 'Face Recognition (MobileFaceNet)', size: '4.1MB' },
                { key: 'passiveLiveness', label: 'Passive Liveness (SilentFAS)', size: '2.4MB' },
                { key: 'activeLiveness', label: 'Active Liveness (MediaPipe)', size: '3.5MB' },
              ].map((model) => (
                <View key={model.key} style={styles.modelRow}>
                  <View style={styles.modelInfo}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: modelLoadProgress[model.key]
                            ? COLORS.success
                            : COLORS.warning,
                        },
                      ]}
                    />
                    <Text style={styles.modelName}>{model.label}</Text>
                  </View>
                  <Text style={styles.modelSize}>{model.size}</Text>
                </View>
              ))}
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Package</Text>
              <Text style={styles.totalValue}>~7.2MB / 20MB limit</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Security Info */}
        <Animated.View entering={FadeInUp.delay(500).duration(600)}>
          <GlassCard style={styles.securityCard}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.securityRow}>
              <Text style={styles.securityIcon}>🔒</Text>
              <View>
                <Text style={styles.securityLabel}>AES-256-GCM Encrypted Storage</Text>
                <Text style={styles.securitySub}>Face embeddings encrypted at rest</Text>
              </View>
            </View>
            <View style={styles.securityRow}>
              <Text style={styles.securityIcon}>🛡️</Text>
              <View>
                <Text style={styles.securityLabel}>HMAC-SHA256 Signed Records</Text>
                <Text style={styles.securitySub}>Tamper-evident attendance logs</Text>
              </View>
            </View>
            <View style={styles.securityRow}>
              <Text style={styles.securityIcon}>📵</Text>
              <View>
                <Text style={styles.securityLabel}>Fully Offline</Text>
                <Text style={styles.securitySub}>No internet required for authentication</Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  greeting: {
    fontSize: FONT.sizes.xxxl,
    fontWeight: FONT.weights.extrabold,
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    marginTop: 4,
    marginBottom: SPACING.xl,
  },
  authButton: {
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  authButtonGradient: {
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
  },
  authButtonIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  authButtonTitle: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.bold,
    color: '#FFFFFF',
  },
  authButtonSub: {
    fontSize: FONT.sizes.sm,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.lg,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: SPACING.sm,
  },
  statValue: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: FONT.sizes.xs,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  modelCard: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  modelList: {
    gap: SPACING.sm,
  },
  modelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  modelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.sm,
  },
  modelName: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  modelSize: {
    fontSize: FONT.sizes.xs,
    color: COLORS.textTertiary,
    fontWeight: FONT.weights.medium,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  totalLabel: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
  },
  totalValue: {
    fontSize: FONT.sizes.sm,
    color: COLORS.success,
    fontWeight: FONT.weights.semibold,
  },
  securityCard: {
    marginBottom: SPACING.lg,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  securityIcon: {
    fontSize: 20,
    marginTop: 2,
  },
  securityLabel: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.medium,
    color: COLORS.textPrimary,
  },
  securitySub: {
    fontSize: FONT.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
});
