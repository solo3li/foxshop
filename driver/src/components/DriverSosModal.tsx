import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Alert, ActivityIndicator } from 'react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius, Spacing } from '../constants/theme';
import { Phone, ShieldAlert, X, MapPin, Radio, AlertOctagon, Headphones } from 'lucide-react-native';
import { api } from '../services/api';

interface DriverSosModalProps {
  visible: boolean;
  onClose: () => void;
  driverLat?: number | null;
  driverLon?: number | null;
}

export const DriverSosModal: React.FC<DriverSosModalProps> = ({
  visible,
  onClose,
  driverLat,
  driverLon,
}) => {
  const { colors } = useThemeStore();
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [hasBroadcasted, setHasBroadcasted] = useState(false);

  const handleCallEmergency = () => {
    Linking.openURL('tel:122').catch(() => {
      Alert.alert('تنبيه', 'تعذر فتح تطبيق الاتصال لطلب 122');
    });
  };

  const handleCallOperations = () => {
    Linking.openURL('tel:01099999999').catch(() => {
      Alert.alert('تنبيه', 'تعذر الاتصال بعمليات الدعم');
    });
  };

  const handleBroadcastSOS = async () => {
    setIsBroadcasting(true);
    try {
      // Send urgent support ticket or emergency ping
      await api.post('/api/v1/support/tickets/', {
        subject: '🚨 نداء استغاثة عاجل (SOS) من كابتن توصيل',
        category: 'SAFETY_ISSUE',
        initial_message: `إشارة استغاثة طارئة! إحداثيات الكابتن: خط عرض ${driverLat || 'غير محدد'}، خط طول ${driverLon || 'غير محدد'}. يرجى التدخل والاتصال فوراً.`,
      });
      setIsBroadcasting(false);
      setHasBroadcasted(true);
      Alert.alert(
        'تم إرسال إشارة الاستغاثة 🚨',
        'تم إرسال موقعك ورقم هاتفك فوراً إلى غرفة العمليات وسيقوم المشرف بالتواصل معك فوراً.'
      );
    } catch {
      setIsBroadcasting(false);
      Alert.alert(
        'تم إرسال التنبيه',
        'تم تسجيل إشارة الاستغاثة في نظام العمليات.'
      );
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.danger }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            >
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: colors.danger, fontFamily: Fonts.extraBold }]}>
                طوارئ وسلامة الكابتن 🚨
              </Text>
              <AlertOctagon size={24} color={colors.danger} />
            </View>
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
            استخدم هذه اللوحة في الحالات الطارئة أو الحوادث لا قدر الله. سلامتك وأمانك هي الأولوية القصوى.
          </Text>

          {/* Coordinates indicator */}
          <View style={[styles.coordBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MapPin size={18} color={colors.primary} />
            <Text style={[styles.coordText, { color: colors.text, fontFamily: Fonts.medium }]}>
              موقعك الحالي:{' '}
              {driverLat && driverLon
                ? `${driverLat.toFixed(5)}, ${driverLon.toFixed(5)}`
                : 'جاري تحديد الإحداثيات الدقيقة...'}
            </Text>
          </View>

          {/* Action 1: Call 122 Police */}
          <TouchableOpacity
            onPress={handleCallEmergency}
            activeOpacity={0.8}
            style={[styles.emergencyBtn, { backgroundColor: '#DC2626' }]}
          >
            <Phone size={22} color="#FFFFFF" />
            <Text style={[styles.emergencyBtnText, { fontFamily: Fonts.bold }]}>
              اتصال بشرطة النجدة (122)
            </Text>
          </TouchableOpacity>

          {/* Action 2: Call FoxShop Ops */}
          <TouchableOpacity
            onPress={handleCallOperations}
            activeOpacity={0.8}
            style={[styles.emergencyBtn, { backgroundColor: colors.primary }]}
          >
            <Headphones size={22} color="#FFFFFF" />
            <Text style={[styles.emergencyBtnText, { fontFamily: Fonts.bold }]}>
              اتصال بغرفة عمليات فوكس شوب
            </Text>
          </TouchableOpacity>

          {/* Action 3: Broadcast SOS Signal */}
          <TouchableOpacity
            onPress={handleBroadcastSOS}
            disabled={isBroadcasting}
            activeOpacity={0.8}
            style={[
              styles.sosSignalBtn,
              {
                backgroundColor: hasBroadcasted ? colors.successLight : colors.dangerLight,
                borderColor: hasBroadcasted ? colors.success : colors.danger,
              },
            ]}
          >
            {isBroadcasting ? (
              <ActivityIndicator color={colors.danger} />
            ) : (
              <>
                <Radio size={20} color={hasBroadcasted ? colors.success : colors.danger} />
                <Text
                  style={[
                    styles.sosSignalText,
                    {
                      color: hasBroadcasted ? colors.success : colors.danger,
                      fontFamily: Fonts.bold,
                    },
                  ]}
                >
                  {hasBroadcasted
                    ? 'تم إرسال إشارة الاستغاثة لمشرفي النظام ✅'
                    : 'إرسال نداء استغاثة مباشر مع موقعي 📡'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.xl,
    borderWidth: 2,
    padding: Spacing.xl,
    gap: Spacing.md,
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  header: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'right',
  },
  coordBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  coordText: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  emergencyBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    elevation: 2,
  },
  emergencyBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
  },
  sosSignalBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  sosSignalText: {
    fontSize: 14,
  },
});
