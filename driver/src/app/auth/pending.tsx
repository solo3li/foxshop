import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { Clock, CheckCircle2, MessageSquare, RefreshCw, Sparkles } from 'lucide-react-native';
import { centrifugo } from '../../services/centrifugo';

export default function DriverPendingApprovalScreen() {
  const router = useRouter();
  const { colors } = useThemeStore();
  const { user, logout, checkApprovalStatus, setApproved } = useAuthStore();
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Real-time listener via Centrifugo for instant auto-approval
  useEffect(() => {
    if (!user?.id) return;
    centrifugo.connect(user.id);

    const channel = `orders:driver_${user.id}`;
    const unsubscribe = centrifugo.subscribe(channel, (data) => {
      if (data?.event === 'DRIVER_APPROVED') {
        setApproved();
        router.replace('/(tabs)');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.id]);

  const handleManualCheck = async () => {
    setIsChecking(true);
    setCheckMessage(null);
    const isApproved = await checkApprovalStatus();
    setIsChecking(false);

    if (isApproved) {
      router.replace('/(tabs)');
    } else {
      setCheckMessage('الحساب لا يزال قيد المراجعة والتدقيق الإداري. سنرسل لك إشعاراً فور تفعيله.');
    }
  };

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
          مرحباً كابتن {user?.first_name || ''}! يقوم فريق الإدارة حالياً بمراجعة بياناتك ووسيلة التوصيل.
        </Text>

        <View style={[styles.infoBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CheckCircle2 size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.text, fontFamily: Fonts.medium }]}>
            يتم فحص الطلبات بسرعة، وسيتم تفعيل حسابك ونقلك لشاشة العمل تلقائياً فور موافقة الإدارة.
          </Text>
        </View>

        {checkMessage && (
          <View style={[styles.checkBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.checkBannerText, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
              {checkMessage}
            </Text>
          </View>
        )}

        {/* Check Status Button */}
        <TouchableOpacity
          onPress={handleManualCheck}
          disabled={isChecking}
          activeOpacity={0.85}
          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
        >
          {isChecking ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <RefreshCw size={18} color="#FFFFFF" />
              <Text style={[styles.actionBtnText, { fontFamily: Fonts.bold }]}>
                التحقق من تفعيل الحساب الآن
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* WhatsApp Support Button */}
        <TouchableOpacity
          onPress={handleSupportContact}
          activeOpacity={0.85}
          style={[styles.actionBtn, { backgroundColor: colors.success }]}
        >
          <MessageSquare size={18} color="#FFFFFF" />
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
    padding: Spacing.xl,
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
    marginVertical: Spacing.xs,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'right',
  },
  checkBanner: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    width: '100%',
  },
  checkBannerText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 50,
    borderRadius: Radius.lg,
    gap: 8,
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
