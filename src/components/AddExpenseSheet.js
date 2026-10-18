import { useEffect, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTopInset } from '../useTopInset';
import { CATEGORIES, CURRENCY, colors } from '../theme';
import { useExpenses } from '../store';
import { usePresence } from '../usePresence';

export default function AddExpenseSheet({ visible, onClose, dateKey }) {
  const insets = useSafeAreaInsets();
  const topInset = useTopInset();
  const { addExpense } = useExpenses();
  const { mounted, anim } = usePresence(visible, 220);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('food');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
      setDescription('');
      setCategory('food');
      setError('');
    }
  }, [visible]);

  if (!mounted) return null;

  const save = () => {
    const value = parseFloat(amount.replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than 0');
      return;
    }
    addExpense({
      amount: Math.round(value * 100) / 100,
      description: description.trim(),
      category,
      date: dateKey,
    });
    onClose();
  };

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.fill, { paddingTop: topInset + 12 }]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: anim }]}>
          <Pressable style={styles.fill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 16,
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] }) },
              ],
            },
          ]}
        >
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            <View style={styles.handle} />
            <Text style={styles.title}>New Expense</Text>

            <Text style={styles.label}>Amount</Text>
            <View style={[styles.amountBox, !!error && { borderColor: colors.danger }]}>
              <Text style={styles.currency}>{CURRENCY}</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => {
                  setAmount(t.replace(/[^0-9.,]/g, ''));
                  setError('');
                }}
                placeholder="0.00"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                autoFocus
                style={styles.amountInput}
              />
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.label}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="What was it for?"
              placeholderTextColor={colors.muted}
              style={styles.input}
              maxLength={80}
              returnKeyType="done"
            />

            <Text style={styles.label}>Label</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => {
                const active = c.key === category;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setCategory(c.key)}
                    style={[styles.chip, active && { backgroundColor: c.color, borderColor: c.color }]}
                  >
                    <Ionicons name={c.icon} size={15} color={active ? '#fff' : c.color} />
                    <Text style={[styles.chipText, active && { color: '#fff' }]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={save}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveText}>Save Expense</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, marginBottom: 4 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.gold,
    paddingHorizontal: 14,
  },
  currency: { fontSize: 26, fontWeight: '700', color: colors.goldDark, marginRight: 6 },
  amountInput: { flex: 1, fontSize: 28, fontWeight: '700', color: colors.text, paddingVertical: 10 },
  error: { color: colors.danger, fontSize: 12, marginTop: 6 },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  saveBtn: {
    marginTop: 22,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
