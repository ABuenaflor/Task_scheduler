import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Space to leave under the status bar. Some Android setups report a 0 inset
// even though the app draws behind the status bar, so fall back to its height.
export function useTopInset() {
  const insets = useSafeAreaInsets();
  const androidBar = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;
  return Math.max(insets.top, androidBar);
}
