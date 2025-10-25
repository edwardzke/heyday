/**
 * Heyday Mobile Landing Screen
 * A focused mobile-first variant of the web landing page.
 *
 * @format
 */

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useColorScheme,
  View,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={isDarkMode ? '#0f311d' : '#f2f9f5'}
      />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>(
    'landing'
  );

  if (currentView === 'dashboard') {
    return (
      <DashboardScreen
        safeAreaInsets={safeAreaInsets}
        onSignOut={() => setCurrentView('landing')}
      />
    );
  }

  return (
    <LandingScreen
      safeAreaInsets={safeAreaInsets}
      onPreviewDashboard={() => setCurrentView('dashboard')}
    />
  );
}

type LandingScreenProps = {
  safeAreaInsets: { top: number; bottom: number };
  onPreviewDashboard: () => void;
};

function LandingScreen({
  safeAreaInsets,
  onPreviewDashboard,
}: LandingScreenProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const featureHighlights = useMemo(
    () => [
      {
        id: 'surfacing',
        title: 'Surface what matters',
        detail: 'Stay on top of follow-ups with timely nudges that matter.',
      },
      {
        id: 'recall',
        title: 'Remember faster',
        detail:
          'Find notes, docs, and links instantly with unified search across every workspace.',
      },
      {
        id: 'momentum',
        title: 'Keep momentum',
        detail:
          'Capture new ideas on the go so your projects never lose steam.',
      },
    ],
    []
  );

  const handleSubmit = () => {
    if (!email.trim()) {
      Alert.alert('Almost there', 'Add an email so we know how to reach you.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      Alert.alert(
        'Thanks for joining!',
        "We'll let you know as soon as the Heyday mobile beta is ready."
      );
      setEmail('');
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContainer,
          {
            paddingTop: safeAreaInsets.top + 24,
            paddingBottom: safeAreaInsets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text style={styles.logo}>heyday</Text>
          <Text style={styles.tagline}>
            Tools helping knowledge workers remember everything that matters.
          </Text>
        </View>

        <View style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>Be first in the beta</Text>
          <Text style={styles.ctaCopy}>
            Drop your email and we&apos;ll invite you as soon as the mobile experience opens.
          </Text>
          <View style={styles.formRow}>
            <TextInput
              accessibilityLabel="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="rgba(16, 48, 30, 0.5)"
              style={styles.input}
            />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={handleSubmit}
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonLabel}>
                {isSubmitting ? 'Sending…' : 'Notify me'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={onPreviewDashboard}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonLabel}>
                Already a member? View dashboard
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.featureList}>
          {featureHighlights.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.featureCard,
                index !== featureHighlights.length - 1 && styles.featureCardSpacing,
              ]}
            >
              <Text style={styles.featureTitle}>{item.title}</Text>
              <Text style={styles.featureDetail}>{item.detail}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type DashboardScreenProps = {
  safeAreaInsets: { top: number; bottom: number };
  onSignOut: () => void;
};

function DashboardScreen({ safeAreaInsets, onSignOut }: DashboardScreenProps) {
  const plantOverviews = useMemo(
    () => [
      {
        id: 'fern-loft',
        name: 'Loft Fern Collective',
        temperature: '72°F',
        humidity: '58%',
        status: 'Thriving',
        note: 'Misted this morning; next check Friday.',
      },
      {
        id: 'herb-wall',
        name: 'Kitchen Herb Wall',
        temperature: '70°F',
        humidity: '49%',
        status: 'Needs attention',
        note: 'Rosemary looking dry; deep water tonight.',
      },
      {
        id: 'atrium',
        name: 'Atrium Monstera',
        temperature: '74°F',
        humidity: '63%',
        status: 'Happy',
        note: 'Rotate quarter turn to balance light.',
      },
    ],
    []
  );

  const todos = useMemo(
    () => [
      {
        id: 'todo-1',
        title: 'Sync today’s dashboard tasks',
        detail: 'Review web dashboard tasks before noon.',
      },
      {
        id: 'todo-2',
        title: 'Repot basil cuttings',
        detail: 'Transfer to larger pots and refresh soil.',
      },
      {
        id: 'todo-3',
        title: 'Log humidity adjustments',
        detail: 'Note sensor readings after misting routine.',
      },
    ],
    []
  );

  const openWebDashboard = () => {
    Linking.openURL('https://app.heyday.so/dashboard').catch(() => {
      Alert.alert(
        'Unable to open link',
        'Visit the Heyday dashboard from your desktop browser.'
      );
    });
  };

  return (
    <View style={dashboardStyles.wrapper}>
      <ScrollView
        contentContainerStyle={[
          dashboardStyles.scrollContainer,
          {
            paddingTop: safeAreaInsets.top + 18,
            paddingBottom: safeAreaInsets.bottom + 120,
          },
        ]}
      >
        <View style={dashboardStyles.topRow}>
          <View>
            <Text style={dashboardStyles.sectionEyebrow}>
              Welcome back
            </Text>
            <Text style={dashboardStyles.sectionTitle}>
              Your greenhouse pulse
            </Text>
          </View>
          <TouchableOpacity
            onPress={onSignOut}
            style={dashboardStyles.signOutButton}
          >
            <Text style={dashboardStyles.signOutLabel}>Sign out</Text>
          </TouchableOpacity>
        </View>

        <View style={dashboardStyles.card}>
          <Text style={dashboardStyles.cardTitle}>Plant overviews</Text>
          {plantOverviews.map((plant, index) => (
            <View
              key={plant.id}
              style={[
                dashboardStyles.plantRow,
                index !== plantOverviews.length - 1 &&
                  dashboardStyles.plantRowDivider,
              ]}
            >
              <View>
                <Text style={dashboardStyles.plantName}>{plant.name}</Text>
                <Text style={dashboardStyles.plantStatus}>
                  {plant.status}
                </Text>
              </View>
              <View style={dashboardStyles.plantMetrics}>
                <Text style={dashboardStyles.plantMetricLabel}>
                  Temp
                </Text>
                <Text style={dashboardStyles.plantMetricValue}>
                  {plant.temperature}
                </Text>
                <Text style={dashboardStyles.plantMetricLabel}>
                  Humidity
                </Text>
                <Text style={dashboardStyles.plantMetricValue}>
                  {plant.humidity}
                </Text>
              </View>
              <Text style={dashboardStyles.plantNote}>{plant.note}</Text>
            </View>
          ))}
        </View>

        <View style={dashboardStyles.card}>
          <View style={dashboardStyles.todosHeader}>
            <View>
              <Text style={dashboardStyles.cardTitle}>To-do sync</Text>
              <Text style={dashboardStyles.cardSubtitle}>
                Linked with your web dashboard
              </Text>
            </View>
            <TouchableOpacity
              onPress={openWebDashboard}
              style={dashboardStyles.webButton}
            >
              <Text style={dashboardStyles.webButtonLabel}>Open web</Text>
            </TouchableOpacity>
          </View>
          {todos.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              onPress={openWebDashboard}
              style={[
                dashboardStyles.todoItem,
                index !== todos.length - 1 && dashboardStyles.todoDivider,
              ]}
            >
              <View style={dashboardStyles.todoBullet} />
              <View style={dashboardStyles.todoCopy}>
                <Text style={dashboardStyles.todoTitle}>{item.title}</Text>
                <Text style={dashboardStyles.todoDetail}>{item.detail}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <TouchableOpacity
        accessibilityRole="button"
        style={dashboardStyles.fab}
        onPress={() =>
          Alert.alert(
            'AR preview',
            'The AR plant scan experience will live here soon.'
          )
        }
      >
        <Text style={dashboardStyles.fabLabel}>AR</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f2f9f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logo: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: '#0b4d26',
  },
  tagline: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    color: 'rgba(15, 49, 29, 0.75)',
    marginTop: 12,
  },
  ctaCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    shadowColor: '#0b4d26',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    marginBottom: 28,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0b4d26',
  },
  ctaCopy: {
    fontSize: 15,
    lineHeight: 21,
    color: 'rgba(15, 49, 29, 0.7)',
    marginTop: 8,
    marginBottom: 18,
  },
  formRow: {
    marginBottom: 4,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(11, 77, 38, 0.2)',
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0f311d',
    backgroundColor: '#f9fdfb',
    marginBottom: 12,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0b4d26',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: '#f5f7f4',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(11, 77, 38, 0.25)',
    backgroundColor: 'rgba(11, 77, 38, 0.06)',
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0b4d26',
  },
  featureList: {
    marginTop: 4,
  },
  featureCard: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: 'rgba(11, 77, 38, 0.08)',
  },
  featureCardSpacing: {
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b4d26',
    marginBottom: 6,
  },
  featureDetail: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(15, 49, 29, 0.7)',
  },
});

const dashboardStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#eef6f1',
  },
  scrollContainer: {
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  sectionEyebrow: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(15, 49, 29, 0.6)',
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f311d',
    marginTop: 4,
  },
  signOutButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(11, 77, 38, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  signOutLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#0b4d26',
  },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f311d',
    marginBottom: 14,
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(15, 49, 29, 0.6)',
  },
  plantRow: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(11, 77, 38, 0.06)',
    marginBottom: 12,
  },
  plantRowDivider: {
    marginBottom: 14,
  },
  plantName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0b4d26',
  },
  plantStatus: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(15, 49, 29, 0.65)',
  },
  plantMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 14,
  },
  plantMetricLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: 'rgba(15, 49, 29, 0.55)',
  },
  plantMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f311d',
  },
  plantNote: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(15, 49, 29, 0.7)',
  },
  todosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  webButton: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
  },
  webButtonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5f7f4',
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  todoDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(11, 77, 38, 0.14)',
  },
  todoBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
    marginTop: 6,
    marginRight: 12,
  },
  todoCopy: {
    flex: 1,
  },
  todoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f311d',
  },
  todoDetail: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(15, 49, 29, 0.65)',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
  },
  fabLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f7f4',
    letterSpacing: 1,
  },
});

export default App;
