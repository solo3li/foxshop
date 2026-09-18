import React, { useState } from 'react';
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
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();

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
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              style={styles.backBtn}
            >
              <ArrowLeft color="#1F2937" size={24} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}>
              <Text style={styles.guestText}>تصفح كـ زائر</Text>
            </TouchableOpacity>
          </View>

          {/* Welcome */}
          <View style={styles.welcomeSection}>
            <Text style={styles.title}>إنشاء حساب جديد</Text>
            <Text style={styles.subtitle}>انضم إلى فوكس شوب واستمتع بأشهى الوجبات</Text>
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
                <Text style={styles.inputLabel}>الاسم الأول *</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="مثال: أحمد"
                    placeholderTextColor="#9CA3AF"
                    value={firstName}
                    onChangeText={(val) => { clearError(); setFirstName(val); }}
                  />
                </View>
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>اسم العائلة</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="مثال: علي"
                    placeholderTextColor="#9CA3AF"
                    value={lastName}
                    onChangeText={(val) => { clearError(); setLastName(val); }}
                  />
                </View>
              </View>
            </View>

            {/* Username */}
            <Text style={styles.inputLabel}>اسم المستخدم *</Text>
            <View style={styles.inputContainer}>
              <User size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="أدخل اسم مستخدم فريد"
                placeholderTextColor="#9CA3AF"
                value={username}
                onChangeText={(val) => { clearError(); setUsername(val); }}
                autoCapitalize="none"
              />
            </View>

            {/* Phone Number */}
            <Text style={styles.inputLabel}>رقم الجوال *</Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="05XXXXXXXX أو +9665XXXXXXXX"
                placeholderTextColor="#9CA3AF"
                value={phoneNumber}
                onChangeText={(val) => { clearError(); setPhoneNumber(val); }}
                keyboardType="phone-pad"
              />
            </View>

            {/* Password */}
            <Text style={styles.inputLabel}>كلمة المرور (٦ خانات على الأقل) *</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#9CA3AF" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => { clearError(); setPassword(val); }}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                {showPassword ? <EyeOff size={20} color="#9CA3AF" /> : <Eye size={20} color="#9CA3AF" />}
              </TouchableOpacity>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, (!isFormValid || isLoading) && styles.submitBtnDisabled]}
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
              <Text style={styles.loginLabel}>لديك حساب بالفعل؟</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={styles.loginLink}>تسجيل الدخول</Text>
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
  guestText: { fontSize: 14, color: Colors.light.primary, fontWeight: '600' },
  welcomeSection: { alignItems: 'center', marginTop: 16, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
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
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 16,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 14, color: '#111827', textAlign: 'right' },
  eyeBtn: { padding: 6 },
  submitBtn: {
    backgroundColor: Colors.light.primary,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: Colors.light.primary,
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
  loginLink: { fontSize: 14, fontWeight: 'bold', color: Colors.light.primary },
});
