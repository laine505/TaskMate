import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../supabaseClient';
import { useUser } from '../context/Usercontext';


const CATEGORIES       = ['Coding', 'Design', 'Writing', 'Tutoring', 'Photography', 'Video', 'Research', 'Errands'];
const DELIVERY_OPTIONS = ['1 day', '2-3 days', '4-5 days', '1 week', '2 weeks'];
const DIFFICULTY_OPTIONS = ['Easy', 'Intermediate', 'Advanced'];

export default function PostGigScreen({ navigation }) {
  const { user } = useUser();

  const [step,        setStep]        = useState(1);
  const [title,       setTitle]       = useState('');
  const [category,    setCategory]    = useState('');
  const [description, setDescription] = useState('');
  const [budget,      setBudget]      = useState('');
  const [delivery,    setDelivery]    = useState('');
  const [difficulty,  setDifficulty]  = useState('');
  const [tags,        setTags]        = useState('');
  const [imageUri,    setImageUri]    = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [posted,      setPosted]      = useState(false);


  const resetForm = () => {
    setPosted(false); setStep(1);
    setTitle(''); setCategory(''); setDescription('');
    setBudget(''); setDelivery(''); setDifficulty('');
    setTags(''); setImageUri(null);
  };


  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to upload a cover image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };


  const uploadImage = async () => {
    if (!imageUri) return null;
    const fileExt  = imageUri.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `gig-covers/${fileName}`;
    const response = await fetch(imageUri);
    const blob     = await response.blob();
    const { error } = await supabase.storage
      .from('gig-images')
      .upload(filePath, blob, { contentType: `image/${fileExt}` });
    if (error) throw error;
    const { data } = supabase.storage.from('gig-images').getPublicUrl(filePath);
    return data.publicUrl;
  };


  const handlePost = async () => {
    if (!title || !category || !budget) {
      Alert.alert('Missing Fields', 'Please fill in title, category, and price.');
      return;
    }
    setUploading(true);
    try {
      const imageUrl   = await uploadImage();
      const posterName =
        user?.user_metadata?.full_name ||
        user?.email?.split('@')[0] ||
        'Taskmate User';

      const { error } = await supabase.from('gigs').insert({
        user_id:     user.id,
        title,
        category,
        description,
        tags,
        price:       parseFloat(budget),
        delivery,
        difficulty,
        image_url:   imageUrl,
        poster_name: posterName,
        school:      user?.user_metadata?.school ?? '',
      });

      if (error) throw error;
      setPosted(true);
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to post gig. Please try again.');
    } finally {
      setUploading(false);
    }
  };



  if (posted) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#050914" />
        <View style={styles.successScreen}>
          <View style={styles.successRing}>
            <View style={styles.successCircle}>
              <Ionicons name="rocket" size={44} color="#7c3aed" />
            </View>
          </View>

          <Text style={styles.successTitle}>Gig is Live! 🎉</Text>
          <Text style={styles.successSub}>
            Your service is now visible to students across the campus network.
          </Text>

          <View style={styles.successPill}>
            <Ionicons name="pricetag-outline" size={14} color="#7c3aed" />
            <Text style={styles.successPillText} numberOfLines={1}>{title}</Text>
          </View>

          <TouchableOpacity
            style={styles.successBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Home')}
          >
            <Ionicons name="home-outline" size={18} color="white" />
            <Text style={styles.successBtnText}>Go to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.successBtnOutline}
            activeOpacity={0.8}
            onPress={resetForm}
          >
            <Text style={styles.successBtnOutlineText}>Post Another Gig</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Post a Gig</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Step Indicator */}
        <View style={styles.stepRow}>
          <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
          <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
          <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
        </View>
        <Text style={styles.stepLabel}>
          {step === 1 ? 'Step 1 of 2 – Basic Info' : 'Step 2 of 2 – Pricing & Delivery'}
        </Text>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <>
            {/* Cover Image */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Cover Image</Text>
              <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.8}>
                {imageUri ? (
                  <>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
                    <View style={styles.imageOverlay}>
                      <Ionicons name="camera-outline" size={22} color="white" />
                      <Text style={styles.imageOverlayText}>Change Photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <View style={styles.imagePlaceholderIcon}>
                      <Ionicons name="image-outline" size={30} color="#7c3aed" />
                    </View>
                    <Text style={styles.imagePlaceholderTitle}>Add a Cover Image</Text>
                    <Text style={styles.imagePlaceholderSub}>16:9 ratio recommended</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Title */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Gig Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. I will build your mobile app in React Native"
                placeholderTextColor="#374151"
                value={title}
                onChangeText={setTitle}
                maxLength={80}
              />
              <Text style={styles.charCount}>{title.length}/80</Text>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                placeholder="Describe your service in detail..."
                placeholderTextColor="#374151"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Tags */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Tags (comma-separated)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. React Native, Figma, Logo Design"
                placeholderTextColor="#374151"
                value={tags}
                onChangeText={setTags}
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep(2)} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Next Step</Text>
              <Ionicons name="arrow-forward" size={18} color="white" />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <>
            {/* Price */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Price (₱) *</Text>
              <View style={styles.priceRow}>
                <Text style={styles.pesoSign}>₱</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#374151"
                  value={budget}
                  onChangeText={setBudget}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Delivery Time */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Delivery Time</Text>
              <View style={styles.chipGrid}>
                {DELIVERY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, delivery === opt && styles.chipActive]}
                    onPress={() => setDelivery(opt)}
                  >
                    <Text style={[styles.chipText, delivery === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Difficulty */}
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Difficulty Level</Text>
              <View style={styles.chipGrid}>
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.chip, difficulty === opt && styles.chipActive]}
                    onPress={() => setDifficulty(opt)}
                  >
                    <Text style={[styles.chipText, difficulty === opt && styles.chipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Summary Preview */}
            {title && category && budget ? (
              <View style={styles.summaryCard}>
                {imageUri && (
                  <Image source={{ uri: imageUri }} style={styles.summaryImage} resizeMode="cover" />
                )}
                <View style={styles.summaryBody}>
                  <View style={styles.summaryHeader}>
                    <Ionicons name="eye-outline" size={14} color="#7c3aed" />
                    <Text style={styles.summaryTitle}>Gig Preview</Text>
                  </View>
                  {[
                    { icon: 'create-outline',   text: title },
                    { icon: 'pricetag-outline',  text: category },
                    { icon: 'cash-outline',      text: `₱${parseInt(budget || 0).toLocaleString()}` },
                    ...(delivery ? [{ icon: 'time-outline', text: delivery }] : []),
                  ].map(({ icon, text }) => (
                    <View key={icon} style={styles.summaryRow}>
                      <Ionicons name={icon} size={14} color="#a78bfa" />
                      <Text style={styles.summaryText} numberOfLines={1}>{text}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.backBtn2}
                onPress={() => setStep(1)}
                activeOpacity={0.8}
                disabled={uploading}
              >
                <Ionicons name="chevron-back" size={18} color="#9ca3af" />
                <Text style={styles.backBtn2Text}>Back</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { flex: 1 }, uploading && styles.primaryBtnDisabled]}
                onPress={handlePost}
                activeOpacity={0.85}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <>
                    <Ionicons name="rocket-outline" size={18} color="white" />
                    <Text style={styles.primaryBtnText}>Post Gig</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#050914' },

  // ── Header ────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0d1527',
  },
  backBtn: {
    width: 36, height: 36,
    borderRadius: 12,
    backgroundColor: '#0b1120',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1a2540',
  },
  headerTitle: { color: 'white', fontSize: 17, fontWeight: '800' },

  // ── Content ───────────────────────────────────────────────────────────────
  content: { padding: 20, paddingBottom: 60 },

  // ── Step Indicator ────────────────────────────────────────────────────────
  stepRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  stepDot:        { width: 14, height: 14, borderRadius: 7, backgroundColor: '#1a2540' },
  stepDotActive:  { backgroundColor: '#7c3aed' },
  stepLine:       { flex: 1, height: 2, backgroundColor: '#1a2540' },
  stepLineActive: { backgroundColor: '#7c3aed' },
  stepLabel:      { fontSize: 13, color: '#a78bfa', fontWeight: '600', marginBottom: 24 },

  // ── Fields ────────────────────────────────────────────────────────────────
  field:      { marginBottom: 22 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#9ca3af', marginBottom: 10, letterSpacing: 0.2 },
  charCount:  { color: '#374151', fontSize: 11, textAlign: 'right', marginTop: 4 },

  input: {
    backgroundColor: '#0b1120',
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: 'white',
    borderWidth: 1,
    borderColor: '#1a2540',
  },
  textarea: { minHeight: 110 },

  // ── Image Picker ──────────────────────────────────────────────────────────
  imagePicker: {
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#1a2540',
    borderStyle: 'dashed',
    backgroundColor: '#0b1120',
  },
  imagePreview:  { width: '100%', height: '100%' },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imageOverlayText:      { color: 'white', fontSize: 14, fontWeight: '600' },
  imagePlaceholder:      { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  imagePlaceholderIcon: {
    width: 60, height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(124,58,237,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderTitle: { fontSize: 15, fontWeight: '600', color: '#9ca3af' },
  imagePlaceholderSub:   { fontSize: 12, color: '#4b5563' },

  // ── Chips ─────────────────────────────────────────────────────────────────
  chipGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 9,
    backgroundColor: '#0b1120',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#1a2540',
  },
  chipActive:     { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText:       { color: '#6b7280', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: 'white' },

  // ── Price Input ───────────────────────────────────────────────────────────
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1120',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1a2540',
    overflow: 'hidden',
  },
  pesoSign:   { paddingHorizontal: 16, fontSize: 22, color: '#7c3aed', fontWeight: '800' },
  priceInput: { flex: 1, paddingVertical: 14, fontSize: 20, fontWeight: '700', color: 'white' },

  // ── Summary Card ──────────────────────────────────────────────────────────
  summaryCard: {
    backgroundColor: '#0b1120',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 22,
    borderWidth: 1,
    borderColor: '#1a2540',
    borderLeftWidth: 3,
    borderLeftColor: '#7c3aed',
  },
  summaryImage:  { width: '100%', height: 100 },
  summaryBody:   { padding: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  summaryTitle:  { color: '#7c3aed', fontWeight: '700', fontSize: 12 },
  summaryRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryText:   { fontSize: 13, color: '#9ca3af', flex: 1 },

  // ── Buttons ───────────────────────────────────────────────────────────────
  buttonRow: { flexDirection: 'row', gap: 10 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 16,
    paddingVertical: 17,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.4, shadowOpacity: 0 },
  primaryBtnText:     { color: 'white', fontSize: 16, fontWeight: '700' },
  backBtn2: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 17,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#1a2540',
    backgroundColor: '#0b1120',
  },
  backBtn2Text: { color: '#9ca3af', fontSize: 15, fontWeight: '600' },

  // ── Success Screen ────────────────────────────────────────────────────────
  successScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  successRing: {
    width: 120, height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(124,58,237,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  successCircle: {
    width: 88, height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(124,58,237,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successTitle: { fontSize: 26, fontWeight: '900', color: 'white', textAlign: 'center' },
  successSub:   { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 21 },
  successPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  successPillText: { color: '#a78bfa', fontWeight: '700', fontSize: 13, flexShrink: 1 },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#7c3aed',
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    marginTop: 8,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  successBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  successBtnOutline: {
    paddingVertical: 15,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#1a2540',
  },
  successBtnOutlineText: { color: '#6b7280', fontSize: 15, fontWeight: '600' },
});