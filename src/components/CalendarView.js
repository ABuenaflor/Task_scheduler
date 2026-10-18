import { useEffect, useMemo, useState } from 'react';
import { Animated, FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '../useTopInset';
import { colors, formatMoney } from '../theme';
import { MONTHS, formatLongDate, fromKey, toKey } from '../dates';
import { sumAmounts, useExpenses } from '../store';
import { usePresence } from '../usePresence';
import IconButton from './IconButton';
import ExpenseItem from './ExpenseItem';

const WEEK_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildMonth(year, month) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array(firstWeekday).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toKey(new Date(year, month, d)));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export default function CalendarView({ visible, onClose, todayKey }) {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { byDate, removeExpense } = useExpenses();
  const { mounted, anim } = usePresence(visible, 200);
  const [selected, setSelected] = useState(todayKey);
  const [cursor, setCursor] = useState(() => fromKey(todayKey));

  useEffect(() => {
    if (visible) {
      setSelected(todayKey);
      setCursor(fromKey(todayKey));
    }
  }, [visible, todayKey]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const cells = useMemo(() => buildMonth(year, month), [year, month]);
  const monthTotal = useMemo(
    () => cells.reduce((t, k) => t + (k ? sumAmounts(byDate[k]) : 0), 0),
    [cells, byDate]
  );

  if (!mounted) return null;

  const dayItems = byDate[selected] || [];
  const shiftMonth = (n) => setCursor(new Date(year, month + n, 1));

  const header = (
    <View>
      <View style={styles.monthBar}>
        <IconButton icon="chevron-back" onPress={() => shiftMonth(-1)} label="Previous month" />
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.monthTitle}>
            {MONTHS[month]} {year}
          </Text>
          <Text style={styles.monthTotal}>{formatMoney(monthTotal)} this month</Text>
        </View>
        <IconButton icon="chevron-forward" onPress={() => shiftMonth(1)} label="Next month" />
      </View>

      <View style={styles.grid}>
        {WEEK_LETTERS.map((w, i) => (
          <Text key={i} style={styles.weekday}>
            {w}
          </Text>
        ))}
        {cells.map((key, i) => {
          if (!key) return <View key={i} style={styles.cell} />;
          const isSel = key === selected;
          const isToday = key === todayKey;
          const has = !!byDate[key]?.length;
          return (
            <Pressable key={key} style={styles.cell} onPress={() => setSelected(key)}>
              <View style={[styles.day, isToday && styles.today, isSel && styles.selected]}>
                <Text style={[styles.dayText, isSel && styles.selectedText]}>{Number(key.slice(8))}</Text>
              </View>
              <View style={[styles.dot, has && { backgroundColor: isSel ? colors.accent : colors.goldDark }]} />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dayHeader}>
        <Text style={styles.dayTitle}>{formatLongDate(fromKey(selected))}</Text>
        <View style={styles.totalPill}>
          <Text style={styles.totalPillText}>{formatMoney(sumAmounts(dayItems))}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[
          styles.screen,
          {
            paddingTop: topInset,
            opacity: anim,
            transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }) }],
          },
        ]}
      >
        <View style={styles.topBar}>
          <Text style={styles.title}>Calendar</Text>
          <IconButton icon="close" onPress={onClose} label="Close calendar" />
        </View>

        <FlatList
          data={dayItems}
          keyExtractor={(e) => e.id}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <ExpenseItem item={item} index={index} onDelete={removeExpense} />
          )}
          ListEmptyComponent={<Text style={styles.empty}>No expenses on this day</Text>}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
        />
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.gold,
    borderRadius: 16,
    padding: 6,
    marginTop: 4,
  },
  monthTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  monthTotal: { fontSize: 12, color: colors.text, opacity: 0.75, marginTop: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    marginTop: 10,
  },
  weekday: {
    width: '14.2857%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    paddingBottom: 6,
  },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: { borderWidth: 1.5, borderColor: colors.accent },
  selected: { backgroundColor: colors.gold, borderColor: colors.gold },
  dayText: { fontSize: 14, fontWeight: '600', color: colors.text },
  selectedText: { fontWeight: '800' },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2, backgroundColor: 'transparent' },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  dayTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  totalPill: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  totalPillText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 20 },
});
