// constants/theme.ts
// FaceFort design system — premium dark theme

export const COLORS = {
  // Primary gradient
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',

  // Accent
  accent: '#06B6D4',
  accentLight: '#22D3EE',

  // Success / Warning / Error
  success: '#10B981',
  successLight: '#34D399',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  error: '#EF4444',
  errorLight: '#F87171',

  // Backgrounds (dark)
  bgPrimary: '#0A0E1A',
  bgSecondary: '#111827',
  bgTertiary: '#1F2937',
  bgCard: '#162033',
  bgElevated: '#1E293B',

  // Surface / Glass
  surfaceGlass: 'rgba(255, 255, 255, 0.06)',
  surfaceBorder: 'rgba(255, 255, 255, 0.08)',

  // Text
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textMuted: '#4B5563',

  // Gradients (as arrays for LinearGradient)
  gradientPrimary: ['#6366F1', '#8B5CF6'],
  gradientAccent: ['#06B6D4', '#3B82F6'],
  gradientSuccess: ['#10B981', '#06B6D4'],
  gradientDanger: ['#EF4444', '#F59E0B'],
  gradientDark: ['#0A0E1A', '#111827'],
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT = {
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 28,
    xxxl: 36,
    hero: 48,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 999,
} as const;

// Keep backward compat with existing theme imports
export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: COLORS.primary,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: COLORS.textPrimary,
    background: COLORS.bgPrimary,
    tint: COLORS.primaryLight,
    icon: COLORS.textSecondary,
    tabIconDefault: COLORS.textTertiary,
    tabIconSelected: COLORS.primaryLight,
  },
};
