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
  Modal,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Lock, Eye, EyeOff, ArrowLeft, AlertCircle, CheckCircle2, Phone, X, ShoppingBag } from 'lucide-react-native';
import { useTheme } from '../../hooks/use-theme';
import { useAuthStore } from '../../store/authStore';
import { PasswordKeySvg } from '../../components/DiscoveryIcons';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { login, isAuthenticated, isHydrated, isLoading, error, clearError } = useAuthStore();

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isHydrated, isAuthenticated, router]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      return;
    }
    const success = await login(username.trim(), password);
    if (success) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    }
  };

  const handleSendRecovery = async () => {
    if (!recoveryIdentifier.trim()) {
      setRecoveryError('الرجاء إدخال اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني');
      return;
    }
    setRecoveryError('');
    setRecoveryLoading(true);
    // Simulate recovery request / API
    setTimeout(() => {
      setRecoveryLoading(false);
      setRecoverySuccess(true);
    }, 1200);
  };

  const handleContactSupport = () => {
    const text = encodeURIComponent(`مرحباً فوكس شوب، أود المساعدة في استعادة كلمة المرور لحسابي: ${recoveryIdentifier || username}`);
    Linking.openURL(`https://wa.me/201000000000?text=${text}`).catch(() => {
      // Fallback
      Linking.openURL('tel:19000');
    });
  };

  const resetForgotModal = () => {
    setShowForgotModal(false);
    setRecoveryIdentifier('');
    setRecoverySuccess(false);
    setRecoveryError('');
  };

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

          {/* Logo & Welcome */}
          <View style={styles.welcomeSection}>
            <View style={[styles.logoBadge, { backgroundColor: theme.primary }]}>
              <ShoppingBag size={28} color="#FFFFFF" strokeWidth={2} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>تسجيل الدخول</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>أهلاً بك مجدداً في فوكس شوب</Text>
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
            {/* Username Input */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>اسم المستخدم</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
              <User size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="أدخل اسم المستخدم"
                placeholderTextColor={theme.textMuted}
                value={username}
                onChangeText={(val) => {
                  clearError();
                  setUsername(val);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password Input */}
            <Text style={[styles.inputLabel, { color: theme.text }]}>كلمة المرور</Text>
            <View style={[styles.inputContainer, { backgroundColor: theme.surfaceSecondary }]}>
              <Lock size={20} color={theme.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="أدخل كلمة المرور"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(val) => {
                  clearError();
                  setPassword(val);
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <EyeOff size={20} color={theme.textMuted} />
                ) : (
                  <Eye size={20} color={theme.textMuted} />
                )}
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => {
                setRecoveryIdentifier(username);
                setShowForgotModal(true);
              }}
              style={styles.forgotBtn}
            >
              <Text style={[styles.forgotText, { color: theme.primary }]}>نسيت كلمة المرور؟</Text>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                { backgroundColor: theme.primary, shadowColor: theme.primary },
                (!username.trim() || !password || isLoading) && styles.submitBtnDisabled,
              ]}
              onPress={handleLogin}
              disabled={!username.trim() || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitBtnText}>تسجيل الدخول</Text>
              )}
            </TouchableOpacity>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerLabel, { color: theme.textSecondary }]}>ليس لديك حساب؟</Text>
              <TouchableOpacity onPress={() => router.push('/auth/register' as any)}>
                <Text style={[styles.registerLink, { color: theme.primary }]}>إنشاء حساب جديد</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Recovery Modal */}
      <Modal
        visible={showForgotModal}
        transparent
        animationType="fade"
        onRequestClose={resetForgotModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.recoveryCard, { backgroundColor: theme.card }]}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={resetForgotModal} style={[styles.modalCloseBtn, { backgroundColor: theme.surfaceSecondary }]}>
                <X size={20} color={theme.text} />
              </TouchableOpacity>
              <Text style={[styles.modalHeaderTitle, { color: theme.text }]}>استعادة كلمة المرور</Text>
              <View style={{ width: 32 }} />
            </View>

            {/* Icon Banner */}
            <View style={[styles.recoveryIconCircle, { backgroundColor: theme.primaryLight }]}>
              <PasswordKeySvg size={36} color={theme.primary} />
            </View>

            {recoverySuccess ? (
              <View style={styles.successBox}>
                <CheckCircle2 size={40} color="#10B981" style={{ alignSelf: 'center', marginBottom: 12 }} />
                <Text style={[styles.successTitle, { color: theme.text }]}>تم إرسال تعليمات الاستعادة!</Text>
                <Text style={[styles.successDesc, { color: theme.textSecondary }]}>
                  إذا كان الحساب مسجلاً لدينا، فستتلقى رسالة نصية أو بريد إلكتروني يحتوي على رابط إعادة تعيين كلمة المرور فوراً.
                </Text>
                <TouchableOpacity
                  style={[styles.closeDoneBtn, { backgroundColor: theme.primary }]}
                  onPress={resetForgotModal}
                >
                  <Text style={styles.closeDoneBtnText}>حسناً، فهمت</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                <Text style={[styles.recoveryInstruction, { color: theme.textSecondary }]}>
                  أدخل اسم المستخدم أو رقم هاتفك المسجل أو بريدك الإلكتروني لإرسال كود استعادة الحساب.
                </Text>

                {recoveryError ? (
                  <View style={styles.recoveryErrorBox}>
                    <AlertCircle size={16} color="#EF4444" />
                    <Text style={styles.recoveryErrorText}>{recoveryError}</Text>
                  </View>
                ) : null}

                <View style={[styles.inputContainer, { marginTop: 12, backgroundColor: theme.surfaceSecondary }]}>
                  <User size={18} color={theme.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder="اسم المستخدم / رقم الهاتف / الإيميل"
                    placeholderTextColor={theme.textMuted}
                    value={recoveryIdentifier}
                    onChangeText={(val) => {
                      setRecoveryIdentifier(val);
                      if (recoveryError) setRecoveryError('');
                    }}
                    autoCapitalize="none"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.recoverySubmitBtn, { backgroundColor: theme.primary }, recoveryLoading && { opacity: 0.7 }]}
                  onPress={handleSendRecovery}
                  disabled={recoveryLoading}
                >
                  {recoveryLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.recoverySubmitText}>إرسال كود الاستعادة</Text>
                  )}
                </TouchableOpacity>

                {/* Support Option */}
                <View style={styles.supportDividerRow}>
                  <View style={[styles.supportDivider, { backgroundColor: theme.border }]} />
                  <Text style={[styles.supportDividerText, { color: theme.textMuted }]}>أو</Text>
                  <View style={[styles.supportDivider, { backgroundColor: theme.border }]} />
                </View>

                <TouchableOpacity
                  style={styles.whatsappSupportBtn}
                  onPress={handleContactSupport}
                >
                  <Phone size={18} color="#10B981" />
                  <Text style={styles.whatsappSupportText}>التواصل مع خدمة العملاء للمساعدة</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
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
  guestText: {
    fontSize: 14,
    color: '#D70F64',
    fontWeight: '600',
  },
  welcomeSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFF1F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 0,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    gap: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  form: {
    width: '100%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 0,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
    textAlign: 'right',
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: '#D70F64',
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  registerLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  registerLink: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D70F64',
  },
  forgotBtn: {
    alignSelf: 'flex-start',
    marginTop: -8,
    marginBottom: 20,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#D70F64',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recoveryCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  recoveryIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF1F2',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recoveryInstruction: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 8,
  },
  recoveryErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 0,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
    gap: 8,
  },
  recoveryErrorText: {
    color: '#DC2626',
    fontSize: 13,
    flex: 1,
    textAlign: 'right',
  },
  recoverySubmitBtn: {
    backgroundColor: '#D70F64',
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  recoverySubmitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  supportDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  supportDivider: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  supportDividerText: {
    marginHorizontal: 10,
    fontSize: 12,
    color: '#9CA3AF',
  },
  whatsappSupportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 0,
    height: 48,
    borderRadius: 24,
    gap: 8,
  },
  whatsappSupportText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#059669',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 20,
  },
  closeDoneBtn: {
    backgroundColor: '#D70F64',
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
});
