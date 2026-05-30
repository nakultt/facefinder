// app/(tabs)/history.tsx
// Attendance History Screen

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { COLORS, SPACING, FONT, RADIUS } from '@/constants/theme';
import { GlassCard } from '@/src/components/GlassCard';
import { getRecentAttendance } from '@/src/database/queries/attendance';
import { getPersonnelById } from '@/src/database/queries/personnel';
import type { AttendanceLog } from '@/src/types';

interface AttendanceWithName extends AttendanceLog {
  personnelName?: string;
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<AttendanceWithName[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async () => {
    try {
      const rawLogs = await getRecentAttendance(50);
      const enriched: AttendanceWithName[] = await Promise.all(
        rawLogs.map(async (log) => {
          const person = await getPersonnelById(log.personnelId);
          return { ...log, personnelName: person?.name ?? 'Unknown' };
        })
      );
      setLogs(enriched);
    } catch (error) {
      console.error('Failed to load attendance:', error);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderItem = ({ item, index }: { item: AttendanceWithName; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(400)}>
      <GlassCard style={styles.logCard}>
        <View style={styles.logHeader}>
          <View style={styles.logAvatar}>
            <Text style={styles.logAvatarText}>
              {(item.personnelName || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logName}>{item.personnelName}</Text>
            <Text style={styles.logTime}>
              {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
            </Text>
          </View>
          <View
            style={[
              styles.syncBadge,
              {
                backgroundColor:
                  item.syncStatus === 'synced'
                    ? COLORS.success + '20'
                    : COLORS.warning + '20',
              },
            ]}
          >
            <Text
              style={[
                styles.syncText,
                {
                  color:
                    item.syncStatus === 'synced'
                      ? COLORS.success
                      : COLORS.warning,
                },
              ]}
            >
              {item.syncStatus === 'synced' ? '✓ Synced' : '⏳ Pending'}
            </Text>
          </View>
        </View>

        <View style={styles.logStats}>
          <View style={styles.logStat}>
            <Text style={styles.logStatLabel}>Confidence</Text>
            <Text style={styles.logStatValue}>
              {(item.confidenceScore * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.logStat}>
            <Text style={styles.logStatLabel}>Liveness</Text>
            <Text style={styles.logStatValue}>
              {(item.livenessScore * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.logStat}>
            <Text style={styles.logStatLabel}>HMAC</Text>
            <Text style={styles.logStatValue}>
              {item.logHash ? '✓ Signed' : '✗'}
            </Text>
          </View>
        </View>
      </GlassCard>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
        <Text style={styles.subtitle}>
          {logs.length} record{logs.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Records Yet</Text>
            <Text style={styles.emptySub}>
              Attendance records will appear here after authentication
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgPrimary,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: FONT.sizes.xxl,
    fontWeight: FONT.weights.bold,
    color: COLORS.textPrimary,
  },
  subtitle: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  listContent: {
    padding: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
    paddingBottom: 100,
  },
  logCard: {
    padding: SPACING.md,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  logAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logAvatarText: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.bold,
    color: COLORS.primaryLight,
  },
  logName: {
    fontSize: FONT.sizes.md,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
  },
  logTime: {
    fontSize: FONT.sizes.xs,
    color: COLORS.textTertiary,
    marginTop: 2,
  },
  syncBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  syncText: {
    fontSize: FONT.sizes.xs,
    fontWeight: FONT.weights.semibold,
  },
  logStats: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
  },
  logStat: {
    flex: 1,
    alignItems: 'center',
  },
  logStatLabel: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  logStatValue: {
    fontSize: FONT.sizes.sm,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONT.sizes.lg,
    fontWeight: FONT.weights.semibold,
    color: COLORS.textPrimary,
  },
  emptySub: {
    fontSize: FONT.sizes.sm,
    color: COLORS.textTertiary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    maxWidth: 260,
  },
});
