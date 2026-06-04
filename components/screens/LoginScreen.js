import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  StatusBar, ScrollView, SafeAreaView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image, Linking
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../../supabaseClient";
import { useUser } from "../context/Usercontext";

export default function LoginScreen() {
  const { saveUser } = useUser();

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const resetForm = () => {
    setEmail(""); setPassword(""); setConfirmPassword("");
    setFullName(""); setSchool(""); setError(""); setSuccess("");
  };

  const handleLogin = async () => {
    if (!email || !password) { setError("Please enter your email and password."); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address."); return; }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError) {
        console.error("Profile fetch error:", profileError);
      }

      if (profile) {
        await saveUser(profile);
      } else {
        await saveUser({
          id: data.user.id,
          email: data.user.email,
          name: data.user.email.split("@")[0],
          school: "",
          image_url: null,
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!fullName || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
      });
      if (authError) throw authError;

      const userId = data?.user?.id;
      if (!userId) throw new Error("Signup failed — no user ID returned.");

      const profileData = {
        id: userId,
        name: fullName,
        school: school,
        email: email.trim().toLowerCase(),
      };

      const { error: upsertError } = await supabase
        .from("users")
        .upsert(profileData, { onConflict: "id" });

      if (upsertError) {
        console.error("Upsert error:", upsertError);
        throw new Error("Profile save failed: " + upsertError.message);
      }

      setSuccess("Account created! Please log in.");
      setIsLogin(true);
      setPassword("");
      setConfirmPassword("");
      setFullName("");
      setSchool("");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => (isLogin ? handleLogin() : handleSignUp());

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.header}>
            <Text style={styles.logo}>Taskmate</Text>
            <Text style={styles.tagline}>
              {isLogin ? "Welcome back" : "Create your account"}
            </Text>
          </View>

          <View style={styles.toggle}>
            <TouchableOpacity
              style={[styles.tab, isLogin && styles.activeTab]}
              onPress={() => { setIsLogin(true); resetForm(); }}
            >
              <Text style={isLogin ? styles.activeText : styles.text}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, !isLogin && styles.activeTab]}
              onPress={() => { setIsLogin(false); resetForm(); }}
            >
              <Text style={!isLogin ? styles.activeText : styles.text}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            {!isLogin && (
              <Input label="Full Name" value={fullName} setValue={setFullName} icon="person-outline" />
            )}
            {!isLogin && (
              <Input label="School" value={school} setValue={setSchool} icon="school-outline" />
            )}
            <Input label="Email" value={email} setValue={setEmail} icon="mail-outline" />
            <PasswordInput
              label="Password"
              value={password}
              setValue={setPassword}
              show={showPassword}
              toggle={() => setShowPassword(!showPassword)}
            />
            {!isLogin && (
              <PasswordInput
                label="Confirm"
                value={confirmPassword}
                setValue={setConfirmPassword}
                show={showConfirmPassword}
                toggle={() => setShowConfirmPassword(!showConfirmPassword)}
              />
            )}

            {!!success && <Text style={styles.success}>{success}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}

            <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? "Login" : "Create Account"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>
                {isLogin ? "Or log in with" : "Or sign up with"}
              </Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialContainer}>
              <TouchableOpacity
                style={[styles.socialButton, styles.facebookButton]}
                onPress={() => Linking.openURL("https://www.facebook.com/login")}
              >
                <Image
                  source={require("../../assets/facebook.png")}
                  style={styles.socialLogo}
                  resizeMode="contain"
                />
                <Text style={styles.socialText}>Continue with Facebook</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialButton, styles.googleButton]}
                onPress={() => Linking.openURL("https://accounts.google.com/signin")}
              >
                <Image
                  source={require("../../assets/google.png")}
                  style={styles.socialLogo}
                  resizeMode="contain"
                />
                <Text style={[styles.socialText, { color: "#000" }]}>
                  Continue with Google
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Credits & Admin Info Footer Section */}
          <View style={styles.footerContainer}>
            <Text style={styles.footerCreditsTitle}>Developed by</Text>
            <Text style={styles.footerCreditsNames}>
              Trisha Laine Belon, Kurt Calvin Biclar, Pauline Jenel Loro, Ace Magbanua
            </Text>
            
            <View style={styles.adminInfoBox}>
              <Text style={styles.adminLabel}>Admin Access</Text>
              <Text style={styles.adminText}>
                Email: <Text style={styles.adminHighlight}>admin@taskmate.com</Text>
              </Text>
              <Text style={styles.adminText}>
                Password: <Text style={styles.adminHighlight}>123456</Text>
              </Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const Input = ({ label, value, setValue, icon }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputBox}>
      <Ionicons name={icon} size={18} color="#888" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        placeholder={label}
        placeholderTextColor="#666"
        autoCapitalize="none"
      />
    </View>
  </View>
);

const PasswordInput = ({ label, value, setValue, show, toggle }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <View style={styles.inputBox}>
      <Ionicons name="lock-closed-outline" size={18} color="#888" />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={setValue}
        secureTextEntry={!show}
        placeholder={label}
        placeholderTextColor="#666"
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={toggle}>
        <Ionicons name={show ? "eye-off" : "eye"} size={18} color="#888" />
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0b0f1a" },
  scrollContent: { 
    flexGrow: 1, 
    padding: 24,
    paddingBottom: 40 // Crucial fix: adds extra space at the bottom so the footer isn't cut off
  },
  header: { marginBottom: 30 },
  logo: { fontSize: 32, color: "#7c3aed", fontWeight: "bold" },
  tagline: { color: "#aaa" },
  toggle: { flexDirection: "row", marginBottom: 20 },
  tab: { flex: 1, padding: 10, alignItems: "center" },
  activeTab: { borderBottomWidth: 2, borderColor: "#7c3aed" },
  text: { color: "#888" },
  activeText: { color: "#fff" },
  form: { gap: 12 },
  inputGroup: { gap: 5 },
  label: { color: "#aaa", fontSize: 12 },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  input: { flex: 1, color: "#fff" },
  button: {
    backgroundColor: "#7c3aed",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: { color: "#fff", fontWeight: "bold" },
  success: { color: "#22c55e", textAlign: "center" },
  error: { color: "#ef4444", textAlign: "center" },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#2d2d2d",
  },
  dividerText: {
    color: "#888",
    fontSize: 12,
  },
  socialContainer: {
    gap: 12,
  },
  socialButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },
  facebookButton: {
    backgroundColor: "#1877F2",
  },
  googleButton: {
    backgroundColor: "#ffffff",
  },
  socialText: {
    fontWeight: "bold",
    color: "#fff",
  },
  socialLogo: {
    width: 20,
    height: 20,
  },
  footerContainer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    alignItems: "center",
  },
  footerCreditsTitle: {
    color: "#6b7280",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  footerCreditsNames: {
    color: "#9ca3af",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  adminInfoBox: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  adminLabel: {
    color: "#7c3aed",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  adminText: {
    color: "#9ca3af",
    fontSize: 12,
    lineHeight: 16,
  },
  adminHighlight: {
    color: "#fff",
    fontWeight: "600",
  },
});