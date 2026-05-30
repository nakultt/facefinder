// app/(tabs)/settings.tsx
// Settings Screen — App configuration and system info

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { COLORS, SPACING, FONT, RADIUS } from '@/constants/theme';
import { GlassCard } from '@/src/components/GlassCard';
import { useAppStore } from '@/src/store/appStore';
import { deleteAllPersonnel, getPersonnelCount } from '@/src/database/queries/personnel';
import { deleteAllAttendance } from '@/src/database/queries/attendance';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [enrolledCount, setEnrolledCount] = useState(0);

  const recognitionThreshold = useAppStore((s) => s.recognitionThreshold);
  const setRecognitionThreshold = useAppStore((s) => s.setRecognitionThreshold);
  const setEnrolled = useAppStore((s) => s.setEnrolled);
  const modelLoadProgress = useAppStore((s) => s.modelLoadProgress);

  useEffect(() => {
    getPersonnelCount().then(setEnrolledCount).catch(() => {});
  }, []);

  const handleReset = () => {
    Alert.alert(
      'Reset All Data',
      'This will delete all enrolled faces and attendance records. You will need to re-enroll. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await deleteAllAttendance();
            await deleteAllPersonnel();
            setEnrolled(false);
            router.replace('/enroll' as any);
          },
        },
      ]
    );
  };

  const handleReEnroll = () => {
    Alert.alert(
      'Re-Enroll Face',
      'This will replace your current face data with new scans. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-Enroll',
          onPress: async () => {
            await deleteAllPersonnel();
            setEnrolled(false);
            router.replace('/enroll' as any);
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Settings</Text>

        {/* Profile Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(500)}>
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Profile</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Enrolled Faces</Text>
              <Text style={styles.rowValue}>{enrolledCount}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Embeddings Per Person</Text>
              <Text style={styles.rowValue}>7 angles</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Embedding Dimension</Text>
              <Text style={styles.rowValue}>512-D</Text>
            </View>

            <TouchableOpacity
              onPress={handleReEnroll}
              style={styles.actionButton}
            >
              <Text style={styles.actionButtonText}>🔄 Re-Enroll Face</Text>
            </TouchableOpacity>
          </GlassCard>
        </Animated.View>

        {/* Recognition Settings */}
        <Animated.View entering={FadeInDown.delay(200).duration(500)}>
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Recognition</Text>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Match Threshold</Text>
              <Text style={styles.rowValue}>
                {(recognitionThreshold * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={styles.sliderRow}>
              <Text style={styles.sliderLabel}>Strict</Text>
              <View style={styles.sliderTrack}>
                <TouchableOpacity
                  onPress={() => setRecognitionThreshold(0.55)}
                  style={[
                    styles.sliderDot,
                    recognitionThreshold <= 0.55 && styles.sliderDotActive,
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setRecognitionThreshold(0.60)}
                  style={[
                    styles.sliderDot,
                    recognitionThreshold === 0.60 && styles.sliderDotActive,
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setRecognitionThreshold(0.65)}
                  style={[
                    styles.sliderDot,
                    recognitionThreshold === 0.65 && styles.sliderDotActive,
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setRecognitionThreshold(0.70)}
                  style={[
                    styles.sliderDot,
                    recognitionThreshold === 0.70 && styles.sliderDotActive,
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setRecognitionThreshold(0.75)}
                  style={[
                    styles.sliderDot,
                    recognitionThreshold >= 0.75 && styles.sliderDotActive,
                  ]}
                />
              </View>
              <Text style={styles.sliderLabel}>Lenient</Text>
            </View>

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Multi-Angle Matching</Text>
              <Text style={[styles.rowValue, { color: COLORS.success }]}>
                Enabled ✓
              </Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Dual-Layer Liveness</Text>
              <Text style={[styles.rowValue, { color: COLORS.success }]}>
                Enabled ✓
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Models Info */}
        <Animated.View entering={FadeInDown.delay(300).duration(500)}>
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>ML Models</Text>
            {[
              { key: 'detector', name: 'YuNet', task: 'Face Detection', size: '0.33MB', format: 'TFLite' },
              { key: 'recognizer', name: 'MobileFaceNet', task: 'Recognition', size: '4.1MB', format: 'TFLite INT8' },
              { key: 'passiveLiveness', name: 'SilentFAS', task: 'Passive Liveness', size: '2.4MB', format: 'TFLite' },
              { key: 'activeLiveness', name: 'MediaPipe', task: 'Active Liveness', size: '3.5MB', format: '.task' },
            ].map((m) => (
              <View key={m.key} style={styles.modelRow}>
                <View
                  style={[
                    styles.modelDot,
                    {
                      backgroundColor: modelLoadProgress[m.key]
                        ? COLORS.success
                        : COLORS.textTertiary,
                    },
                  ]}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.modelName}>{m.name}</Text>
                  <Text style={styles.modelTask}>{m.task}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.modelSize}>{m.size}</Text>
                  <Text style={styles.modelFormat}>{m.format}</Text>
                </View>
              </View>
            ))}
            <View style={styles.totalBar}>
              <Text style={styles.totalText}>Total: ~7.2MB</Text>
              <View style={styles.budgetBar}>
                <View style={styles.budgetFill} />
              </View>
              <Text style={styles.budgetText}>36% of 20MB limit</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Security */}
        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>Security</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Encryption</Text>
              <Text style={styles.rowValue}>AES-256-GCM</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Record Signing</Text>
              <Text style={styles.rowValue}>HMAC-SHA256</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Lockout After</Text>
              <Text style={styles.rowValue}>3 failures (30s)</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Storage</Text>
              <Text style={styles.rowValue}>SQLCipher Encrypted</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* About */}
        <Animated.View entering={FadeInDown.delay(500).duration(500)}>
          <GlassCard style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Version</Text>
              <Text style={styles.rowValue}>1.0.0</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Framework</Text>
              <Text style={styles.rowValue}>Expo SDK 54</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>React Native</Text>
              <Text style={styles.rowValue}>0.81.5</Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Danger Zone */}
        <Animated.View entering={FadeInDown.delay(600).duration(500)}>
          <GlassCard style={{...styles.section, ...styles.dangerSection}}>
            <Text style={[styles.sectionTitle, { color: COLORS.error }]}>
              Danger Zone
            </Text>
            <TouchableOpacity
              onPress={handleReset}
              style={styles.dangerButton}
            >
              <Text style={styles.dangerButtonText}>
                🗑️ Reset All Data & Re-Enroll
              </Text>
            </TouchableOpacity>
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
  title: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: FONT.weights.semibold,
    color: COLORS.primaryLight,
    marginBottom: SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  rowLabel: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
  },
  rowValue: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.medium,
    color: COLORS.textPrimary,
  },
  actionButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary + '20',
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.primaryLight,
    fontWeight: FONT.weights.semibold,
    fontSize: FONT.sizes.sm,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  sliderLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  sliderTrack: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 4,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 2,
    paddingHorizontal: 4,
  },
  sliderDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.textTertiary,
  },
  sliderDotActive: {
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: COLORS.primaryLight,
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  modelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modelName: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.medium,
    color: COLORS.textPrimary,
  },
  modelTask: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  modelSize: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
    fontWeight: FONT.weights.medium,
  },
  modelFormat: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  totalBar: {
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  totalText: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  budgetBar: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.bgTertiary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budgetFill: {
    width: '36%',
    height: '100%',
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  budgetText: {
    fontSize: 10,
    color: COLORS.success,
    marginTop: 4,
  },
  dangerSection: {
    borderColor: COLORS.error + '30',
  },
  dangerButton: {
    backgroundColor: COLORS.error + '15',
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '30',
  },
  dangerButtonText: {
    color: COLORS.error,
    fontWeight: FONT.weights.semibold,
    fontSize: FONT.sizes.sm,
  },
});
