import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Text,
  TextInput,
  Button,
  Card,
  Divider,
  HelperText,
} from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import { colors, typography, spacing, componentStyles } from '../../theme/theme';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [loginMethod, setLoginMethod] = useState('email'); // 'email', 'phone', 'username'
  const { login, isLoading, error } = useAuth();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    defaultValues: {
      login: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    const result = await login(data);
    if (result.success) {
      reset();
    }
  };

  const getLoginPlaceholder = () => {
    switch (loginMethod) {
      case 'email':
        return 'Enter your email';
      case 'phone':
        return 'Enter your phone number';
      case 'username':
        return 'Enter your username';
      default:
        return 'Enter email, phone, or username';
    }
  };

  const getLoginIcon = () => {
    switch (loginMethod) {
      case 'email':
        return 'mail-outline';
      case 'phone':
        return 'call-outline';
      case 'username':
        return 'person-outline';
      default:
        return 'person-outline';
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>WM</Text>
            </View>
            <Text style={styles.companyName}>Window Manufacturing</Text>
            <Text style={styles.subtitle}>Professional Window Solutions</Text>
          </View>
        </View>

        {/* Login Form */}
        <Card style={styles.formCard}>
          <Card.Content style={styles.cardContent}>
            <Text style={styles.formTitle}>Welcome Back</Text>
            <Text style={styles.formSubtitle}>Sign in to your account</Text>

            {/* Login Method Selector */}
            <View style={styles.loginMethodContainer}>
              <Text style={styles.loginMethodLabel}>Login with:</Text>
              <View style={styles.loginMethodButtons}>
                {['email', 'phone', 'username'].map((method) => (
                  <TouchableOpacity
                    key={method}
                    style={[
                      styles.methodButton,
                      loginMethod === method && styles.methodButtonActive,
                    ]}
                    onPress={() => setLoginMethod(method)}
                  >
                    <Ionicons
                      name={
                        method === 'email'
                          ? 'mail-outline'
                          : method === 'phone'
                          ? 'call-outline'
                          : 'person-outline'
                      }
                      size={16}
                      color={
                        loginMethod === method ? colors.background : colors.textSecondary
                      }
                    />
                    <Text
                      style={[
                        styles.methodButtonText,
                        loginMethod === method && styles.methodButtonTextActive,
                      ]}
                    >
                      {method.charAt(0).toUpperCase() + method.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Login Input */}
            <Controller
              control={control}
              name="login"
              rules={{
                required: 'This field is required',
                validate: (value) => {
                  if (loginMethod === 'email') {
                    return /\S+@\S+\.\S+/.test(value) || 'Invalid email address';
                  }
                  if (loginMethod === 'phone') {
                    return /^[\+]?[1-9][\d]{0,15}$/.test(value) || 'Invalid phone number';
                  }
                  return value.length >= 3 || 'Username must be at least 3 characters';
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label={getLoginPlaceholder()}
                  placeholder={getLoginPlaceholder()}
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.login}
                  style={styles.input}
                  left={<TextInput.Icon icon={getLoginIcon()} />}
                  keyboardType={
                    loginMethod === 'email'
                      ? 'email-address'
                      : loginMethod === 'phone'
                      ? 'phone-pad'
                      : 'default'
                  }
                  autoCapitalize={loginMethod === 'email' ? 'none' : 'words'}
                  autoComplete={
                    loginMethod === 'email'
                      ? 'email'
                      : loginMethod === 'phone'
                      ? 'tel'
                      : 'username'
                  }
                />
              )}
            />
            <HelperText type="error" visible={!!errors.login}>
              {errors.login?.message}
            </HelperText>

            {/* Password Input */}
            <Controller
              control={control}
              name="password"
              rules={{
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              }}
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  mode="outlined"
                  label="Password"
                  placeholder="Enter your password"
                  value={value}
                  onBlur={onBlur}
                  onChangeText={onChange}
                  error={!!errors.password}
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  left={<TextInput.Icon icon="lock-outline" />}
                  right={
                    <TextInput.Icon
                      icon={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      onPress={() => setShowPassword(!showPassword)}
                    />
                  }
                  autoComplete="password"
                />
              )}
            />
            <HelperText type="error" visible={!!errors.password}>
              {errors.password?.message}
            </HelperText>

            {/* Error Message */}
            {error && (
              <HelperText type="error" visible={true} style={styles.errorText}>
                {error}
              </HelperText>
            )}

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <Button
              mode="contained"
              onPress={handleSubmit(onSubmit)}
              loading={isLoading}
              disabled={isLoading}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              Sign In
            </Button>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <Divider style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <Divider style={styles.divider} />
            </View>

            {/* Register Link */}
            <View style={styles.registerContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </Card.Content>
        </Card>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 Window Manufacturing Company
          </Text>
          <Text style={styles.footerSubtext}>
            Professional window solutions since 2004
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: spacing.xl * 2,
    paddingBottom: spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logo: {
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
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.background,
  },
  companyName: {
    fontSize: typography.sizes.xl,
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  formCard: {
    marginBottom: spacing.xl,
    ...componentStyles.card.elevated,
  },
  cardContent: {
    padding: spacing.lg,
  },
  formTitle: {
    fontSize: typography.sizes['2xl'],
    fontFamily: typography.fontFamily.bold,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  loginMethodContainer: {
    marginBottom: spacing.lg,
  },
  loginMethodLabel: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  loginMethodButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginHorizontal: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  methodButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  methodButtonText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontFamily.medium,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  methodButtonTextActive: {
    color: colors.background,
  },
  input: {
    marginBottom: spacing.xs,
  },
  errorText: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: spacing.lg,
  },
  forgotPasswordText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fontFamily.medium,
    color: colors.primary,
  },
  loginButton: {
    marginBottom: spacing.lg,
    ...componentStyles.button.primary,
  },
  buttonContent: {
    paddingVertical: spacing.sm,
  },
  buttonLabel: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fontFamily.semiBold,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: typography.sizes.sm,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    marginHorizontal: spacing.md,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: typography.sizes.base,
    fontFamily: typography.fontFamily.semiBold,
    color: colors.primary,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  footerText: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: typography.sizes.xs,
    fontFamily: typography.fontFamily.regular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default LoginScreen;