import { useEffect, useRef } from 'react';
import { Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, formatMoney, getCategory } from '../theme';
import { formatTime } from '../dates';

export default function ExpenseItem({ item, index = 0, onDelete }) {
  const cat = getCategory(item.category);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 220,
      delay: Math.min(index, 8) * 30,
      useNativeDriver: true,
    }).start();
  }, [anim, index]);

  const confirmDelete = () =>
    Alert.alert('Delete expense?', `${item.description || cat.label} · ${formatMoney(item.amount)}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(item.id) },
    ]);

  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
      }}
    >
      <Pressable
        onLongPress={onDelete ? confirmDelete : undefined}
        delayLongPress={350}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        <View style={[styles.icon, { backgroundColor: cat.color + '22' }]}>
          <Ionicons name={cat.icon} size={20} color={cat.color} />
        </View>
        <View style={styles.middle}>
          <Text style={styles.desc} numberOfLines={1}>
            {item.description || cat.label}
          </Text>
          <Text style={styles.meta}>
            {cat.label} · {formatTime(item.createdAt)}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { flex: 1, marginHorizontal: 12 },
  desc: { fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.muted, marginTop: 2 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
});
