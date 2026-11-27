import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  User as UserIcon,
  Heart,
  Settings,
  HelpCircle,
  MapPin,
  Ticket,
  ShoppingBag,
  ChevronLeft,
  LogIn,
  LogOut,
  X,
  ShieldCheck,
  Bell,
  Wallet,
  Sparkles,
  Store,
} from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../hooks/use-theme';
import { CURRENCY, formatCurrency } from '../../constants/config';
import { useAuthStore } from '../../store/authStore';
import { EditProfileModal } from '../../components/EditProfileModal';
import { EditProfileSvg } from '../../components/DiscoveryIcons';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';
import { orderService, isOrderActive } from '../../services/orderService';

interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<any>;
  badge?: string | null;
  requiresAuth?: boolean;
}

interface MenuGroup {
  id: string;
  title: string;
  items: MenuItem[];
}

export default function AccountScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { user, isAuthenticated, isHydrated, logout, loadStoredAuth } = useAuthStore();

  // Strict Auth Guard: immediately redirect guests away from account tab
  useFocusEffect(
    useCallback(() => {
      if (isHydrated && !isAuthenticated) {
        router.replace('/auth/login');
      }
    }, [isHydrated, isAuthenticated, router])
  );

  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [unreadNotifsCount, setUnreadNotifsCount] = useState<number>(0);
  const [activeOrdersCount, setActiveOrdersCount] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setActiveOrdersCount(0);
      return;
    }
    try {
      const res = await orderService.getMyOrders();
      if (res && res.data) {
        const activeCount = res.data.filter((o) => isOrderActive(o.status)).length;
        setActiveOrdersCount(activeCount);
      }
    } catch {
      // Non-fatal silent fallback
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchActiveOrders();
  }, [fetchActiveOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isAuthenticated) {
        await Promise.all([
          fetchActiveOrders(),
          loadStoredAuth().catch(() => {}),
        ]);
      }
    } finally {
      setRefreshing(false);
    }
  }, [isAuthenticated, fetchActiveOrders, loadStoredAuth]);

  const handleItemPress = (itemId: string, requiresAuth?: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    switch (itemId) {
      case 'orders':
        router.push('/(tabs)/orders' as any);
        break;
      case 'vouchers':
        router.push('/vouchers');
        break;
      case 'addresses':
        setShowAddressModal(true);
        break;
      case 'favorites':
        router.push('/favorites');
        break;
      case 'notifications':
        router.push('/notifications' as any);
        break;
      case 'settings':
        router.push('/settings');
        break;
      case 'help':
        router.push('/help');
        break;
      case 'terms':
        setShowPolicyModal(true);
        break;
      case 'partner':
        router.push('/partner-apply' as any);
        break;
    }
  };

  const handleLogout = async () => {
    const doLogout = async () => {
      await logout();
      router.replace('/auth/login');
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟');
      if (confirmed) {
        await doLogout();
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
          onPress: doLogout,
        },
      ]
    );
  };

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'مستخدم فوكس'
    : 'زائر';

  const userInitial = (displayName.trim().charAt(0) || 'ف').toUpperCase();

  const menuGroups: MenuGroup[] = [
    {
      id: 'orders_and_ops',
      title: 'طلباتي وعملياتي',
      items: [
        { id: 'orders', title: 'الطلبات', icon: ShoppingBag, badge: null, requiresAuth: true },
        { id: 'vouchers', title: 'القسائم والعروض', icon: Ticket, badge: '٣', requiresAuth: false },
        { id: 'addresses', title: 'العناوين المحفوظة', icon: MapPin, badge: null, requiresAuth: true },
      ],
    },
    {
      id: 'preferences',
      title: 'تفضيلاتي',
      items: [
        { id: 'favorites', title: 'المفضلة', icon: Heart, badge: null, requiresAuth: false },
        {
          id: 'notifications',
          title: 'الإشعارات',
          icon: Bell,
          badge: unreadNotifsCount > 0 ? (unreadNotifsCount > 9 ? '+٩' : `${unreadNotifsCount}`) : null,
          requiresAuth: false,
        },
        { id: 'settings', title: 'الإعدادات', icon: Settings, badge: null, requiresAuth: false },
      ],
    },
    {
      id: 'support_and_info',
      title: 'الدعم والمعلومات',
      items: [
        { id: 'partner', title: 'انضم كشريك (سجّل متجرك)', icon: Store, badge: null, requiresAuth: false },
        { id: 'help', title: 'مركز المساعدة', icon: HelpCircle, badge: null, requiresAuth: false },
        { id: 'terms', title: 'الشروط وسياسة الخصوصية', icon: ShieldCheck, badge: null, requiresAuth: false },
      ],
    },
  ];

  // Strictly prevent unauthenticated guests from rendering or viewing account contents
  if (!isHydrated) {
    return (
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {/* Ambient Top Glow + Hero Header */}
        <Animated.View entering={FadeInUp.delay(80).springify()} style={styles.heroSection}>
          {/* Subtle Ambient Radial Glow */}
          <View style={[styles.ambientGlow, { pointerEvents: 'none' as any }]}>
            <Svg width="100%" height="100%" viewBox="0 0 400 240" preserveAspectRatio="none">
              <Defs>
                <RadialGradient id="headerAmbientGlow" cx="50%" cy="0%" r="85%" fx="50%" fy="0%">
                  <Stop offset="0%" stopColor="#D70F64" stopOpacity={theme.isDark ? 0.12 : 0.05} />
                  <Stop offset="50%" stopColor="#D70F64" stopOpacity={theme.isDark ? 0.04 : 0.015} />
                  <Stop offset="100%" stopColor="#D70F64" stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="400" height="240" fill="url(#headerAmbientGlow)" />
            </Svg>
          </View>

          {/* 72px Avatar with Soft Halo Ring */}
          <View style={styles.avatarHalo}>
            <View
              style={[
                styles.avatarCircle,
                {
                  backgroundColor: isAuthenticated
                    ? theme.primary
                    : 'rgba(215, 15, 100, 0.08)',
                  borderColor: theme.background,
                },
              ]}
            >
              {isAuthenticated ? (
                <Text style={styles.avatarText}>{userInitial}</Text>
              ) : (
                <UserIcon size={34} color={theme.primary} strokeWidth={2} />
              )}
            </View>
          </View>

          {/* User Name & Details */}
          <Text style={[styles.userName, { color: theme.text }]}>
            {isAuthenticated ? displayName : 'مرحباً بك في فوكس شوب'}
          </Text>
          <Text style={[styles.userSubtitle, { color: theme.textSecondary }]}>
            {isAuthenticated
              ? user?.phone_number || (user?.email ? user.email : `@${user?.username}`)
              : 'سجّل الدخول لتجربة متكاملة ومتابعة طلباتك'}
          </Text>

          {/* Integrated Action Button */}
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.editProfilePill}
              activeOpacity={0.75}
              onPress={() => setShowEditProfile(true)}
            >
              <EditProfileSvg size={14} color={theme.primary} />
              <Text style={[styles.editProfilePillText, { color: theme.primary }]}>
                تعديل الملف الشخصي
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.guestLoginPill, { backgroundColor: theme.primary }]}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.85}
            >
              <LogIn size={18} color="#FFFFFF" />
              <Text style={styles.guestLoginPillText}>تسجيل الدخول / إنشاء حساب</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Quick Glance 3-Column Stats Bar */}
        <Animated.View entering={FadeInUp.delay(140).springify()} style={styles.statsContainer}>
          {/* 1. Wallet */}
          <TouchableOpacity
            style={[
              styles.statPill,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.025)',
              },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              const msg = `رصيدك الحالي: ${formatCurrency(0)}\nيمكنك استخدام الرصيد في سداد طلباتك القادمة فور شحن المحفظة.`;
              if (Platform.OS === 'web') {
                window.alert(msg);
              } else {
                Alert.alert('محفظة فوكس', msg);
              }
            }}
          >
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(215, 15, 100, 0.08)' }]}>
              <Wallet size={16} color={theme.primary} strokeWidth={2} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
              {formatCurrency(0)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>المحفظة</Text>
          </TouchableOpacity>

          {/* 2. Fox Points */}
          <TouchableOpacity
            style={[
              styles.statPill,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.025)',
              },
            ]}
            activeOpacity={0.7}
            onPress={() => router.push('/vouchers')}
          >
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
              <Sparkles size={16} color="#F59E0B" strokeWidth={2} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
              150 نقطة
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>نقاط فوكس</Text>
          </TouchableOpacity>

          {/* 3. Active Orders */}
          <TouchableOpacity
            style={[
              styles.statPill,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255, 255, 255, 0.04)'
                  : 'rgba(0, 0, 0, 0.025)',
              },
            ]}
            activeOpacity={0.7}
            onPress={() => {
              if (!isAuthenticated) {
                router.push('/auth/login');
              } else {
                router.push('/(tabs)/orders' as any);
              }
            }}
          >
            <View style={[styles.statIconWrap, { backgroundColor: 'rgba(2, 132, 199, 0.1)' }]}>
              <ShoppingBag size={16} color="#0284C7" strokeWidth={2} />
            </View>
            <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
              {isAuthenticated
                ? activeOrdersCount > 0
                  ? `${activeOrdersCount} نشط`
                  : 'لا توجد'
                : '٠ نشط'}
            </Text>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>طلباتي النشطة</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Categorized Menu Groups: Zero-Border Fluid Surface */}
        <View style={styles.menuGroupsWrapper}>
          {menuGroups.map((group, groupIdx) => (
            <Animated.View
              key={group.id}
              entering={FadeInUp.delay(180 + groupIdx * 60).springify()}
              style={styles.groupContainer}
            >
              <Text style={[styles.groupTitle, { color: theme.textMuted }]}>{group.title}</Text>

              <View style={styles.groupList}>
                {group.items.map((item, itemIdx) => {
                  const Icon = item.icon;
                  const isLast = itemIdx === group.items.length - 1;

                  return (
                    <React.Fragment key={item.id}>
                      <TouchableOpacity
                        style={styles.menuRow}
                        activeOpacity={0.65}
                        onPress={() => handleItemPress(item.id, item.requiresAuth)}
                      >
                        <View style={styles.menuRowRight}>
                          <View
                            style={[
                              styles.menuIconContainer,
                              { backgroundColor: 'rgba(215, 15, 100, 0.08)' },
                            ]}
                          >
                            <Icon size={19} color={theme.primary} strokeWidth={2} />
                          </View>
                          <Text style={[styles.menuRowTitle, { color: theme.text }]}>
                            {item.title}
                          </Text>
                        </View>

                        <View style={styles.menuRowLeft}>
                          {item.badge && (
                            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          )}
                          <ChevronLeft size={18} color={theme.textMuted} />
                        </View>
                      </TouchableOpacity>

                      {!isLast && (
                        <View
                          style={[
                            styles.hairlineDivider,
                            {
                              backgroundColor: theme.isDark
                                ? 'rgba(255, 255, 255, 0.06)'
                                : 'rgba(0, 0, 0, 0.05)',
                            },
                          ]}
                        />
                      )}
                    </React.Fragment>
                  );
                })}
              </View>
            </Animated.View>
          ))}
        </View>

        {/* Minimalist Sleek Logout Button */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(360).springify()} style={styles.logoutWrapper}>
            <TouchableOpacity
              style={styles.logoutPill}
              onPress={handleLogout}
              activeOpacity={0.75}
            >
              <LogOut size={18} color={theme.error} strokeWidth={2} />
              <Text style={[styles.logoutText, { color: theme.error }]}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Brand Footer */}
        <View style={styles.footerContainer}>
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            فوكس شوب • الإصدار 1.0.0
          </Text>
        </View>
      </ScrollView>

      {/* Address Selector Modal */}
      <AddressSelectorModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      {/* Privacy Policy & Terms Modal */}
      <Modal
        visible={showPolicyModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPolicyModal(false)}
      >
        <SafeAreaView style={[styles.policyModalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.policyModalHeader, { backgroundColor: theme.card }]}>
            <TouchableOpacity
              style={[styles.policyCloseBtn, { backgroundColor: theme.surfaceSecondary }]}
              onPress={() => setShowPolicyModal(false)}
            >
              <X size={20} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.policyModalTitle, { color: theme.text }]}>
              الشروط وسياسة الخصوصية
            </Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.policyModalContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.policySection}>
              <View style={styles.policyHeadingRow}>
                <ShieldCheck size={20} color={theme.primary} strokeWidth={2} />
                <Text style={[styles.policyHeading, { color: theme.text }]}>
                  سياسة الخصوصية وحماية البيانات
                </Text>
              </View>
              <Text style={[styles.policyText, { color: theme.textSecondary }]}>
                نحن في فوكس شوب نولي خصوصية بياناتك اهتماماً بالغاً. لا يتم استخدام بيانات موقعك
                الجغرافي أو رقم هاتفك إلا لغرض إتمام وتوصيل الطلبات وتوفير أفضل تجربة مستخدم
                ممكنة. يتم تشفير جميع المعاملات والبيانات الحساسة وفقاً لأعلى معايير الأمان
                العالمية.
              </Text>
            </View>

            <View
              style={[
                styles.policyDivider,
                {
                  backgroundColor: theme.isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            />

            <View style={styles.policySection}>
              <View style={styles.policyHeadingRow}>
                <HelpCircle size={20} color={theme.primary} strokeWidth={2} />
                <Text style={[styles.policyHeading, { color: theme.text }]}>
                  شروط الخدمة والاستخدام
                </Text>
              </View>
              <Text style={[styles.policyText, { color: theme.textSecondary }]}>
                باستخدامك لتطبيق فوكس شوب، فإنك توافق على الالتزام بشروط الخدمة وسياسات التوصيل
                المعتمدة. نحرص دائماً على تقديم وجبات طازجة وسريعة بأعلى معايير الجودة ورضا
                العملاء. في حال وجود أي استفسار أو شكوى يمكنك التواصل مباشرة مع مركز المساعدة.
              </Text>
            </View>
          </ScrollView>
        </SafeAreaView>
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
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
    paddingBottom: 110,
  },
  heroSection: {
    position: 'relative',
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 16,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  ambientGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 240,
  },
  avatarHalo: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: 'rgba(215, 15, 100, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Tajawal_700Bold',
  },
  userName: {
    fontSize: 20,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  userSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    marginBottom: 14,
    textAlign: 'center',
  },
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(215, 15, 100, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  editProfilePillText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
  },
  guestLoginPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 24,
    marginTop: 4,
    gap: 8,
  },
  guestLoginPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginVertical: 14,
  },
  statPill: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  statValue: {
    fontSize: 13,
    fontFamily: 'Tajawal_700Bold',
    marginBottom: 2,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
  },
  menuGroupsWrapper: {
    paddingHorizontal: 16,
    gap: 18,
    marginTop: 4,
  },
  groupContainer: {
    width: '100%',
  },
  groupTitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    marginBottom: 6,
    paddingHorizontal: 8,
    textAlign: 'right',
  },
  groupList: {
    borderRadius: 20,
    borderWidth: 0,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  menuRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuRowTitle: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  hairlineDivider: {
    height: 0.5,
    marginStart: 62,
    marginEnd: 14,
  },
  logoutWrapper: {
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  logoutPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.06)',
    borderWidth: 0,
    gap: 8,
  },
  logoutText: {
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
  },
  policyModalContainer: {
    flex: 1,
  },
  policyModalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  policyCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyModalTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
  },
  policyModalContent: {
    padding: 20,
    gap: 20,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  policySection: {
    gap: 8,
  },
  policyHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  policyHeading: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  policyText: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  policyDivider: {
    height: 1,
    marginVertical: 4,
  },
});
