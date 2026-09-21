import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, SafeAreaView, Linking, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { useThemeStore } from '../../store/themeStore';
import { Fonts, Radius, Spacing } from '../../constants/theme';
import { User, Moon, Sun, Navigation, Volume2, HelpCircle, LogOut, ChevronLeft, Bike, Shield, Camera, Edit3, Headphones } from 'lucide-react-native';
import { ShiftSlider } from '../../components/ShiftSlider';
import { EditProfileModal } from '../../components/EditProfileModal';
import { normalizeMediaUrl } from '../../utils/media';

export default function DriverSettingsScreen() {
  const router = useRouter();
  const { mode, toggleTheme, colors } = useThemeStore();
  const { user, logout } = useAuthStore();
  const { analytics } = useTripStore();

  const [soundAlerts, setSoundAlerts] = useState(true);
  const [preferredNav, setPreferredNav] = useState<'google' | 'waze'>('google');
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.replace('/auth/login');
  };

  const handleSupport = () => {
    Linking.openURL('https://wa.me/201000000000?text=مرحباً، أحتاج إلى مساعدة في تطبيق الكابتن فوكس شوب');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          الإعدادات والملف الشخصي
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            onPress={() => setIsEditProfileOpen(true)}
            activeOpacity={0.8}
            style={styles.avatarWrapper}
          >
            {user?.avatar ? (
              <Image source={{ uri: normalizeMediaUrl(user.avatar) }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarBox, { backgroundColor: colors.primaryLight }]}>
                <User size={36} color={colors.primary} />
              </View>
            )}
            <View style={[styles.avatarCameraBadge, { backgroundColor: colors.primary, borderColor: colors.card }]}>
              <Camera size={13} color="#FFFFFF" strokeWidth={2.5} />
            </View>
          </TouchableOpacity>

          <View style={styles.profileText}>
            <View style={styles.nameEditRow}>
              <TouchableOpacity
                onPress={() => setIsEditProfileOpen(true)}
                style={[styles.editProfileBtn, { backgroundColor: colors.surface }]}
              >
                <Edit3 size={13} color={colors.primary} />
                <Text style={[styles.editProfileBtnText, { color: colors.primary, fontFamily: Fonts.bold }]}>
                  تعديل
                </Text>
              </TouchableOpacity>
              <Text style={[styles.driverFullName, { color: colors.text, fontFamily: Fonts.bold }]}>
                {user?.first_name} {user?.last_name}
              </Text>
            </View>

            <Text style={[styles.driverPhone, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
              {user?.phone_number || 'رقم الهاتف غير مسجل'}
            </Text>
            <View style={styles.vehicleBadgeRow}>
              <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                <Bike size={14} color={colors.primary} />
                <Text style={[styles.badgeText, { color: colors.text, fontFamily: Fonts.medium }]}>
                  {analytics?.vehicle_type || 'دراجة نارية'}
                </Text>
              </View>
              {analytics?.license_plate ? (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.badgeText, { color: colors.textSecondary, fontFamily: Fonts.regular }]}>
                    لوحة: {analytics.license_plate}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Section: Shift Status */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            حالة العمل واستقبال الطلبات
          </Text>
          <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border, paddingVertical: Spacing.xs }]}>
            <ShiftSlider />
          </View>
        </View>

        {/* Section: Preferences */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            التفضيلات والمظهر
          </Text>

          <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Dark Mode Toggle */}
            <View style={styles.settingItem}>
              <Switch
                value={mode === 'dark'}
                onValueChange={toggleTheme}
                trackColor={{ false: colors.surface, true: colors.primary }}
              />
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.text, fontFamily: Fonts.medium }]}>
                  الوضع الليلي (Dark Mode)
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
                  {mode === 'dark' ? <Moon size={18} color={colors.primary} /> : <Sun size={18} color={colors.warning} />}
                </View>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Sound Alerts */}
            <View style={styles.settingItem}>
              <Switch
                value={soundAlerts}
                onValueChange={setSoundAlerts}
                trackColor={{ false: colors.surface, true: colors.primary }}
              />
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.text, fontFamily: Fonts.medium }]}>
                  تنبيهات الطلبات الصوتية
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
                  <Volume2 size={18} color={colors.primary} />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Section: Navigation */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            تطبيق الخرائط والملاحة الافتراضي
          </Text>

          <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity
              onPress={() => setPreferredNav('google')}
              style={styles.settingItem}
            >
              <View style={[styles.radioDot, preferredNav === 'google' && { borderColor: colors.primary }]}>
                {preferredNav === 'google' && <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />}
              </View>
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.text, fontFamily: Fonts.medium }]}>
                  خرائط جوجل (Google Maps)
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
                  <Navigation size={18} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              onPress={() => setPreferredNav('waze')}
              style={styles.settingItem}
            >
              <View style={[styles.radioDot, preferredNav === 'waze' && { borderColor: colors.primary }]}>
                {preferredNav === 'waze' && <View style={[styles.radioFill, { backgroundColor: colors.primary }]} />}
              </View>
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.text, fontFamily: Fonts.medium }]}>
                  تطبيق Waze
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.surface }]}>
                  <Navigation size={18} color={colors.secondary} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Support */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
            المساعدة والدعم
          </Text>

          <View style={[styles.cardGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* In-App Support Hub */}
            <TouchableOpacity
              onPress={() => router.push('/support' as any)}
              style={styles.settingItem}
            >
              <ChevronLeft size={18} color={colors.textSecondary} />
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.text, fontFamily: Fonts.bold }]}>
                  مركز الدعم الفني والتذاكر 🎧
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight }]}>
                  <Headphones size={18} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* WhatsApp Fallback */}
            <TouchableOpacity onPress={handleSupport} style={styles.settingItem}>
              <ChevronLeft size={18} color={colors.textSecondary} />
              <View style={styles.settingItemRight}>
                <Text style={[styles.settingItemLabel, { color: colors.textSecondary, fontFamily: Fonts.medium }]}>
                  الدعم الفني عبر واتساب (احتياطي)
                </Text>
                <View style={[styles.iconCircle, { backgroundColor: colors.successLight }]}>
                  <HelpCircle size={18} color={colors.success} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          activeOpacity={0.8}
          style={[styles.logoutBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
        >
          <LogOut size={18} color={colors.danger} />
          <Text style={[styles.logoutBtnText, { color: colors.danger, fontFamily: Fonts.bold }]}>
            تسجيل الخروج من الحساب
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 18,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  profileCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  avatarWrapper: {
    position: 'relative',
    width: 64,
    height: 64,
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileText: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  nameEditRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  editProfileBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  editProfileBtnText: {
    fontSize: 11,
  },
  driverFullName: {
    fontSize: 18,
  },
  driverPhone: {
    fontSize: 13,
  },
  vehicleBadgeRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginTop: 4,
  },
  badge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: 13,
    textAlign: 'right',
    paddingHorizontal: 4,
  },
  cardGroup: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  settingItemRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingItemLabel: {
    fontSize: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
  },
  radioDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioFill: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: 8,
    marginTop: Spacing.sm,
  },
  logoutBtnText: {
    fontSize: 15,
  },
});
