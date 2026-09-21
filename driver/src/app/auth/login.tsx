import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Bike, Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react-native';

export default function DriverLoginScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      return;
    }
    const success = await login(username.trim(), password);
    if (success) {
      router.replace('/(tabs)');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.primary }]}>
            <Bike size={44} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={[styles.appName, { color: colors.primary, fontFamily: Fonts.extraBold }]}>
            FoxShop Captain
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            بوابة الكباتن والتوصيل السريع
          </Text>
        </View>

        {/* Login Form Card */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            تسجيل دخول الكابتن
          </Text>

          {error && (
            <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
              <AlertCircle size={18} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.medium }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Username / Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              اسم المستخدم أو رقم الهاتف
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <User size={20} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: Fonts.regular }]}
                placeholder="أدخل اسم المستخدم"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={(val) => {
                  setUsername(val);
                  if (error) clearError();
                }}
                autoCapitalize="none"
                textAlign="right"
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              كلمة المرور
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
              <TextInput
                style={[styles.input, { color: colors.text, fontFamily: Fonts.regular }]}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(val) => {
                  setPassword(val);
                  if (error) clearError();
                }}
                secureTextEntry={!showPassword}
                textAlign="right"
              />
              <Lock size={20} color={colors.textSecondary} />
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            activeOpacity={0.85}
            style={[styles.submitButton, { backgroundColor: colors.primary }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.submitButtonText, { fontFamily: Fonts.bold }]}>
                تسجيل الدخول
              </Text>
            )}
          </TouchableOpacity>

          {/* Register Link */}
          <TouchableOpacity
            onPress={() => router.push('/auth/register')}
            style={styles.registerLink}
          >
            <Text style={[styles.registerLinkText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              لست مسجلاً ككابتن بعد؟{' '}
              <Text style={{ color: colors.primary, fontFamily: Fonts.bold }}>
                انضم إلى فريق فوكس شوب
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: Radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    marginBottom: Spacing.md,
  },
  appName: {
    fontSize: 28,
  },
  tagline: {
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    gap: Spacing.lg,
  },
  formTitle: {
    fontSize: 18,
    textAlign: 'center',
  },
  errorBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    textAlign: 'right',
  },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    height: 52,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  submitButton: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  registerLink: {
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  registerLinkText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
