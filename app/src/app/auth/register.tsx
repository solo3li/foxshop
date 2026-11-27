import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Lock, Phone, ArrowLeft, AlertCircle, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { useAuthStore } from '../../store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { register, isAuthenticated, isHydrated, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isHydrated, isAuthenticated, router]);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!firstName.trim() || !username.trim() || !phoneNumber.trim() || !password) {
      return;
    }
    const success = await register({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      phone_number: phoneNumber.trim(),
      password,
    });
    if (success) {
      router.replace('/(tabs)');
    }
  };

  const isFormValid = firstName.trim() && username.trim() && phoneNumber.trim() && password.length >= 6;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              style={[styles.backBtn, { backgroundColor: theme.surfaceSecondary }]}
            >
              <ArrowLeft color={theme.text} size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Text style={[styles.guestText, { color: theme.primary }]}>تصفح كـ زائر</Text>
            </TouchableOpacity>
          </View>

          {/* Welcome */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.title, { color: theme.text }]}>إنشاء حساب جديد</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>انضم إلى فوكس شوب واستمتع بأشهى الوجبات</Text>
          </View>

          {/* Error Banner */}
          {error && (
            <View style={styles.errorBanner}>
              <AlertCircle size={18} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Form */}
          <View style={styles.form}>
            {/* First & Last Name */}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>الاسم الأول *</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="مثال: أحمد"
                    placeholderTextColor={theme.textMuted}
                    value={firstName}
                    onChangeText={(val) => { clearError(); setFirstName(val); }}
                  />
                </View>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>اسم العائلة</Text>
                <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="مثال: علي"
                    placeholderTextColor={theme.textMuted}
                    value={lastName}
                    onChangeText={(val) => { clearError(); setLastName(val); }}
                  />
                </View>
              </View>
            </View>

            {/* Username */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>اسم المستخدم *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
              <User size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="أدخل اسم مستخدم فريد"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={(val) => { clearError(); setUsername(val); }}
                autoCapitalize="none"
              />
            </View>

            {/* Phone Number */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>رقم الجوال *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
              <Phone size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="01XXXXXXXXX أو +201XXXXXXXXX"
                placeholderTextColor={theme.textMuted}
                value={phoneNumber}
                onChangeText={(val) => { clearError(); setPhoneNumber(val); }}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>كلمة المرور (٦ خانات على الأقل) *</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
              <Lock size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => { clearError(); setPassword(val); }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color={theme.textMuted} /> : <Eye size={20} color={theme.textMuted} />}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: theme.primary, shadowColor: theme.primary },
                (!isFormValid || isLoading) && styles.submitBtnDisabled,
              ]}
              onPress={handleRegister}
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>تسجيل الحساب</Text>
              )}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginRow}>
              <Text style={[styles.loginLabel, { color: theme.textSecondary }]}>لديك حساب بالفعل؟</Text>
              <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/auth/login'))}>
                <Text style={[styles.loginLink, { color: theme.primary }]}>تسجيل الدخول</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guestText: { fontSize: 14, color: '#D70F64', fontWeight: '600' },
  welcomeSection: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    marginBottom: 18,
    gap: 8,
  },
  errorText: { color: '#DC2626', fontSize: 14, flex: 1, textAlign: 'right' },
  form: { width: '100%' },
  row: { flexDirection: 'row', width: '100%' },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: '#111827', textAlign: 'right' },
  eyeBtn: { padding: 6 },
  submitBtn: {
    backgroundColor: '#D70F64',
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  loginRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 6,
  },
  loginLabel: { fontSize: 14, color: '#6B7280' },
  loginLink: { fontSize: 14, fontWeight: 'bold', color: '#D70F64' },
});
