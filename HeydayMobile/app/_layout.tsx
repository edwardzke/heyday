import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#4CAF50' },
        headerTintColor: '#fff',
        contentStyle: { backgroundColor: '#E8F5E9' },
      }}
    />
  );
}