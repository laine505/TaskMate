import React, { createContext, useState, useContext, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../supabaseClient";

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orderNotifCount, setOrderNotifCount] = useState(0);

  const clearOrderNotifs = () => setOrderNotifCount(0);

  useEffect(() => {
    const loadUser = async () => {
      try {
        // 1. Load cached user from storage first (instant UI)
        const savedUser = await AsyncStorage.getItem("@taskmate_user");
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        // 2. Check if there's an active Supabase session
        const { data: sessionData } = await supabase.auth.getSession();
        const sessionUser = sessionData?.session?.user;

        if (sessionUser) {
          // 3. ALWAYS re-fetch fresh profile from DB — never trust cache for image_url
          const { data: profile, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", sessionUser.id)
            .single();

          if (!error && profile) {
            setUser(profile);
            await AsyncStorage.setItem("@taskmate_user", JSON.stringify(profile));
          }
        } else {
          // No active session — clear any stale cached user
          setUser(null);
          await AsyncStorage.removeItem("@taskmate_user");
        }
      } catch (e) {
        console.error("Failed to load user", e);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const saveUser = async (userData) => {
    // Guard against function updaters — only accept plain objects
    if (typeof userData === "function") {
      const resolved = userData(user);
      userData = resolved;
    }
    try {
      setUser(userData);
      await AsyncStorage.setItem("@taskmate_user", JSON.stringify(userData));
    } catch (e) {
      console.error("Error saving user", e);
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
      await AsyncStorage.removeItem("@taskmate_user");
      setUser(null);
    } catch (e) {
      console.error("Logout error", e);
    }
  };

  return (
    <UserContext.Provider value={{ user, saveUser, logout, loading, orderNotifCount, setOrderNotifCount, clearOrderNotifs }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
