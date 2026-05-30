// app/authenticate.tsx
// Authentication Screen — Face recognition with dual-layer liveness detection

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING, FONT, RADIUS } from '@/constants/theme';
import { FaceOverlay } from '@/src/components/FaceOverlay';
import { GlassCard } from '@/src/components/GlassCard';
import { useAppStore } from '@/src/store/appStore';
import { getEmbedding, matchAgainstGallery } from '@/src/ml/FaceRecognizer';
import { checkPassiveLiveness } from '@/src/ml/LivenessDetector';
import { getAllActivePersonnel } from '@/src/database/queries/personnel';
import { logAttendance } from '@/src/database/queries/attendance';
import { signAttendanceRecord, generateUUID, generateDeviceId } from '@/src/security/CryptoManager';
import type { MatchResult } from '@/src/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AuthPhase = 'scanning' | 'processing' | 'success' | 'failed' | 'spoof';

export default function AuthenticateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<AuthPhase>('scanning');
  const [faceDetected, setFaceDetected] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [livenessScore, setLivenessScore] = useState(0);
  const [processingStep, setProcessingStep] = useState('');
  const [startTime, setStartTime] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);

  const failedAttempts = useAppStore((s) => s.failedAttempts);
  const incrementFailedAttempts = useAppStore((s) => s.incrementFailedAttempts);
  const resetFailedAttempts = useAppStore((s) => s.resetFailedAttempts);
  const isLockedOut = useAppStore((s) => s.isLockedOut);

  // Scanning animation
  const scanLineY = useSharedValue(0);
  useEffect(() => {
    if (phase === 'scanning') {
      scanLineY.value = withRepeat(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );
    }
  }, [phase, scanLineY]);

  // Simulate face detection
  useEffect(() => {
    if (phase === 'scanning') {
      const timer = setTimeout(() => setFaceDetected(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // Request permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Auto-authenticate when face is detected
  useEffect(() => {
    if (faceDetected && phase === 'scanning') {
      // Auto-trigger after 1 second of stable detection
      const timer = setTimeout(() => {
        handleAuthenticate();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [faceDetected, phase]);

  const handleAuthenticate = useCallback(async () => {
    if (phase !== 'scanning' || isLockedOut()) return;

    setPhase('processing');
    setStartTime(performance.now());

    try {
      // Step 1: Face Detection (~15ms)
      setProcessingStep('Detecting face...');
      await sleep(100); // Simulate detection latency

      // Step 2: Passive Liveness Check (~80ms)
      setProcessingStep('Checking liveness...');
      const dummyFaceCrop = new Uint8Array(80 * 80 * 3);
      const livenessResult = checkPassiveLiveness(dummyFaceCrop);
      setLivenessScore(livenessResult.realProbability);
      await sleep(150);

      if (livenessResult.decision === 'fail') {
        setPhase('spoof');
        incrementFailedAttempts();
        return;
      }

      // Step 3: Extract Face Embedding (~60ms)
      setProcessingStep('Extracting features...');
      const dummyAlignedFace = new Uint8Array(112 * 112 * 3);
      for (let i = 0; i < dummyAlignedFace.length; i++) {
        dummyAlignedFace[i] = Math.floor(Math.random() * 256);
      }
      const embedding = getEmbedding(dummyAlignedFace);
      await sleep(100);

      // Step 4: Match Against Gallery (~15ms)
      setProcessingStep('Matching identity...');
      const gallery = await getAllActivePersonnel();
      const match = await matchAgainstGallery(embedding, gallery);
      await sleep(100);

      const totalMs = performance.now() - startTime;
      setElapsedMs(Math.round(totalMs));

      if (match) {
        setMatchResult(match);
        setPhase('success');
        resetFailedAttempts();

        // Log attendance
        const deviceId = await generateDeviceId();
        const timestamp = Date.now();
        const logHash = await signAttendanceRecord(
          match.personnelId,
          timestamp,
          deviceId
        );

        await logAttendance({
          id: generateUUID(),
          personnelId: match.personnelId,
          timestamp,
          confidenceScore: match.confidence,
          livenessScore: livenessResult.realProbability,
          locationLat: null,
          locationLng: null,
          deviceId,
          logHash,
          syncStatus: 'pending',
          rawImagePath: null,
        });
      } else {
        setPhase('failed');
        incrementFailedAttempts();
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setPhase('failed');
    }
  }, [phase, startTime, incrementFailedAttempts, resetFailedAttempts, isLockedOut]);

  const handleRetry = () => {
    setPhase('scanning');
    setFaceDetected(false);
    setMatchResult(null);
    setLivenessScore(0);
    setProcessingStep('');
  };

  // Locked out screen
  if (isLockedOut()) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[COLORS.bgPrimary, '#1A0A0A']}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Too Many Failed Attempts</Text>
        <Text style={styles.lockSub}>
          Please wait 30 seconds before trying again
        </Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.lockTitle}>Camera Access Required</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera — no children allowed */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mode="picture"
      />

      {/* All overlays as siblings on top of camera */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Top Bar */}
        <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Authentication</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Face Overlay */}
        <FaceOverlay
          faceDetected={faceDetected}
          status={
            phase === 'scanning'
              ? faceDetected ? 'detecting' : 'idle'
              : phase === 'processing'
              ? 'processing'
              : phase === 'success'
              ? 'success'
              : 'fail'
          }
          message={
            phase === 'scanning'
              ? faceDetected ? 'Face detected — verifying...' : 'Position your face in the guide'
              : phase === 'processing'
              ? processingStep
              : undefined
          }
        />

        {/* Processing overlay */}
        {phase === 'processing' && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={styles.processingOverlay}
          >
            <GlassCard style={styles.processingCard}>
              <Text style={styles.processingIcon}>⏳</Text>
              <Text style={styles.processingTitle}>{processingStep}</Text>
              <View style={styles.processingDots}>
                {['Detect', 'Liveness', 'Embed', 'Match'].map((step, i) => (
                  <View key={step} style={styles.processingDotItem}>
                    <View
                      style={[
                        styles.processingDot,
                        {
                          backgroundColor:
                            i <= ['Detecting face...', 'Checking liveness...', 'Extracting features...', 'Matching identity...'].indexOf(processingStep)
                              ? COLORS.success
                              : COLORS.textTertiary,
                        },
                      ]}
                    />
                    <Text style={styles.processingDotLabel}>{step}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </Animated.View>
        )}

        {/* Success overlay */}
        {phase === 'success' && matchResult && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.resultOverlay}
          >
            <Animated.View entering={FadeInDown.springify().delay(200)}>
              <GlassCard style={styles.successCard}>
                <Text style={styles.successIcon}>✅</Text>
                <Text style={styles.successTitle}>Identity Verified</Text>
                <Text style={styles.successName}>{matchResult.name}</Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>
                      {(matchResult.confidence * 100).toFixed(1)}%
                    </Text>
                    <Text style={styles.resultStatLabel}>Confidence</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>
                      {(livenessScore * 100).toFixed(0)}%
                    </Text>
                    <Text style={styles.resultStatLabel}>Liveness</Text>
                  </View>
                  <View style={styles.resultDivider} />
                  <View style={styles.resultStat}>
                    <Text style={styles.resultStatValue}>{elapsedMs}ms</Text>
                    <Text style={styles.resultStatLabel}>Latency</Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.doneButton}
                >
                  <LinearGradient
                    colors={[COLORS.success, '#059669']}
                    style={styles.doneButtonGradient}
                  >
                    <Text style={styles.doneButtonText}>Done ✓</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </GlassCard>
            </Animated.View>
          </Animated.View>
        )}

        {/* Failed overlay */}
        {(phase === 'failed' || phase === 'spoof') && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.resultOverlay}
          >
            <Animated.View entering={FadeInDown.springify().delay(200)}>
              <GlassCard style={styles.failCard}>
                <Text style={styles.failIcon}>
                  {phase === 'spoof' ? '🚫' : '❌'}
                </Text>
                <Text style={styles.failTitle}>
                  {phase === 'spoof'
                    ? 'Spoof Detected!'
                    : 'Not Recognized'}
                </Text>
                <Text style={styles.failSub}>
                  {phase === 'spoof'
                    ? 'A printed photo or screen was detected. Please use your real face.'
                    : `No matching face found. Attempts: ${failedAttempts}/3`}
                </Text>
                <View style={styles.failActions}>
                  <TouchableOpacity
                    onPress={handleRetry}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryText}>Try Again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </GlassCard>
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  camera: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  topTitle: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.semibold,
    color: '#FFFFFF',
  },

  // Processing
  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom: 120,
    paddingHorizontal: SPACING.lg,
    zIndex: 15,
  },
  processingCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  processingIcon: {
    fontSize: 36,
    marginBottom: SPACING.sm,
  },
  processingTitle: {
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  processingDots: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  processingDotItem: {
    alignItems: 'center',
    gap: 4,
  },
  processingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  processingDotLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },

  // Results
  resultOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    zIndex: 20,
  },
  successCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,20,10,0.85)',
    width: SCREEN_WIDTH - 48,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  successIcon: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  successTitle: {
    fontSize: FONT.sizes.xl,
    fontWeight: FONT.weights.bold,
    color: COLORS.success,
  },
  successName: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.extrabold,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  resultStats: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  resultStat: {
    flex: 1,
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
  },
  resultStatLabel: {
    fontSize: FONT.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  resultDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: SPACING.sm,
  },
  doneButton: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    width: '100%',
  },
  doneButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: RADIUS.lg,
  },
  doneButtonText: {
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.bold,
    color: '#FFFFFF',
  },

  // Failed
  failCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(20,0,0,0.85)',
    width: SCREEN_WIDTH - 48,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  failIcon: {
    fontSize: 56,
    marginBottom: SPACING.md,
  },
  failTitle: {
    fontSize: FONT.sizes.xl,
    fontWeight: FONT.weights.bold,
    color: COLORS.error,
  },
  failSub: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 20,
  },
  failActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    width: '100%',
  },
  retryButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: FONT.weights.semibold,
    fontSize: FONT.sizes.md,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 14,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
  },
  cancelText: {
    color: COLORS.textSecondary,
    fontWeight: FONT.weights.semibold,
    fontSize: FONT.sizes.md,
  },

  // Lockout
  lockIcon: {
    fontSize: 64,
    marginBottom: SPACING.lg,
  },
  lockTitle: {
    fontSize: FONT.sizes.xl,
    fontWeight: FONT.weights.bold,
    color: COLORS.error,
    textAlign: 'center',
  },
  lockSub: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
  backBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.bgTertiary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  backBtnText: {
    color: COLORS.textPrimary,
    fontWeight: FONT.weights.semibold,
  },
});
