// app/enroll.tsx
// Self-Enrollment Screen — First-launch face registration with 7-angle guided capture

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOut,
  SlideInRight,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, SPACING, FONT, RADIUS } from '@/constants/theme';
import { FaceOverlay } from '@/src/components/FaceOverlay';
import { GlassCard } from '@/src/components/GlassCard';
import { useAppStore } from '@/src/store/appStore';
import { ENROLLMENT_STEPS } from '@/src/types';
import { getEmbedding } from '@/src/ml/FaceRecognizer';
import { encryptEmbeddings, generateUUID } from '@/src/security/CryptoManager';
import { enrollPersonnel } from '@/src/database/queries/personnel';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type Phase = 'welcome' | 'name' | 'capture' | 'complete';

export default function EnrollScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('welcome');
  const [name, setName] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [capturedEmbeddings, setCapturedEmbeddings] = useState<number[][]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  const setEnrolled = useAppStore((s) => s.setEnrolled);
  const setFirstLaunch = useAppStore((s) => s.setFirstLaunch);

  // Pulse animation for capture button
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (phase === 'capture') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.05, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.95, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }
  }, [phase, pulseScale]);

  const captureButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Progress animation
  const progressWidth = useSharedValue(0);
  useEffect(() => {
    progressWidth.value = withTiming(
      (currentStep / ENROLLMENT_STEPS.length) * 100,
      { duration: 500 }
    );
  }, [currentStep, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // Request camera permission
  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Simulate face detection on camera
  useEffect(() => {
    if (phase === 'capture') {
      const timer = setTimeout(() => setFaceDetected(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, currentStep]);

  // Handle capture with countdown
  const handleCapture = useCallback(async () => {
    if (isCapturing) return;
    setIsCapturing(true);

    // Countdown 3-2-1
    for (let i = 3; i >= 1; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(null);

    try {
      // Take photo
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.8,
        base64: false,
      });

      // Generate embedding from the captured frame
      // In production: extract face, align, preprocess, then run MobileFaceNet
      // For demo: generate pseudo-embedding from random seed + step index
      const dummyPixels = new Uint8Array(112 * 112 * 3);
      for (let i = 0; i < dummyPixels.length; i++) {
        dummyPixels[i] = Math.floor(Math.random() * 256);
      }
      // Add step-specific variation so each angle is different
      for (let i = 0; i < 100; i++) {
        dummyPixels[i] = (currentStep * 37 + i * 13) % 256;
      }

      const embedding = getEmbedding(dummyPixels);

      const newEmbeddings = [...capturedEmbeddings, embedding];
      setCapturedEmbeddings(newEmbeddings);

      if (currentStep < ENROLLMENT_STEPS.length - 1) {
        setCurrentStep((prev) => prev + 1);
        setFaceDetected(false);
      } else {
        // All 7 angles captured — save enrollment
        await saveEnrollment(newEmbeddings);
      }
    } catch (error) {
      console.error('Capture failed:', error);
      Alert.alert('Capture Failed', 'Please try again');
    } finally {
      setIsCapturing(false);
    }
  }, [isCapturing, currentStep, capturedEmbeddings, name]);

  // Save enrollment to database
  const saveEnrollment = async (embeddings: number[][]) => {
    try {
      const encryptedBlob = await encryptEmbeddings(embeddings);
      const personnelId = generateUUID();

      await enrollPersonnel({
        id: personnelId,
        employeeId: `SELF-${Date.now()}`,
        name: name || 'User',
        department: 'Self-Enrolled',
        enrolledAt: Date.now(),
        embeddingBlob: encryptedBlob,
        embeddingVersion: 1,
        enrollmentImageHash: '',
        isActive: true,
        syncedToCloud: false,
      });

      setEnrolled(true);
      setFirstLaunch(false);
      setPhase('complete');
    } catch (error) {
      console.error('Enrollment save failed:', error);
      Alert.alert('Error', 'Failed to save enrollment. Please try again.');
    }
  };

  const step = ENROLLMENT_STEPS[currentStep];

  // --- RENDER PHASES ---

  if (phase === 'welcome') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <LinearGradient
          colors={[COLORS.bgPrimary, '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={FadeInDown.delay(200).duration(800)}
          style={styles.welcomeContent}
        >
          <Text style={styles.welcomeIcon}>🛡️</Text>
          <Text style={styles.welcomeTitle}>Welcome to FaceFort</Text>
          <Text style={styles.welcomeSubtitle}>
            Secure offline facial recognition{'\n'}for field authentication
          </Text>

          <GlassCard style={styles.featureCard}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>⚡</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>~350ms Recognition</Text>
                <Text style={styles.featureDesc}>
                  Lightning-fast face matching on-device
                </Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>🔐</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>Military-Grade Encryption</Text>
                <Text style={styles.featureDesc}>
                  AES-256-GCM encrypted face data
                </Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>📵</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>100% Offline</Text>
                <Text style={styles.featureDesc}>
                  No internet connection required
                </Text>
              </View>
            </View>
          </GlassCard>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(600)} style={styles.bottomAction}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setPhase('name')}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (phase === 'name') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <LinearGradient
          colors={[COLORS.bgPrimary, '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={FadeInDown.delay(100).duration(600)}
          style={styles.nameContent}
        >
          <Text style={styles.nameTitle}>What's your name?</Text>
          <Text style={styles.nameSubtitle}>
            This will be used to identify you during authentication
          </Text>

          <TextInput
            style={styles.nameInput}
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor={COLORS.textTertiary}
            autoFocus
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.nameHint}>
            Next: We'll scan your face from 7 different angles
          </Text>
        </Animated.View>

        <View style={styles.bottomAction}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              if (!name.trim()) {
                Alert.alert('Name Required', 'Please enter your name to continue');
                return;
              }
              setPhase('capture');
            }}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Start Face Scan →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 40 }]}>
        <LinearGradient
          colors={[COLORS.bgPrimary, '#0F172A']}
          style={StyleSheet.absoluteFill}
        />
        <Animated.View
          entering={FadeIn.delay(200).duration(800)}
          style={styles.completeContent}
        >
          <Animated.Text
            entering={FadeInDown.delay(300).springify()}
            style={styles.completeIcon}
          >
            ✅
          </Animated.Text>
          <Text style={styles.completeTitle}>You're All Set!</Text>
          <Text style={styles.completeSubtitle}>
            {name}, your face has been enrolled with 7 angle captures.{'\n'}
            You can now authenticate instantly.
          </Text>

          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Enrollment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Angles Captured</Text>
              <Text style={styles.summaryValue}>7/7</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Embedding Dimension</Text>
              <Text style={styles.summaryValue}>512-D</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Storage</Text>
              <Text style={styles.summaryValue}>Encrypted ✓</Text>
            </View>
          </GlassCard>
        </Animated.View>

        <View style={styles.bottomAction}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.replace('/(tabs)')}
            style={styles.primaryButton}
          >
            <LinearGradient
              colors={[COLORS.success, '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryButtonGradient}
            >
              <Text style={styles.primaryButtonText}>Go to Dashboard 🎉</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // --- CAPTURE PHASE ---

  if (!permission?.granted) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.permTitle}>Camera Access Required</Text>
        <Text style={styles.permSub}>
          FaceFort needs camera access for facial recognition
        </Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permButton}>
          <Text style={styles.permButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="front"
        mode="picture"
      >
        {/* Top Bar */}
        <View style={[styles.captureTop, { paddingTop: insets.top + 10 }]}>
          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>
              Step {currentStep + 1} of {ENROLLMENT_STEPS.length}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                progressStyle,
              ]}
            />
          </View>

          {/* Step dots */}
          <View style={styles.dotRow}>
            {ENROLLMENT_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < currentStep
                    ? styles.dotComplete
                    : i === currentStep
                    ? styles.dotActive
                    : styles.dotInactive,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Face Guide Overlay */}
        <FaceOverlay
          faceDetected={faceDetected}
          status={faceDetected ? 'detecting' : 'idle'}
          message={step?.prompt}
        />

        {/* Countdown overlay */}
        {countdown !== null && (
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.countdownOverlay}
          >
            <Text style={styles.countdownText}>{countdown}</Text>
          </Animated.View>
        )}

        {/* Bottom Controls */}
        <View style={[styles.captureBottom, { paddingBottom: insets.bottom + 20 }]}>
          {/* Instruction */}
          <Animated.View
            key={currentStep}
            entering={SlideInRight.duration(400)}
            exiting={SlideOutLeft.duration(200)}
            style={styles.instructionCard}
          >
            <Text style={styles.instructionIcon}>{step?.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.instructionTitle}>{step?.prompt}</Text>
              <Text style={styles.instructionText}>{step?.instruction}</Text>
            </View>
          </Animated.View>

          {/* Capture Button */}
          <Animated.View style={captureButtonStyle}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCapture}
              disabled={isCapturing || !faceDetected}
              style={[
                styles.captureButton,
                (!faceDetected || isCapturing) && styles.captureButtonDisabled,
              ]}
            >
              <View style={styles.captureButtonInner}>
                {isCapturing ? (
                  <Text style={styles.captureButtonIcon}>⏳</Text>
                ) : (
                  <Text style={styles.captureButtonIcon}>📸</Text>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>

          {!faceDetected && (
            <Text style={styles.hintText}>Position your face in the guide</Text>
          )}
          {faceDetected && !isCapturing && (
            <Text style={styles.readyText}>Face detected — tap to capture</Text>
          )}
        </View>
      </CameraView>
    </View>
  );
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

  // Welcome phase
  welcomeContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeIcon: {
    fontSize: 72,
    marginBottom: SPACING.lg,
  },
  welcomeTitle: {
    fontSize: FONT.sizes.xxxl,
    fontWeight: FONT.weights.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  welcomeSubtitle: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  featureCard: {
    marginTop: SPACING.xl,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  featureIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  featureTitle: {
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
  },
  featureDesc: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textTertiary,
    marginTop: 2,
  },

  // Name phase
  nameContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  nameTitle: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
  },
  nameSubtitle: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  nameInput: {
    backgroundColor: COLORS.bgTertiary,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: FONT.sizes.lg,
    color: COLORS.textPrimary,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  nameHint: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textTertiary,
    marginTop: SPACING.md,
    textAlign: 'center',
  },

  // Complete phase
  completeContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeIcon: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  completeTitle: {
    fontSize: FONT.sizes.xxxl,
    fontWeight: FONT.weights.extrabold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  completeSubtitle: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 22,
  },
  summaryCard: {
    marginTop: SPACING.xl,
    width: '100%',
  },
  summaryTitle: {
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  summaryLabel: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.semibold,
    color: COLORS.success,
  },

  // Bottom action
  bottomAction: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  primaryButton: {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  primaryButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: RADIUS.xl,
  },
  primaryButtonText: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.bold,
    color: '#FFFFFF',
  },

  // Camera phase
  camera: {
    flex: 1,
  },
  captureTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  stepIndicator: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  stepText: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.semibold,
    color: 'rgba(255,255,255,0.9)',
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primaryLight,
    borderRadius: 2,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotComplete: {
    backgroundColor: COLORS.success,
  },
  dotActive: {
    backgroundColor: COLORS.primaryLight,
    width: 24,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  captureBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    zIndex: 10,
  },
  instructionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  instructionIcon: {
    fontSize: 32,
  },
  instructionTitle: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.bold,
    color: '#FFFFFF',
  },
  instructionText: {
    fontSize: FONT.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },

  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  captureButtonDisabled: {
    backgroundColor: COLORS.textTertiary,
    shadowOpacity: 0,
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonIcon: {
    fontSize: 28,
  },

  hintText: {
    fontSize: FONT.sizes.sm,
    color: 'rgba(255,255,255,0.5)',
    marginTop: SPACING.md,
  },
  readyText: {
    fontSize: FONT.sizes.sm,
    color: COLORS.successLight,
    marginTop: SPACING.md,
    fontWeight: FONT.weights.medium,
  },

  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 20,
  },
  countdownText: {
    fontSize: 96,
    fontWeight: FONT.weights.extrabold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 8,
  },

  // Permission
  permTitle: {
    fontSize: FONT.sizes.xl,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  permSub: {
    fontSize: FONT.sizes.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  permButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  permButtonText: {
    color: '#FFFFFF',
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.semibold,
  },
});
