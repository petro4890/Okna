import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import LottieView from 'lottie-react-native';
import { colors, typography, spacing } from '../theme/theme';

const { width, height } = Dimensions.get('window');

const LoadingScreen = ({ message = 'Loading...', showLogo = true }) => {
  return (
    <View style={styles.container}>
      {showLogo && (
        <View style={styles.logoContainer}>
          {/* You can replace this with your company logo */}
          <View style={styles.logoPlaceholder}>
            <Text style={styles.logoText}>WM</Text>
          </View>
          <Text style={styles.companyName}>Window Manufacturing</Text>
        </View>
      )}
      
      <View style={styles.loadingContainer}>
        {/* You can replace ActivityIndicator with Lottie animation */}
        <ActivityIndicator 
          size="large" 
          color={colors.primary}
          style={styles.spinner}
        />
        
        {/* Uncomment to use Lottie animation instead */}
        {/* <LottieView
          source={require('../../assets/animations/loading.json')}
          autoPlay
          loop
          style={styles.lottieAnimation}
        /> */}
        
        <Text style={styles.loadingText}>{message}</Text>
      </View>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Professional Window Solutions
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  logoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    ...colors.shadow,
  },
  logoText: {
    fontSize: typography.sizes['3xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.background,
  },
  companyName: {
    fontSize: typography.sizes.xl,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.text,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl * 2,
  },
  spinner: {
    marginBottom: spacing.lg,
  },
  lottieAnimation: {
    width: 100,
    height: 100,
    marginBottom: spacing.lg,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});

export default LoadingScreen;