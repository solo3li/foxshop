import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform, Modal, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  User as UserIcon,
  Heart,
  Settings,
  HelpCircle,
  MapPin,
  Ticket,
  ShoppingBag,
  ChevronLeft,
  Crown,
  LogIn,
  LogOut,
  X,
  RotateCw,
  Clock,
  CheckCircle2,
  Package,
} from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Colors } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { orderService, OrderResponse } from '../../services/orderService';
import { AddressSelectorModal } from '../../components/AddressSelectorModal';

const MENU_ITEMS = [
  { id: 'orders', title: 'الطلبات', icon: ShoppingBag, badge: null, requiresAuth: true },
  { id: 'vouchers', title: 'القسائم والعروض', icon: Ticket, badge: '٣', requiresAuth: false },
  { id: 'addresses', title: 'العناوين المحفوظة', icon: MapPin, badge: null, requiresAuth: true },
  { id: 'favorites', title: 'المفضلة', icon: Heart, badge: null, requiresAuth: false },
  { id: 'help', title: 'مركز المساعدة', icon: HelpCircle, badge: null, requiresAuth: false },
  { id: 'settings', title: 'الإعدادات', icon: Settings, badge: null, requiresAuth: false },
];

export default function AccountScreen() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const fetchOrders = async () => {
    setIsLoadingOrders(true);
    try {
      const res = await orderService.getOrderHistory();
      if (res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      console.warn('Error loading orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const handleItemPress = (itemId: string, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (itemId === 'orders') {
      setShowOrdersModal(true);
      fetchOrders();
    } else if (itemId === 'addresses') {
      setShowAddressModal(true);
    } else if (itemId === 'vouchers') {
      router.push('/vouchers');
    } else if (itemId === 'favorites') {
      router.push('/favorites');
    } else if (itemId === 'help') {
      router.push('/help');
    } else if (itemId === 'settings') {
      router.push('/settings');
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm('هل أنت متأكد من رغبتك في تسجيل الخروج؟');
      if (confirmed) {
        logout();
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
          },
        },
      ]
    );
  };

  const displayName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username
    : 'زائر';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Header */}
        <Animated.View entering={FadeInUp.delay(100).springify()} style={styles.header}>
          <View style={styles.avatarContainer}>
            {isAuthenticated ? (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: '#F3F4F6' }]}>
                <UserIcon size={32} color="#9CA3AF" />
              </View>
            )}
          </View>

          <View style={styles.userInfo}>
            {isAuthenticated ? (
              <>
                <Text style={styles.userName}>{displayName}</Text>
                <Text style={styles.userSubtitle}>
                  {user?.phone_number || `@${user?.username}`}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.userName}>مرحباً بك في فوكس شوب 🦊</Text>
                <Text style={styles.userSubtitle}>سجّل الدخول للوصول لكامل ميزات حسابك</Text>
              </>
            )}
          </View>
        </Animated.View>

        {/* Guest Login Card (Only shown if NOT authenticated) */}
        {!isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(150).springify()} style={styles.guestCard}>
            <View style={styles.guestCardTextContainer}>
              <Text style={styles.guestCardTitle}>لديك حساب بالفعل أو ترغب بالتسجيل؟</Text>
              <Text style={styles.guestCardDesc}>
                احفظ عناوينك، تتبع طلباتك لحظة بلحظة واستفد من العروض الحصرية.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.8}
            >
              <LogIn size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.loginBtnText}>تسجيل الدخول / إنشاء حساب</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Pro Banner */}
        <Animated.View entering={FadeInUp.delay(200).springify()} style={styles.proBanner}>
          <View style={styles.proInfo}>
            <View style={styles.proTitleRow}>
              <Crown size={20} color="#FFFFFF" fill="#FFFFFF" />
              <Text style={styles.proTitle}>Fox Pro</Text>
            </View>
            <Text style={styles.proSubtitle}>توصيل مجاني، عروض حصرية والمزيد</Text>
          </View>
          <TouchableOpacity style={styles.proBtn}>
            <Text style={styles.proBtnText}>اشترك الآن</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Menu Items */}
        <Animated.View entering={FadeInUp.delay(300).springify()} style={styles.menuContainer}>
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.menuItem}
                onPress={() => handleItemPress(item.id, item.requiresAuth)}
              >
                <View style={styles.menuItemLeft}>
                  <View style={styles.iconContainer}>
                    <Icon size={22} color={Colors.light.primary} />
                  </View>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                </View>
                <View style={styles.menuItemRight}>
                  {item.badge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                  <ChevronLeft size={20} color="#9CA3AF" />
                </View>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Logout Button (Only shown if authenticated) */}
        {isAuthenticated && (
          <Animated.View entering={FadeInUp.delay(400).springify()} style={styles.logoutContainer}>
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <LogOut size={20} color={Colors.light.primary} style={{ marginRight: 8 }} />
              <Text style={styles.logoutBtnText}>تسجيل الخروج</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        <View style={styles.footerContainer}>
          <Text style={styles.versionText}>فوكس شوب • الإصدار 1.0.0</Text>
        </View>

      </ScrollView>

      {/* Orders History & Tracking Modal */}
      <Modal
        visible={showOrdersModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOrdersModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowOrdersModal(false)}>
              <X size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>سجل طلباتي 📦</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={fetchOrders} disabled={isLoadingOrders}>
              <RotateCw size={18} color={isLoadingOrders ? '#9CA3AF' : Colors.light.primary} />
            </TouchableOpacity>
          </View>

          {isLoadingOrders ? (
            <View style={styles.centerLoading}>
              <ActivityIndicator size="large" color={Colors.light.primary} />
              <Text style={styles.loadingText}>جاري جلب قائمة طلباتك...</Text>
            </View>
          ) : orders.length === 0 ? (
            <View style={styles.emptyOrdersContainer}>
              <Text style={styles.emptyOrdersIcon}>🍽️</Text>
              <Text style={styles.emptyOrdersTitle}>لا توجد طلبات سابقة</Text>
              <Text style={styles.emptyOrdersSub}>لم تقم بطلب أي وجبة حتى الآن. ابدأ الطلب واستمتع بأشهى المأكولات!</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.ordersListContent}
              refreshControl={<RefreshControl refreshing={isLoadingOrders} onRefresh={fetchOrders} />}
            >
              {orders.map((ord: any) => {
                const statusColor =
                  ord.status === 'DELIVERED' ? '#16A34A' :
                  ord.status === 'PREPARING' ? '#EA580C' :
                  ord.status === 'ON_THE_WAY' ? '#0284C7' :
                  ord.status === 'CANCELLED' ? '#DC2626' : Colors.light.primary;
                const statusBg =
                  ord.status === 'DELIVERED' ? '#DCFCE7' :
                  ord.status === 'PREPARING' ? '#FFEDD5' :
                  ord.status === 'ON_THE_WAY' ? '#E0F2FE' :
                  ord.status === 'CANCELLED' ? '#FEE2E2' : '#FEF3C7';

                return (
                  <TouchableOpacity
                    key={ord.id}
                    style={styles.orderCard}
                    activeOpacity={0.7}
                    onPress={() => {
                      setShowOrdersModal(false);
                      router.push(`/order/${ord.id}` as any);
                    }}
                  >
                    <View style={styles.orderCardHeader}>
                      <View>
                        <Text style={styles.orderRestName}>{ord.restaurant_name || 'المطعم'}</Text>
                        <Text style={styles.orderNum}>رقم الطلب: #{ord.order_number}</Text>
                      </View>
                      <View style={[styles.orderStatusBadge, { backgroundColor: statusBg }]}>
                        <Text style={[styles.orderStatusText, { color: statusColor }]}>
                          {ord.status_display || ord.status}
                        </Text>
                      </View>
                    </View>

                    {ord.delivery_info?.delivery_otp && ord.status === 'ON_THE_WAY' && (
                      <View style={styles.otpBanner}>
                        <Text style={styles.otpLabel}>كود استلام الطلب مع الكابتن (OTP):</Text>
                        <Text style={styles.otpValue}>{ord.delivery_info.delivery_otp}</Text>
                      </View>
                    )}

                    <View style={styles.orderDivider} />

                    <View style={styles.orderFooter}>
                      <Text style={styles.orderDate}>
                        {new Date(ord.created_at).toLocaleDateString('ar-SA', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.orderTotal}>
                          المجموع: <Text style={styles.orderTotalBold}>{ord.total_amount} ر.س</Text>
                        </Text>
                        <Text style={{ fontSize: 12, color: Colors.light.primary, fontFamily: 'Tajawal_700Bold' }}>
                          • تتبع ➔
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <AddressSelectorModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  avatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.light.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Tajawal_700Bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'left',
  },
  userSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'left',
  },
  guestCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FCE7F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  guestCardTextContainer: {
    marginBottom: 14,
  },
  guestCardTitle: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
    marginBottom: 4,
    textAlign: 'left',
  },
  guestCardDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    lineHeight: 18,
    textAlign: 'left',
  },
  loginBtn: {
    backgroundColor: Colors.light.primary,
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  proBanner: {
    margin: 16,
    marginTop: 8,
    backgroundColor: Colors.light.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.light.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  proInfo: {
    flex: 1,
    marginRight: 16,
  },
  proTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  proTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#FFFFFF',
  },
  proSubtitle: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#FCE7F3',
  },
  proBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
  },
  proBtnText: {
    color: Colors.light.primary,
    fontFamily: 'Tajawal_700Bold',
    fontSize: 14,
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 12,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.light.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemTitle: {
    fontSize: 15,
    fontFamily: 'Tajawal_500Medium',
    color: '#1F2937',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: Colors.light.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  logoutContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: 50,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.light.primary,
    backgroundColor: '#FFFFFF',
  },
  logoutBtnText: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
  footerContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  versionText: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#6B7280',
  },
  emptyOrdersContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyOrdersIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyOrdersTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyOrdersSub: {
    fontSize: 14,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  ordersListContent: {
    padding: 16,
    gap: 12,
  },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderRestName: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#111827',
  },
  orderNum: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    color: '#6B7280',
    marginTop: 2,
  },
  orderStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  orderStatusText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  otpBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  otpLabel: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
    color: '#1E40AF',
  },
  otpValue: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
    color: '#1D4ED8',
    letterSpacing: 2,
  },
  orderDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderDate: {
    fontSize: 12,
    fontFamily: 'Tajawal_400Regular',
    color: '#9CA3AF',
  },
  orderTotal: {
    fontSize: 14,
    fontFamily: 'Tajawal_500Medium',
    color: '#374151',
  },
  orderTotalBold: {
    fontFamily: 'Tajawal_700Bold',
    color: Colors.light.primary,
  },
});
