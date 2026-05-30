// src/components/GlassCard.tsx
// Glassmorphism card component for premium UI

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: 'light' | 'medium' | 'strong';
}

export function GlassCard({ children, style, intensity = 'medium' }: GlassCardProps) {
  const bgOpacity = intensity === 'light' ? '10' : intensity === 'medium' ? '18' : '25';

  return (
    <View style={[styles.card, { backgroundColor: `#ffffff${bgOpacity}` }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 20,
    overflow: 'hidden',
  },
});
