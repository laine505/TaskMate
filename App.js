import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createStackNavigator } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { View, ActivityIndicator } from "react-native";

import { UserProvider, useUser } from "./components/context/Usercontext";

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
import AdminView from "./components/screens/AdminView";
import MessageScreen from "./components/screens/MessageScreen";
import GigDetailScreen from "./components/screens/GigDetailScreen";
import JobDetailScreen from "./components/screens/JobDetailScreen";

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const RootStack = createStackNavigator();

function ExploreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="PostGig" component={PostGigScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="GigDetail" component={GigDetailScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    </Stack.Navigator>
  );
}

function InboxStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="InboxList" component={InboxScreen} />
      <Stack.Screen name="MessageThread" component={MessageScreen} />
    </Stack.Navigator>
  );
}

function JobsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="JobsList" component={JobsScreen} />
      <Stack.Screen name="PostJob" component={PostJobScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { orderNotifCount } = useUser();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#050914",
          height: 62,
          borderTopWidth: 1,
          borderTopColor: "#111827",
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#7c3aed",
        tabBarInactiveTintColor: "#4b5563",
        tabBarIcon: ({ color, focused }) => {
          const icons = {
            Explore: focused ? "compass" : "compass-outline",
            Jobs: focused ? "briefcase" : "briefcase-outline",
            Orders: focused ? "clipboard" : "clipboard-outline",
            Inbox: focused ? "chatbubble" : "chatbubble-outline",
            Profile: focused ? "person" : "person-outline",
          };
          return (
            <View>
              <Ionicons name={icons[route.name]} size={22} color={color} />
              {route.name === "Orders" && orderNotifCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -6,
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: "#ef4444",
                    borderWidth: 1,
                    borderColor: "#050914",
                  }}
                />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Explore" component={ExploreStack} />
      <Tab.Screen name="Jobs" component={JobsStack} />
      <Tab.Screen name="Orders" component={OrdersScreen} />
      <Tab.Screen name="Inbox" component={InboxStack} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminView" component={AdminView} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
}

function NavigationGate() {
  const { user, loading } = useUser();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: "#050914" }}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <RootStack.Screen name="Auth" component={AuthStack} />
      ) : user.is_admin === true ? (
        <RootStack.Screen name="AdminApp" component={AdminStack} />
      ) : (
        <RootStack.Screen name="MainApp" component={MainTabs} />
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <UserProvider>
      <NavigationContainer>
        <NavigationGate />
      </NavigationContainer>
    </UserProvider>
  );
}