import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ExpensesProvider } from './src/store';
import HomeScreen from './src/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <ExpensesProvider>
        {/* Draw under a transparent status bar on every screen, with dark icons on the light background. */}
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
        <HomeScreen />
      </ExpensesProvider>
    </SafeAreaProvider>
  );
}
