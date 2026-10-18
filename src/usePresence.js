import { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

// Keeps an overlay mounted while it animates out. `anim` goes 0 -> 1 on show.
export function usePresence(visible, duration = 200) {
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(anim, {
        toValue: 0,
        duration: Math.round(duration * 0.8),
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, anim, duration]);

  return { mounted: mounted || visible, anim };
}
