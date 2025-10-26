import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Link } from 'expo-router';

const DASHBOARD_URL = 'https://app.heyday.so/dashboard';
const MENU_WIDTH = 320;

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTranslateX = useRef(new Animated.Value(MENU_WIDTH)).current;
  const dragStart = useRef(MENU_WIDTH);
  const { width: screenWidth } = Dimensions.get('window');

  const plantOverviews = useMemo(
    () => [
      {
        id: 'greenhouse-west',
        title: 'West Greenhouse',
        status: 'Thriving',
        note: 'Rotate monsteras 45° tomorrow to balance sunlight.',
        metrics: [
          { label: 'Temp', value: '72°F' },
          { label: 'Humidity', value: '61%' },
        ],
      },
      {
        id: 'atrium-fern',
        title: 'Atrium Fern Shelf',
        status: 'Needs mist',
        note: 'Morning humidity dipped below range. Schedule a midday mist.',
        metrics: [
          { label: 'Temp', value: '68°F' },
          { label: 'Humidity', value: '47%' },
        ],
      },
      {
        id: 'kitchen-herbs',
        title: 'Kitchen Herb Wall',
        status: 'Stable',
        note: 'Clip basil tops and log nutrient mix after dinner prep.',
        metrics: [
          { label: 'Temp', value: '70°F' },
          { label: 'Humidity', value: '54%' },
        ],
      },
    ],
    []
  );

  const todoItems = useMemo(
    () => [
      {
        id: 'todo-sync',
        title: 'Sync today’s tasks',
        detail: 'Review the desktop dashboard before noon for new follow-ups.',
      },
      {
        id: 'todo-nutrients',
        title: 'Update nutrient schedule',
        detail: 'Confirm this week’s fertiliser mix and log dosage changes.',
      },
      {
        id: 'todo-journal',
        title: 'Capture journal photos',
        detail: 'Add growth shots to the plant journal gallery tonight.',
      },
    ],
    []
  );

  const openWebDashboard = () => {
    Linking.openURL(DASHBOARD_URL).catch(() => {
      Alert.alert(
        'Unable to open dashboard',
        'Visit the Heyday web dashboard from your browser to continue.'
      );
    });
  };

  const fabBottom = Math.max(insets.bottom + 20, 36);
  const topBarHeight = 72;

  const animateMenu = useCallback(
    (open: boolean) => {
      setMenuOpen(open);
      Animated.timing(menuTranslateX, {
        toValue: open ? 0 : MENU_WIDTH,
        duration: 220,
        useNativeDriver: true,
      }).start();
    },
    [menuTranslateX]
  );

  const toggleMenu = () => {
    animateMenu(!menuOpen);
  };

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => {
        const { dx, dy, moveX } = gesture;
        if (Math.abs(dx) < Math.abs(dy)) {
          return false;
        }
        if (menuOpen) {
          return Math.abs(dx) > 6;
        }
        const fromEdge = moveX > screenWidth - 32;
        return fromEdge && dx < -8;
      },
      onPanResponderGrant: () => {
        dragStart.current = menuOpen ? 0 : MENU_WIDTH;
      },
      onPanResponderMove: (_, { dx }) => {
        const base = dragStart.current;
        let next = base + dx;
        next = Math.min(MENU_WIDTH, Math.max(0, next));
        menuTranslateX.setValue(next);
      },
      onPanResponderRelease: (_, { dx, vx }) => {
        const base = dragStart.current;
        let next = base + dx;
        next = Math.min(MENU_WIDTH, Math.max(0, next));
        const velocity = vx ?? 0;
        const shouldOpen =
          velocity < -0.3
            ? true
            : velocity > 0.3
            ? false
            : next < MENU_WIDTH / 2;
        animateMenu(shouldOpen);
      },
      onPanResponderTerminate: () => {
        animateMenu(menuOpen);
      },
    });
  }, [animateMenu, menuOpen, menuTranslateX, screenWidth]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.container} {...panResponder.panHandlers}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top - 16,
              paddingBottom: fabBottom + 8,
            },
          ]}
          showsVerticalScrollIndicator={false}
          bounces
        >
          <View style={styles.card}>
            <View style={styles.todoInlineHeader}>
              <Text style={styles.cardTitle}>To-do sync</Text>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={openWebDashboard}
                style={styles.todoInlineCTA}
              >
                <Text style={styles.todoInlineCTALabel}>Open web</Text>
              </TouchableOpacity>
            </View>
            {todoItems.length > 0 && (
              <TouchableOpacity
                accessibilityRole="button"
                onPress={openWebDashboard}
                style={styles.todoInlineItem}
              >
                <View style={styles.todoInlineBullet} />
                <View style={styles.todoInlineCopy}>
                  <Text style={styles.todoInlineTitle}>{todoItems[0].title}</Text>
                  <Text style={styles.todoInlineDetail}>{todoItems[0].detail}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Plant overviews</Text>
            {plantOverviews.map((plant) => (
              <View key={plant.id} style={styles.plantCard}>
                <View style={styles.plantHeader}>
                  <View>
                    <Text style={styles.plantTitle}>{plant.title}</Text>
                    <Text style={styles.plantStatus}>{plant.status}</Text>
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={openWebDashboard}
                    style={styles.manageLink}
                  >
                    <Text style={styles.manageLinkLabel}>Manage</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.metricRow}>
                  {plant.metrics.map((metric) => (
                    <View key={metric.label} style={styles.metric}>
                      <Text style={styles.metricLabel}>{metric.label}</Text>
                      <Text style={styles.metricValue}>{metric.value}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.plantNote}>{plant.note}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {menuOpen && (
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => animateMenu(false)}
            style={styles.backdrop}
            {...panResponder.panHandlers}
          />
        )}

        <Animated.View
          pointerEvents={menuOpen ? 'auto' : 'none'}
          style={[
            styles.sideMenu,
            {
              transform: [{ translateX: menuTranslateX }],
              paddingBottom: insets.bottom + 24,
            },
          ]}
        >
          <Text style={styles.sideMenuTitle}>Menu</Text>
          <View style={styles.sideMenuList}>
            {[
              {
                id: 'profile',
                label: 'User profile',
                description: 'Edit personal info and avatar.',
              },
              {
                id: 'account',
                label: 'Account details',
                description: 'Manage email, password, and sign-in devices.',
              },
              {
                id: 'settings',
                label: 'Settings',
                description: 'Adjust notifications and integrations.',
              },
              {
                id: 'preferences',
                label: 'Preferences',
                description: 'Tune themes and accessibility options.',
              },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(item.label, 'Coming soon to mobile! Visit the web dashboard for full controls.')
                }
                style={styles.menuTodoItem}
              >
                <Text style={styles.menuTodoTitle}>{item.label}</Text>
                <Text style={styles.menuTodoDetail}>{item.description}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {/*
          <TouchableOpacity
            accessibilityRole="button"
            onPress={openWebDashboard}
            style={styles.menuCTA}
          >
            <Text style={styles.menuCTALabel}>Open on web</Text>
          </TouchableOpacity>
          */}
        </Animated.View>

        <View
          style={[styles.topBar, { top: -48, height: topBarHeight }]}
        >
          {/*
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            onPress={() =>
              Alert.alert('Placeholder', 'Quick actions will appear here soon.')
            }
            style={[styles.topButton, styles.placeholderButton]}
          >
            <Text style={styles.topButtonLabel}>H</Text>
          </TouchableOpacity>
          */}

          <View style={styles.topBarTitles}>
            <Text style={styles.headerEyebrow}>Welcome back</Text>
            <Text style={styles.headerTitle}>Your greenhouse pulse</Text>
          </View>

          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.9}
            onPress={toggleMenu}
            style={[styles.topButton, styles.menuButton]}
          >
            {menuOpen ? (
              <Text style={styles.topButtonLabel}>×</Text>
            ) : (
              <View style={styles.menuIcon}>
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
                <View style={styles.menuLine} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Camera button - Truly standalone, direct child of SafeAreaView */}
      <Link href="/camerapage" asChild>
        <TouchableOpacity
          accessibilityRole="button"
          activeOpacity={0.9}
          style={styles.bottomFab}
        >
          <Text style={styles.fabLabel}>📷</Text>
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#eef6f1',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef6f1',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    gap: 24,
  },
  headerEyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(15, 49, 29, 0.6)',
    textAlign: 'left',
  },
  headerTitle: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '600',
    color: '#0f311d',
    textAlign: 'left',
    flexWrap: 'wrap',
  },
  card: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
    gap: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f311d',
  },
  cardSubtitle: {
    fontSize: 13,
    color: 'rgba(15, 49, 29, 0.6)',
    marginTop: 2,
  },
  plantCard: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: 'rgba(11, 77, 38, 0.07)',
    gap: 14,
  },
  plantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  plantTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0b4d26',
  },
  plantStatus: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: '#4b8f63',
  },
  manageLink: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
  },
  manageLinkLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f5f7f4',
    letterSpacing: 0.4,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  metric: {
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'rgba(15, 49, 29, 0.55)',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f311d',
  },
  plantNote: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(15, 49, 29, 0.7)',
  },
  todoInlineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  todoInlineCTA: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0b4d26',
  },
  todoInlineCTALabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5f7f4',
  },
  todoInlineItem: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  todoInlineBullet: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
    marginTop: 6,
  },
  todoInlineCopy: {
    flex: 1,
    gap: 4,
  },
  todoInlineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f311d',
  },
  todoInlineDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(15, 49, 29, 0.65)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 49, 29, 0.25)',
  },
  topBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    borderRadius: 4,
    backgroundColor: '#eef6f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 30,
  },
  topBarTitles: {
    flex: 1,
    marginHorizontal: 8,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  topButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#0b4d26',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  topButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f5f7f4',
    letterSpacing: 0.6,
  },
  placeholderButton: {
    backgroundColor: '#0b4d26',
  },
  menuButton: {
    backgroundColor: '#0b4d26',
  },
  menuIcon: {
    width: 18,
    height: 12,
    justifyContent: 'space-between',
  },
  menuLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: '#f5f7f4',
  },
  bottomFab: {
    position: 'absolute',
    right: 40,
    bottom: 40,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#0b4d26',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0b4d26',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 6,
    zIndex: 50, // Higher than everything
  },
  fabLabel: {
    fontSize: 24,
    fontWeight: '600',
    color: '#f5f7f4',
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 280,
    bottom: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 48,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    shadowColor: '#0b4d26',
    shadowOffset: { width: -8, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
    gap: 16,
    zIndex: 30,
  },
  sideMenuTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f311d',
  },
  sideMenuList: {
    marginTop: 12,
    marginBottom: 12,
  },
  menuTodoItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(11, 77, 38, 0.12)',
  },
  menuTodoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f311d',
    marginBottom: 4,
  },
  menuTodoDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(15, 49, 29, 0.65)',
  },
  menuCTA: {
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: '#0b4d26',
  },
  menuCTALabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f5f7f4',
  },
});
