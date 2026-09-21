import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Bike, Car, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react-native';

export default function DriverRegisterScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { register, isLoading, error, clearError } = useAuthStore();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [vehicleType, setVehicleType] = useState<'MOTORCYCLE' | 'CAR' | 'BICYCLE'>('MOTORCYCLE');
  const [licensePlate, setLicensePlate] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const vehicleOptions = [
    { key: 'MOTORCYCLE', label: 'دراجة نارية / سكوتر', icon: Bike },
    { key: 'CAR', label: 'سيارة', icon: Car },
    { key: 'BICYCLE', label: 'دراجة هوائية', icon: Bike },
  ] as const;

  const handleRegister = async () => {
    if (!firstName.trim() || !lastName.trim() || !username.trim() || !phoneNumber.trim() || !password.trim()) {
      setLocalError('يرجى ملء جميع الحقول الإلزامية');
      return;
    }
    if (password.length < 6) {
      setLocalError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setLocalError(null);

    const result = await register({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      phone_number: phoneNumber.trim(),
      password: password,
      vehicle_type: vehicleType,
      license_plate: licensePlate.trim(),
    });

    if (result.success) {
      router.replace('/auth/pending');
    }
  };

  const displayedError = localError || error;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Return Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <ArrowRight size={20} color={colors.text} />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.extraBold }]}>
            انضم إلى كباتن FoxShop
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            سجل بياناتك وابدأ في تحقيق دخل مميز مع مرونة كاملة في ساعات العمل
          </Text>
        </View>

        {/* Error Alert */}
        {displayedError && (
          <View style={[styles.errorBanner, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}>
            <AlertCircle size={18} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger, fontFamily: Fonts.medium }]}>
              {displayedError}
            </Text>
          </View>
        )}

        {/* Form Fields */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Name Row */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                الاسم الأخير *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="السيد"
                placeholderTextColor={colors.textMuted}
                value={lastName}
                onChangeText={(val) => { setLastName(val); setLocalError(null); }}
                textAlign="right"
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                الاسم الأول *
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="أحمد"
                placeholderTextColor={colors.textMuted}
                value={firstName}
                onChangeText={(val) => { setFirstName(val); setLocalError(null); }}
                textAlign="right"
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              اسم المستخدم للدخول *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="ahmed_driver"
              placeholderTextColor={colors.textMuted}
              value={username}
              onChangeText={(val) => { setUsername(val); setLocalError(null); }}
              autoCapitalize="none"
              textAlign="right"
            />
          </View>

          {/* Phone Number */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              رقم الهاتف المحمول *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="+201xxxxxxxxx"
              placeholderTextColor={colors.textMuted}
              value={phoneNumber}
              onChangeText={(val) => { setPhoneNumber(val); setLocalError(null); }}
              keyboardType="phone-pad"
              textAlign="right"
            />
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              كلمة المرور (6 خانات على الأقل) *
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={(val) => { setPassword(val); setLocalError(null); }}
              secureTextEntry
              textAlign="right"
            />
          </View>

          {/* Vehicle Type Selection */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              نوع وسيلة التوصيل *
            </Text>
            <View style={styles.vehicleOptionsRow}>
              {vehicleOptions.map((opt) => {
                const isSelected = vehicleType === opt.key;
                const IconComp = opt.icon;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    onPress={() => setVehicleType(opt.key)}
                    activeOpacity={0.8}
                    style={[
                      styles.vehicleCard,
                      {
                        backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                        borderColor: isSelected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <IconComp size={22} color={isSelected ? colors.primary : colors.textSecondary} />
                    <Text
                      style={[
                        styles.vehicleLabel,
                        {
                          color: isSelected ? colors.primary : colors.textSecondary,
                          fontFamily: isSelected ? Fonts.bold : Fonts.medium,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* License Plate Number */}
          {vehicleType !== 'BICYCLE' && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                رقم اللوحة المرورية
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="مثال: أ ب ج 1234"
                placeholderTextColor={colors.textMuted}
                value={licensePlate}
                onChangeText={(val) => setLicensePlate(val)}
                textAlign="right"
              />
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
            style={[styles.submitBtn, { backgroundColor: colors.primary }]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.submitBtnText, { fontFamily: Fonts.bold }]}>
                إرسال طلب الانضمام
              </Text>
            )}
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
    padding: Spacing.xl,
    paddingTop: Spacing.xxxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    alignSelf: 'flex-end',
  },
  header: {
    alignItems: 'flex-end',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 8,
    marginBottom: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    textAlign: 'right',
  },
  formCard: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row-reverse',
    gap: Spacing.md,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    textAlign: 'right',
  },
  input: {
    height: 48,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  vehicleOptionsRow: {
    flexDirection: 'row-reverse',
    gap: Spacing.sm,
  },
  vehicleCard: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  vehicleLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  submitBtn: {
    height: 52,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    elevation: 4,
    shadowColor: '#D70F64',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});
