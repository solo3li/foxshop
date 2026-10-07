import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  ChevronLeft,
  Bell,
  MessageSquare,
  Globe,
  MapPin,
  Moon,
  FileText,
  ShieldCheck,
  Info,
  LogOut,
  Trash2,
  LogIn,
  CheckCircle2,
  X,
  AlertTriangle,
  User as UserIcon,
} from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '../constants/theme';
import { useAuthStore } from '../store/authStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  // Notification Toggles
  const [orderNotifs, setOrderNotifs] = useState(true);
  const [promoNotifs, setPromoNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

  // Policy Modals
  const [modalContent, setModalContent] = useState<{ title: string; body: string } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟');
      if (confirmed) {
        logout().then(() => router.replace('/account'));
      }
      return;
    }

    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من رغبتك في تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'خروج',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/account');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setShowDeleteModal(false);
    logout().then(() => {
      if (Platform.OS === 'web') {
        window.alert('تم استلام طلب حذف حسابك وبياناتك بنجاح.');
      } else {
        Alert.alert('تم بنجاح', 'تم استلام طلب حذف حسابك وبياناتك بنجاح.');
      }
      router.replace('/account');
    });
  };

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : 'زائر';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>الإعدادات</Text>
          <Text style={styles.headerSubtitle}>تفضيلات الحساب، التنبيهات والأمان</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        {isAuthenticated ? (
          <Animated.View entering={FadeInUp.delay(50).springify()} style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.profileName}>{displayName}</Text>
                <View style={styles.verifiedBadge}>
                  <CheckCircle2 size={12} color="#059669" />
                  <Text style={styles.verifiedText}>موثق</Text>
                </View>
              </View>
              <Text style={styles.profilePhone}>{user?.phone_number || `@${user?.username}`}</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInUp.delay(50).springify()} style={styles.guestCard}>
            <View style={styles.guestIconCircle}>
              <UserIcon size={24} color={Colors.light.primary} />
            </View>
            <View style={styles.guestTextContainer}>
              <Text style={styles.guestTitle}>أنت تتصفح كزائر</Text>
              <Text style={styles.guestSubtitle}>سجل الدخول لحفظ تفضيلاتك وتتبع طلباتك</Text>
            </View>
            <TouchableOpacity
              style={styles.guestLoginBtn}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.8}
            >
              <LogIn size={16} color="#FFFFFF" />
              <Text style={styles.guestLoginBtnText}>دخول</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* SECTION 1: الإشعارات */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.section}>
          <Text style={styles.sectionHeading}>تفضيلات الإشعارات</Text>
          <View style={styles.cardGroup}>
            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Bell size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>إشعارات الطلبات المباشرة</Text>
                <Text style={styles.settingSubtitle}>تنبيهات فورية عند تحضير وتوصيل الطلب</Text>
              </View>
              <Switch
                value={orderNotifs}
                onValueChange={setOrderNotifs}
                trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <MessageSquare size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>العروض والخصومات الحصرية</Text>
                <Text style={styles.settingSubtitle}>إشعارك بأقوى الكوبونات وقسائم التوفير</Text>
              </View>
              <Switch
                value={promoNotifs}
                onValueChange={setPromoNotifs}
                trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <MessageSquare size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>تنبيهات الرسائل القصيرة (SMS)</Text>
                <Text style={styles.settingSubtitle}>إرسال رسائل نصية برقم الكابتن والتتبع</Text>
              </View>
              <Switch
                value={smsNotifs}
                onValueChange={setSmsNotifs}
                trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Animated.View>

        {/* SECTION 2: تفضيلات التطبيق */}
        <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.section}>
          <Text style={styles.sectionHeading}>تفضيلات التطبيق</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity style={styles.settingRowClickable} activeOpacity={0.7}>
              <View style={styles.settingIconContainer}>
                <Globe size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>اللغة (Language)</Text>
                <Text style={styles.settingSubtitle}>العربية (المملكة العربية السعودية)</Text>
              </View>
              <ChevronLeft size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingRowClickable} activeOpacity={0.7}>
              <View style={styles.settingIconContainer}>
                <MapPin size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>خدمات تحديد الموقع (GPS)</Text>
                <Text style={styles.settingSubtitle}>مفعلة بدقة عالية لعرض المطاعم الأقرب</Text>
              </View>
              <ChevronLeft size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Moon size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>الوضع الليلي (Dark Mode)</Text>
                <Text style={styles.settingSubtitle}>الوضع النهاري الفاتح (الافتراضي)</Text>
              </View>
              <Switch
                value={false}
                disabled
                trackColor={{ false: '#E5E7EB', true: Colors.light.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </Animated.View>

        {/* SECTION 3: الشروط والخصوصية */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.section}>
          <Text style={styles.sectionHeading}>المعلومات القانونية والأمان</Text>
          <View style={styles.cardGroup}>
            <TouchableOpacity
              style={styles.settingRowClickable}
              onPress={() =>
                setModalContent({
                  title: 'شروط وأحكام الخدمة',
                  body:
                    'أهلاً بك في تطبيق فوكس شوب. باستخدامك للتطبيق فإنك توافق على الالتزام بجميع الشروط والسياسات الخاصة بالطلبات والتوصيل والدفع. يتم تجهيز جميع الوجبات بواسطة المطاعم الشريكة وتوصيلها بواسطة شبكة الكباتن المعتمدة مع ضمان أعلى معايير الجودة والأمان.',
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.settingIconContainer}>
                <FileText size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>شروط الاستخدام والأحكام</Text>
              </View>
              <ChevronLeft size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.settingRowClickable}
              onPress={() =>
                setModalContent({
                  title: 'سياسة الخصوصية وأمان البيانات',
                  body:
                    'نحن نولي خصوصية بياناتك اهتماماً بالغاً. لا يتم استخدام بيانات موقعك الجغرافي أو رقم هاتفك إلا لغرض إتمام وتوصيل الطلبات وتوفير أفضل تجربة مستخدم ممكنة. يتم تشفير جميع المعاملات والبيانات الحساسة وفقاً لأعلى معايير التشفير العالمية.',
                })
              }
              activeOpacity={0.7}
            >
              <View style={styles.settingIconContainer}>
                <ShieldCheck size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>سياسة الخصوصية وحماية البيانات</Text>
              </View>
              <ChevronLeft size={18} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingIconContainer}>
                <Info size={20} color={Colors.light.primary} />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={styles.settingTitle}>إصدار التطبيق</Text>
                <Text style={styles.settingSubtitle}>فوكس شوب • v1.0.0 (بناء 42 - مستقر)</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* SECTION 4: إجراءات الحساب */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(250).springify()} style={styles.section}>
            <Text style={styles.sectionHeading}>إجراءات الحساب</Text>
            <View style={styles.cardGroup}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <LogOut size={20} color="#DC2626" />
                <Text style={styles.actionLogoutText}>تسجيل الخروج من الحساب</Text>
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => setShowDeleteModal(true)}
                activeOpacity={0.7}
              >
                <Trash2 size={20} color="#991B1B" />
                <Text style={styles.actionDeleteText}>حذف الحساب نهائياً</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Info Modal (Terms / Privacy) */}
      <Modal
        visible={modalContent !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalContent(null)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalContent(null)}>
              <X size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{modalContent?.title}</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView style={styles.modalBody}>
            <Text style={styles.modalBodyText}>{modalContent?.body}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Delete Account Warning Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <View style={styles.warningCircle}>
              <AlertTriangle size={32} color="#DC2626" />
            </View>
            <Text style={styles.dialogTitle}>تأكيد حذف الحساب</Text>
            <Text style={styles.dialogDesc}>
              هل أنت متأكد من رغبتك في حذف حسابك؟ سيتم إلغاء تفعيل حسابك وحذف تفضيلاتك وسجل طلباتك ولا يمكن التراجع عن هذا الإجراء.
            </Text>
            <View style={styles.dialogButtonsRow}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.dialogCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogConfirmDeleteBtn}
                onPress={handleDeleteAccount}
              >
                <Text style={styles.dialogConfirmDeleteText}>نعم، احذف الحساب</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
    marginTop: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 14,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 3,
  },
  verifiedText: {
    fontSize: 10,
    fontFamily: 'Tajawal_700Bold',
    color: '#059669',
  },
  profilePhone: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  guestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  guestIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  guestTextContainer: {
    flex: 1,
  },
  guestTitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
  },
  guestSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  guestLoginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  guestLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeading: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#4B5563',
    marginBottom: 8,
    textAlign: 'left',
  },
  cardGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  settingRowClickable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  settingTextContainer: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    textAlign: 'left',
  },
  settingSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'left',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
  },
  actionLogoutText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#DC2626',
  },
  actionDeleteText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#991B1B',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  modalBody: {
    padding: 20,
  },
  modalBodyText: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#374151',
    lineHeight: 24,
    textAlign: 'left',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  warningCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  dialogTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 8,
  },
  dialogDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  dialogButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  dialogCancelText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#4B5563',
  },
  dialogConfirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  dialogConfirmDeleteText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
  },
});
