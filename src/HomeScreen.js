import { useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from './useTopInset';
import { colors, formatMoney } from './theme';
import { formatLongDate, fromKey, useTodayKey } from './dates';
import { sumAmounts, useExpenses } from './store';
import IconButton from './components/IconButton';
import ExpenseItem from './components/ExpenseItem';
import AddExpenseSheet from './components/AddExpenseSheet';
import CalendarView from './components/CalendarView';
import SideNav from './components/SideNav';

function Fab({ onPress, bottom }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 8, useNativeDriver: true }).start();
  return (
    <Animated.View style={[styles.fabWrap, { bottom, transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={() => to(0.9)}
        onPressOut={() => to(1)}
        accessibilityLabel="Add expense"
        style={styles.fab}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const todayKey = useTodayKey();
  const { byDate, removeExpense, loaded } = useExpenses();
  const [navOpen, setNavOpen] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [headerH, setHeaderH] = useState(0);

  const items = byDate[todayKey] || [];
  const total = sumAmounts(items);

  useEffect(() => {
    if (!navOpen) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setNavOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [navOpen]);

  const openCalendar = () => {
    setNavOpen(false);
    setCalOpen(true);
  };

  return (
    <View style={styles.screen}>
      <View
        style={[styles.header, { paddingTop: topInset + 6 }]}
        onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
      >
        <IconButton icon={navOpen ? 'close' : 'menu'} onPress={() => setNavOpen((o) => !o)} label="Menu" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Today</Text>
          <Text style={styles.headerSub}>{formatLongDate(fromKey(todayKey))}</Text>
        </View>
        <IconButton icon="calendar-outline" onPress={openCalendar} label="Open calendar" />
      </View>

      <FlatList
        data={items}
        keyExtractor={(e) => e.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 110 }]}
        ListHeaderComponent={
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Spent today</Text>
            <Text style={styles.totalValue}>{formatMoney(total)}</Text>
            <Text style={styles.totalCount}>
              {items.length} {items.length === 1 ? 'expense' : 'expenses'}
            </Text>
          </View>
        }
        renderItem={({ item, index }) => <ExpenseItem item={item} index={index} onDelete={removeExpense} />}
        ListEmptyComponent={loaded ? <Text style={styles.empty}>No expenses yet today</Text> : null}
        ListFooterComponent={
          items.length ? <Text style={styles.hint}>Long-press an expense to delete it</Text> : null
        }
      />

      <Fab onPress={() => setAddOpen(true)} bottom={insets.bottom + 24} />

      <SideNav open={navOpen} top={headerH} onClose={() => setNavOpen(false)} todayKey={todayKey} />
      <CalendarView visible={calOpen} onClose={() => setCalOpen(false)} todayKey={todayKey} />
      <AddExpenseSheet visible={addOpen} onClose={() => setAddOpen(false)} dateKey={todayKey} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingBottom: 8,
    backgroundColor: colors.bg,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  headerSub: { fontSize: 12, color: colors.muted, marginTop: 1 },
  list: { paddingHorizontal: 16, paddingTop: 6 },
  totalCard: {
    backgroundColor: colors.gold,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  totalLabel: { fontSize: 13, fontWeight: '600', color: colors.text, opacity: 0.75 },
  totalValue: { fontSize: 34, fontWeight: '800', color: colors.text, marginTop: 2 },
  totalCount: {
    alignSelf: 'flex-start',
    marginTop: 8,
    backgroundColor: colors.accent,
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40, fontSize: 14 },
  hint: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 6 },
  fabWrap: { position: 'absolute', right: 22 },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
