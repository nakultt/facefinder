// src/store/appStore.ts
// Global state management with Zustand

import { create } from 'zustand';
import type { MatchResult, EnrollmentStep, ChallengeType, AttendanceLog } from '../types';
import { ENROLLMENT_STEPS } from '../types';

export type AppScreen = 'loading' | 'onboarding' | 'enrollment' | 'auth' | 'dashboard';

interface AppState {
  // --- Navigation ---
  currentScreen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // --- First Launch / Enrollment ---
  isFirstLaunch: boolean;
  setFirstLaunch: (val: boolean) => void;
  isEnrolled: boolean;
  setEnrolled: (val: boolean) => void;

  // --- Enrollment Flow ---
  enrollmentSteps: EnrollmentStep[];
  currentEnrollmentStep: number;
  enrollmentName: string;
  setEnrollmentName: (name: string) => void;
  advanceEnrollmentStep: () => void;
  markStepCaptured: (stepIndex: number, embedding: number[]) => void;
  resetEnrollment: () => void;

  // --- Model State ---
  modelsLoaded: boolean;
  modelLoadProgress: Record<string, boolean>;
  setModelLoaded: (name: string, loaded: boolean) => void;

  // --- Recognition ---
  isRecognizing: boolean;
  setRecognizing: (val: boolean) => void;
  lastMatch: MatchResult | null;
  setLastMatch: (match: MatchResult | null) => void;
  lastLivenessScore: number;
  setLastLivenessScore: (score: number) => void;

  // --- Active Liveness Challenge ---
  activeChallenge: ChallengeType | null;
  challengeCompleted: boolean;
  setActiveChallenge: (type: ChallengeType | null) => void;
  setChallengeCompleted: (val: boolean) => void;

  // --- Attendance ---
  todayCount: number;
  setTodayCount: (count: number) => void;
  recentLogs: AttendanceLog[];
  setRecentLogs: (logs: AttendanceLog[]) => void;

  // --- Security ---
  failedAttempts: number;
  lockoutUntil: number | null;
  incrementFailedAttempts: () => void;
  resetFailedAttempts: () => void;
  setLockout: (until: number) => void;
  isLockedOut: () => boolean;

  // --- Settings ---
  recognitionThreshold: number;
  setRecognitionThreshold: (val: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // --- Navigation ---
  currentScreen: 'loading',
  setScreen: (screen) => set({ currentScreen: screen }),

  // --- First Launch ---
  isFirstLaunch: true,
  setFirstLaunch: (val) => set({ isFirstLaunch: val }),
  isEnrolled: false,
  setEnrolled: (val) => set({ isEnrolled: val }),

  // --- Enrollment ---
  enrollmentSteps: ENROLLMENT_STEPS.map((s) => ({ ...s })),
  currentEnrollmentStep: 0,
  enrollmentName: '',
  setEnrollmentName: (name) => set({ enrollmentName: name }),
  advanceEnrollmentStep: () =>
    set((state) => ({
      currentEnrollmentStep: Math.min(
        state.currentEnrollmentStep + 1,
        state.enrollmentSteps.length - 1
      ),
    })),
  markStepCaptured: (stepIndex, embedding) =>
    set((state) => {
      const steps = [...state.enrollmentSteps];
      steps[stepIndex] = { ...steps[stepIndex], captured: true, embedding };
      return { enrollmentSteps: steps };
    }),
  resetEnrollment: () =>
    set({
      enrollmentSteps: ENROLLMENT_STEPS.map((s) => ({ ...s })),
      currentEnrollmentStep: 0,
      enrollmentName: '',
    }),

  // --- Model State ---
  modelsLoaded: false,
  modelLoadProgress: {},
  setModelLoaded: (name, loaded) =>
    set((state) => {
      const progress = { ...state.modelLoadProgress, [name]: loaded };
      const allLoaded = Object.values(progress).every(Boolean);
      return { modelLoadProgress: progress, modelsLoaded: allLoaded };
    }),

  // --- Recognition ---
  isRecognizing: false,
  setRecognizing: (val) => set({ isRecognizing: val }),
  lastMatch: null,
  setLastMatch: (match) => set({ lastMatch: match }),
  lastLivenessScore: 0,
  setLastLivenessScore: (score) => set({ lastLivenessScore: score }),

  // --- Active Liveness ---
  activeChallenge: null,
  challengeCompleted: false,
  setActiveChallenge: (type) =>
    set({ activeChallenge: type, challengeCompleted: false }),
  setChallengeCompleted: (val) => set({ challengeCompleted: val }),

  // --- Attendance ---
  todayCount: 0,
  setTodayCount: (count) => set({ todayCount: count }),
  recentLogs: [],
  setRecentLogs: (logs) => set({ recentLogs: logs }),

  // --- Security ---
  failedAttempts: 0,
  lockoutUntil: null,
  incrementFailedAttempts: () =>
    set((state) => {
      const attempts = state.failedAttempts + 1;
      if (attempts >= 3) {
        return {
          failedAttempts: attempts,
          lockoutUntil: Date.now() + 30_000,
        };
      }
      return { failedAttempts: attempts };
    }),
  resetFailedAttempts: () =>
    set({ failedAttempts: 0, lockoutUntil: null }),
  setLockout: (until) => set({ lockoutUntil: until }),
  isLockedOut: () => {
    const { lockoutUntil } = get();
    if (!lockoutUntil) return false;
    if (Date.now() >= lockoutUntil) {
      set({ lockoutUntil: null, failedAttempts: 0 });
      return false;
    }
    return true;
  },

  // --- Settings ---
  recognitionThreshold: 0.65,
  setRecognitionThreshold: (val) => set({ recognitionThreshold: val }),
}));
