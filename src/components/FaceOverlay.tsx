// src/components/FaceOverlay.tsx
// Animated face guide overlay for camera view

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

interface FaceOverlayProps {
  /** Whether a face is currently detected */
  faceDetected: boolean;
  /** Status color: green=match, yellow=processing, red=failed */
  status: 'idle' | 'detecting' | 'processing' | 'success' | 'fail' | 'spoof';
  /** Optional message to display */
  message?: string;
}

const STATUS_COLORS = {
  idle: '#ffffff40',
  detecting: '#3B82F6',
  processing: '#F59E0B',
  success: '#10B981',
  fail: '#EF4444',
  spoof: '#EF4444',
};

export function FaceOverlay({ faceDetected, status, message }: FaceOverlayProps) {
  const pulseScale = useSharedValue(1);
  const borderOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (faceDetected) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      borderOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0.4, { duration: 600 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      borderOpacity.value = withTiming(0.3, { duration: 300 });
    }
  }, [faceDetected, pulseScale, borderOpacity]);

  const animatedGuide = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    borderColor: STATUS_COLORS[status],
    opacity: borderOpacity.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {/* Corner guides */}
      <Animated.View style={[styles.faceGuide, animatedGuide]}>
        <View style={[styles.corner, styles.topLeft, { borderColor: STATUS_COLORS[status] }]} />
        <View style={[styles.corner, styles.topRight, { borderColor: STATUS_COLORS[status] }]} />
        <View style={[styles.corner, styles.bottomLeft, { borderColor: STATUS_COLORS[status] }]} />
        <View style={[styles.corner, styles.bottomRight, { borderColor: STATUS_COLORS[status] }]} />
      </Animated.View>

      {/* Status message */}
      {message && (
        <View style={styles.messageContainer}>
          <View style={[styles.messageBg, { backgroundColor: STATUS_COLORS[status] + '20' }]}>
            <Text style={[styles.messageText, { color: STATUS_COLORS[status] }]}>
              {message}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const GUIDE_SIZE = 260;
const CORNER_SIZE = 40;
const CORNER_THICKNESS = 3;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceGuide: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE * 1.2,
    borderRadius: GUIDE_SIZE * 0.4,
    borderWidth: 0,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderTopLeftRadius: GUIDE_SIZE * 0.4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderTopRightRadius: GUIDE_SIZE * 0.4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderLeftWidth: CORNER_THICKNESS,
    borderBottomLeftRadius: GUIDE_SIZE * 0.4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_THICKNESS,
    borderRightWidth: CORNER_THICKNESS,
    borderBottomRightRadius: GUIDE_SIZE * 0.4,
  },
  messageContainer: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  messageBg: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backdropFilter: 'blur(10px)',
  },
  messageText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
