import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Dimensions,
  FlatList,
  Animated,
  SafeAreaView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

const onboardingData = [
  {
    id: "1",
    icon: "briefcase-outline",
    title: "Find Your Next Hustle",
    description: "Discover part-time gigs and freelance opportunities within your campus community. Earn money while you study!",
    color: "#7c3aed",
  },
  {
    id: "2",
    icon: "people-outline",
    title: "Connect with Students",
    description: "Network with fellow students who need your skills. From tutoring to design, there's always someone looking for help.",
    color: "#a78bfa",
  },
  {
    id: "3",
    icon: "cash-outline",
    title: "Earn & Learn",
    description: "Build your portfolio, gain real-world experience, and earn extra cash—all without leaving your campus.",
    color: "#8b5cf6",
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);

  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      slidesRef.current.scrollToIndex({ 
        index: currentIndex + 1,
        animated: true 
      });
    } else {
      // Navigate to Login screen when on last slide
      navigation.replace("Login");
    }
  };

  const handleSkip = () => {
    navigation.replace("Login");
  };

  const renderItem = ({ item }) => (
    <View style={[styles.slideContainer, { width }]}>
      <View style={[styles.iconContainer, { backgroundColor: `${item.color}20` }]}>
        <View style={[styles.iconGlow, { backgroundColor: item.color }]} />
        <Ionicons name={item.icon} size={80} color={item.color} />
      </View>
      <Text style={styles.slideTitle}>{item.title}</Text>
      <Text style={styles.slideDescription}>{item.description}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050914" />
      
      {/* Header with Logo and Skip */}
      <View style={styles.header}>
        <Text style={styles.logo}>
          <Text style={styles.logoAccent}>Task</Text>mate.
        </Text>
        <TouchableOpacity 
          style={styles.skipButton}
          onPress={handleSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons name="arrow-forward" size={16} color="#a78bfa" />
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <FlatList
        data={onboardingData}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        bounces={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={32}
        onViewableItemsChanged={viewableItemsChanged}
        viewabilityConfig={viewConfig}
        ref={slidesRef}
        getItemLayout={(data, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
      />

      {/* Pagination Dots */}
      <View style={styles.paginationContainer}>
        {onboardingData.map((_, i) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          
          const dotWidth = scrollX.interpolate({
            inputRange,
            outputRange: [8, 20, 8],
            extrapolate: "clamp",
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.3, 1, 0.3],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              style={[
                styles.dot,
                { width: dotWidth, opacity },
              ]}
              key={i.toString()}
            />
          );
        })}
      </View>

      {/* Next/Get Started Button */}
      <TouchableOpacity 
        style={styles.nextButton}
        onPress={handleNext}
        activeOpacity={0.85}
      >
        <Text style={styles.nextText}>
          {currentIndex === onboardingData.length - 1 ? "Get Started" : "Next"}
        </Text>
        <View style={styles.buttonIcon}>
          <Ionicons 
            name={currentIndex === onboardingData.length - 1 ? "checkmark" : "arrow-forward"} 
            size={20} 
            color="white" 
          />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050914",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  logo: {
    fontSize: 24,
    color: "white",
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  logoAccent: {
    color: "#7c3aed",
  },
  skipButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f1629",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#1e2d4a",
    gap: 6,
  },
  skipText: {
    color: "#a78bfa",
    fontSize: 14,
    fontWeight: "600",
  },
  slideContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
    position: "relative",
    overflow: "hidden",
  },
  iconGlow: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 80,
    opacity: 0.2,
    transform: [{ scale: 1.5 }],
  },
  slideTitle: {
    color: "white",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  slideDescription: {
    color: "#9ca3af",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: 10,
  },
  paginationContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    position: "absolute",
    bottom: 120,
    left: 0,
    right: 0,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7c3aed",
    marginHorizontal: 4,
  },
  nextButton: {
    backgroundColor: "#7c3aed",
    marginHorizontal: 20,
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    gap: 10,
  },
  nextText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  buttonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
});