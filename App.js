import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator, StatusBar } from "react-native";

import { UserProvider, useUser } from "./components/context/Usercontext";
import { ThemeProvider, useTheme } from "./components/context/ThemeContext";

import OnboardingScreen from "./components/screens/OnboardingScreen";
import LoginScreen from "./components/screens/LoginScreen";
import HomeScreen from "./components/screens/HomeScreen";
import JobsScreen from "./components/screens/JobsScreen";
import OrdersScreen from "./components/screens/OrdersScreen";
import InboxScreen from "./components/screens/InboxScreen";
import ProfileScreen from "./components/screens/ProfileScreen";
import PostGigScreen from "./components/screens/PostGigScreen";
import PostJobScreen from "./components/screens/PostJobScreen";
import NotificationsScreen from "./components/screens/NotificationsScreen";
import MessageScreen from "./components/screens/MessageScreen";
import AdminScreen from "./components/screens/AdminScreen";

const ADMIN_EMAILS = ["admin@taskmate.com"];

function checkIsAdmin(user) {
  if (!user) return false;
  return (
    user?.is_admin === true ||
    ADMIN_EMAILS.includes(user?.email) ||
    user?.user_metadata?.is_admin === true
  );
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

// ── Auth Stack ────────────────────────────────────────────────────────────────
function AuthStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Login" component={LoginScreen} />
      <RootStack.Screen name="Onboarding" component={OnboardingScreen} />
    </RootStack.Navigator>
  );
}

// ── Sub-stacks ────────────────────────────────────────────────────────────────
function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="PostGig" component={PostGigScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function JobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JobsList" component={JobsScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
    </Stack.Navigator>
  );
}

// ── Main Tabs ─────────────────────────────────────────────────────────────────
function MainTabs() {
  const { theme: t } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: t.tabBg,
          height: 62,
          borderTopWidth: 1,
          borderTopColor: t.tabBorder,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textFaint,
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Explore: focused ? "compass" : "compass-outline",
            Jobs: focused ? "briefcase" : "briefcase-outline",
            Orders: focused ? "clipboard" : "clipboard-outline",
            Inbox: focused ? "chatbubble" : "chatbubble-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return <Ionicons name={icons[route.name]} size={22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Jobs" component={JobsStack} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Inbox" component={InboxScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ── App Stack (logged in) ─────────────────────────────────────────────────────
function AppStack({ isAdmin }) {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAdmin ? (
        <RootStack.Screen name="AdminDashboard" component={AdminScreen} />
      ) : (
        <RootStack.Screen name="UserInterface" component={MainTabs} />
      )}
      <RootStack.Screen name="MessageThread" component={MessageScreen} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen} />
      <RootStack.Screen name="AdminView" component={AdminScreen} />
      <RootStack.Screen name="UserView" component={MainTabs} />
    </RootStack.Navigator>
  );
}

// ── Navigation Gate ───────────────────────────────────────────────────────────
function NavigationGate() {
  const { user, loading } = useUser();
  const { theme: t } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: t.bg }}>
        <ActivityIndicator size="large" color={t.accent} />
      </View>
    );
  }

  // KEY FIX: separate components + React key prop forces full
  // unmount/remount when auth state flips. This is what makes
  // logout actually navigate away instantly.
  if (!user) {
    return <AuthStack key="auth" />;
  }

  return <AppStack key="app" isAdmin={checkIsAdmin(user)} />;
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <UserProvider>
        <NavigationContainer>
          <StatusBar barStyle="auto" />
          <NavigationGate />
        </NavigationContainer>
      </UserProvider>
    </ThemeProvider>
  );
}