import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Clock, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react-native';

export default function DriverPendingApprovalScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { logout } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);

  const handleSupportContact = () => {
    Linking.openURL('https://wa.me/201000000000?text=مرحباً، أود الاستفسار عن تفعيل حساب الكابتن في فوكس شوب');
  };

  const handleBackToLogin = async () => {
    await logout();
    router.replace('/auth/login');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Animated Icon Container */}
        <View style={[styles.iconContainer, { backgroundColor: colors.warningLight }]}>
          <Clock size={52} color={colors.warning} strokeWidth={2.2} />
        </View>

        <Text style={[styles.title, { color: colors.text, fontFamily: Fonts.extraBold }]}>
          طلبك قيد المراجعة والتدقيق
        </Text>

        <Text style={[styles.description, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
          شكراً لانضمامك إلى عائلة كباتن FoxShop! يقوم فريق الإدارة حالياً بمراجعة بياناتك ووسيلة التوصيل.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CheckCircle2 size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text, fontFamily: Fonts.medium }]}>
            يتم فحص الطلبات عادةً خلال 24 ساعة، وستصلك رسالة تأكيد فور التفعيل.
          </Text>
        </View>

        {/* WhatsApp Support Button */}
        <TouchableOpacity
          onPress={handleSupportContact}
          activeOpacity={0.85}
          style={[styles.actionBtn, { backgroundColor: colors.success }]}
        >
          <MessageSquare size={20} color="#FFFFFF" />
          <Text style={[styles.actionBtnText, { fontFamily: Fonts.bold }]}>
            تواصل مع خدمة الكباتن عبر واتساب
          </Text>
        </TouchableOpacity>

        {/* Return to Login */}
        <TouchableOpacity
          onPress={handleBackToLogin}
          style={[styles.returnBtn, { borderColor: colors.border }]}
        >
          <Text style={[styles.returnBtnText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            العودة لصفحة تسجيل الدخول
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoBox: {
    flexDirection: 'row-reverse',
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    marginVertical: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: Radius.lg,
    gap: 8,
    marginTop: Spacing.xs,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  returnBtn: {
    paddingVertical: 10,
    marginTop: Spacing.xs,
  },
  returnBtnText: {
    fontSize: 13,
  },
});
