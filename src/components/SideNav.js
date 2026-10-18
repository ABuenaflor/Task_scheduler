import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, colors, formatMoney } from '../theme';
import { MONTHS, WEEKDAYS, addDays, fromKey, toKey } from '../dates';
import { sumAmounts, useExpenses } from '../store';
import { BarChart, DonutChart, LineChart } from './Charts';

function Card({ icon, title, subtitle, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIcon}>
          <Ionicons name={icon} size={16} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.cardSub}>{subtitle}</Text>}
        </View>
      </View>
      {children}
    </View>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {formatMoney(value)}
      </Text>
    </View>
  );
}

export default function SideNav({ open, top, onClose, todayKey }) {
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { expenses, byDate } = useExpenses();
  const navW = Math.min(screenW * 0.88, 400);
  const chartW = navW - 32 - 28; // nav padding + card padding
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: open ? 1 : 0,
      duration: open ? 220 : 180,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, anim]);

  const stats = useMemo(() => {
    const today = fromKey(todayKey);
    const y = today.getFullYear();
    const m = today.getMonth();
    const dayTotal = (d) => sumAmounts(byDate[toKey(d)]);

    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(today, i - 6);
      return { label: WEEKDAYS[d.getDay()].slice(0, 3), value: dayTotal(d), highlight: i === 6 };
    });

    const daily = Array.from({ length: today.getDate() }, (_, i) => ({
      label: String(i + 1),
      value: dayTotal(new Date(y, m, i + 1)),
    }));

    const monthPrefix = todayKey.slice(0, 7);
    const monthItems = expenses.filter((e) => e.date.startsWith(monthPrefix));
    const byCat = CATEGORIES.map((c) => ({
      ...c,
      value: sumAmounts(monthItems.filter((e) => e.category === c.key)),
    }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(y, m - 5 + i, 1);
      const prefix = toKey(d).slice(0, 7);
      return {
        label: MONTHS[d.getMonth()].slice(0, 3),
        value: sumAmounts(expenses.filter((e) => e.date.startsWith(prefix))),
        highlight: i === 5,
      };
    });

    const monthTotal = sumAmounts(monthItems);
    return {
      today: dayTotal(today),
      week: last7.reduce((t, d) => t + d.value, 0),
      month: monthTotal,
      avg: monthTotal / today.getDate(),
      last7,
      daily,
      byCat,
      months,
      monthName: MONTHS[m],
    };
  }, [expenses, byDate, todayKey]);

  return (
    <View style={[StyleSheet.absoluteFill, { top }]} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            width: navW,
            transform: [{ translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [-navW, 0] }) }],
          },
        ]}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}>
          <Text style={styles.heading}>Insights</Text>

          <View style={styles.stats}>
            <Stat label="Today" value={stats.today} />
            <Stat label="Last 7 days" value={stats.week} />
            <Stat label={`${stats.monthName}`} value={stats.month} />
            <Stat label="Daily average" value={stats.avg} />
          </View>

          <Card icon="pie-chart-outline" title="Spending by Label" subtitle={stats.monthName}>
            {stats.byCat.length ? (
              <DonutChart data={stats.byCat} />
            ) : (
              <Text style={styles.none}>No data this month</Text>
            )}
          </Card>

          <Card icon="bar-chart-outline" title="Last 7 Days" subtitle="Daily totals">
            <BarChart data={stats.last7} width={chartW} />
          </Card>

          <Card icon="trending-up-outline" title="Daily Trend" subtitle={`${stats.monthName} so far`}>
            <LineChart data={stats.daily} width={chartW} />
          </Card>

          <Card icon="calendar-number-outline" title="Monthly Totals" subtitle="Last 6 months">
            <BarChart data={stats.months} width={chartW} />
          </Card>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { backgroundColor: colors.backdrop },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.bg,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 4, height: 0 },
    elevation: 12,
  },
  heading: { fontSize: 22, fontWeight: '800', color: colors.text, marginBottom: 12 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  stat: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.gold,
    borderRadius: 14,
    padding: 12,
  },
  statLabel: { fontSize: 12, color: colors.text, opacity: 0.75 },
  statValue: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginTop: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSub: { fontSize: 12, color: colors.muted },
  none: { color: colors.muted, textAlign: 'center', paddingVertical: 16 },
});
