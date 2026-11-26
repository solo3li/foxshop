import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { orderService, OrderResponse, isOrderActive } from '../../services/orderService';
import { useAuthStore } from '../../store/authStore';
import { useCartStore } from '../../store/cartStore';
import { useTheme } from '../../hooks/use-theme';
import { CURRENCY, formatCurrency } from '../../constants/config';
import {
  LogIn,
  RotateCcw,
  Navigation,
  UtensilsCrossed,
  Sparkles,
  ShoppingBag,
} from 'lucide-react-native';

type OrderFilterType = 'ALL' | 'ACTIVE' | 'HISTORY';

export default function OrdersScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { isAuthenticated } = useAuthStore();
  const { addItem } = useCartStore();

  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<OrderFilterType>('ALL');

  const fetchOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const res = await orderService.getMyOrders();
      if (res.data) {
        setOrders(res.data);
      }
    } catch (err) {
      console.error('[OrdersScreen] Error loading orders:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const filteredOrders = orders.filter((order) => {
    const active = isOrderActive(order.status);
    if (activeFilter === 'ACTIVE') return active;
    if (activeFilter === 'HISTORY') return !active;
    return true;
  });

  const activeOrdersCount = orders.filter((o) => isOrderActive(o.status)).length;

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    switch (s) {
      case 'PENDING':
        return { label: 'بانتظار التأكيد', bg: theme.isDark ? '#451A03' : '#FEF3C7', color: '#D97706' };
      case 'CONFIRMED':
        return { label: 'تم تأكيد الطلب', bg: theme.isDark ? '#172554' : '#EFF6FF', color: '#2563EB' };
      case 'PREPARING':
        return { label: 'جاري التحضير بالمتجر', bg: theme.isDark ? '#451A03' : '#FEF3C7', color: '#B45309' };
      case 'READY_FOR_PICKUP':
        return { label: 'جاهز للاستلام', bg: theme.isDark ? '#3B0764' : '#F3E8FF', color: '#7E22CE' };
      case 'ON_THE_WAY':
        return { label: 'الكابتن في الطريق', bg: theme.primaryLight, color: theme.primary };
      case 'DELIVERED':
        return { label: 'تم التوصيل بنجاح', bg: theme.isDark ? '#064E3B' : '#ECFDF5', color: '#059669' };
      case 'CANCELLED':
        return { label: 'تم الإلغاء', bg: theme.isDark ? '#450A0A' : '#FEE2E2', color: '#DC2626' };
      default:
        return { label: status, bg: theme.isDark ? '#1F2937' : '#F3F4F6', color: theme.textSecondary };
    }
  };

  const handleReorder = (order: OrderResponse) => {
    if (order.items && order.items.length > 0) {
      order.items.forEach((item) => {
        addItem({
          id: item.id || `reorder-${Date.now()}-${Math.random()}`,
          name: item.item_name,
          price: typeof item.unit_price === 'number' ? item.unit_price : parseFloat(item.unit_price || '0'),
          quantity: item.quantity,
          restaurantId: order.restaurant || '',
          restaurantName: order.restaurant_name,
        } as any);
      });
      router.push('/(tabs)/carts' as any);
    } else {
      router.push(`/order/${order.id}` as any);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.card }]}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>طلباتي</Text>
          {activeOrdersCount > 0 && (
            <View style={[styles.activePill, { backgroundColor: theme.primaryLight }]}>
              <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.activePillText, { color: theme.primary }]}>{activeOrdersCount} جارية</Text>
            </View>
          )}
        </View>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          تتبع طلباتك الحالية وسجل مشترياتك السابقة
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filtersBar, { backgroundColor: theme.card }]}>
        {(
          [
            { id: 'ALL', label: `الكل (${orders.length})` },
            { id: 'ACTIVE', label: `الحالية (${activeOrdersCount})` },
            { id: 'HISTORY', label: `السابقة (${orders.length - activeOrdersCount})` },
          ] as const
        ).map((tab) => {
          const isSelected = activeFilter === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              onPress={() => setActiveFilter(tab.id)}
              activeOpacity={0.8}
              style={[
                styles.filterTab,
                { backgroundColor: isSelected ? theme.primary : theme.isDark ? theme.surfaceSecondary : '#F3F4F6' },
              ]}
            >
              <Text style={[styles.filterTabText, { color: isSelected ? '#FFFFFF' : theme.textSecondary }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {!isAuthenticated ? (
        <ScrollView contentContainerStyle={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight }]}>
            <LogIn size={42} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>سجل الدخول لعرض وتتبع طلباتك</Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            سجل دخولك لتتمكن من متابعة حالة طلباتك الحالية، تتبع حركة الكابتن مباشرة على الخريطة، وإعادة الطلب بسهولة!
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/login' as any)}
            activeOpacity={0.8}
            style={[styles.exploreBtn, { backgroundColor: theme.primary }]}
          >
            <LogIn size={18} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>تسجيل الدخول الآن</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>جاري تحميل طلباتك...</Text>
        </View>
      ) : filteredOrders.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight }]}>
            <UtensilsCrossed size={42} color={theme.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>لا توجد طلبات في هذا القسم</Text>
          <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
            {activeFilter === 'ACTIVE'
              ? 'ليس لديك أي طلبات جارية الآن. اطلب ما تحتاجه وسنبدأ في توصيله فوراً!'
              : 'لم تقم بأي طلبات بعد. تصفح المتاجر واستمتع بأقوى العروض!'}
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)' as any)}
            activeOpacity={0.8}
            style={[styles.exploreBtn, { backgroundColor: theme.primary }]}
          >
            <Sparkles size={18} color="#FFFFFF" />
            <Text style={styles.exploreBtnText}>تصفح المتاجر وابدأ الطلب</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {filteredOrders.map((order) => {
            const badge = getStatusBadge(order.status);
            const active = isOrderActive(order.status);

            return (
              <TouchableOpacity
                key={order.id}
                onPress={() => router.push(`/order/${order.id}` as any)}
                activeOpacity={0.88}
                style={[
                  styles.orderCard,
                  { backgroundColor: theme.card },
                  active && { backgroundColor: theme.isDark ? theme.surfaceSecondary : '#FFFFFF' },
                ]}
              >
                {/* Top Row: Restaurant Name & Status Badge */}
                <View style={styles.cardHeaderRow}>
                  <View style={styles.restaurantMeta}>
                    <Text style={[styles.restaurantName, { color: theme.text }]} numberOfLines={1}>
                      {order.restaurant_name || 'مطعم فوكس شوب'}
                    </Text>
                    <Text style={[styles.orderNumber, { color: theme.textSecondary }]}>#{order.order_number}</Text>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                    <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                {/* Items Summary */}
                <View style={[styles.itemsSummaryBox, { backgroundColor: theme.surface }]}>
                  {order.items && order.items.length > 0 ? (
                    <Text style={[styles.itemsSummaryText, { color: theme.textSecondary }]} numberOfLines={2}>
                      {order.items.map((it) => `${it.quantity}x ${it.item_name}`).join(' • ')}
                    </Text>
                  ) : (
                    <Text style={[styles.itemsSummaryText, { color: theme.textSecondary }]}>طلب منتجات متنوعة</Text>
                  )}
                </View>

                {/* Divider */}
                <View style={[styles.cardDivider, { backgroundColor: theme.borderSubtle }]} />

                {/* Bottom Row: Amount & Actions */}
                <View style={styles.cardFooterRow}>
                  <View style={styles.priceContainer}>
                    <Text style={[styles.priceLabel, { color: theme.textSecondary }]}>الإجمالي:</Text>
                    <Text style={[styles.priceValue, { color: theme.primary }]}>
                      {formatCurrency(order.total_amount)}
                    </Text>
                  </View>

                  <View style={styles.actionsRow}>
                    {active ? (
                      <TouchableOpacity
                        onPress={() => router.push(`/order/${order.id}` as any)}
                        activeOpacity={0.8}
                        style={[styles.trackBtn, { backgroundColor: theme.primary }]}
                      >
                        <Navigation size={14} color="#FFFFFF" />
                        <Text style={styles.trackBtnText}>تتبع مسار الطلب</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleReorder(order)}
                        activeOpacity={0.8}
                        style={[styles.reorderBtn, { backgroundColor: theme.primaryLight }]}
                      >
                        <RotateCcw size={13} color={theme.primary} />
                        <Text style={[styles.reorderBtnText, { color: theme.primary }]}>إعادة الطلب</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: 'flex-end',
  },
  headerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Tajawal_700Bold',
  },
  activePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 0,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activePillText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  headerSubtitle: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    marginTop: 2,
    textAlign: 'right',
  },
  filtersBar: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 0,
  },
  filterTabText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Tajawal_700Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 13,
    fontFamily: 'Tajawal_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  exploreBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 22,
  },
  exploreBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Tajawal_700Bold',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Tajawal_500Medium',
  },
  listContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 100,
  },
  orderCard: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    gap: 12,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  restaurantMeta: {
    flex: 1,
    alignItems: 'flex-end',
    marginRight: 10,
  },
  restaurantName: {
    fontSize: 15,
    fontFamily: 'Tajawal_700Bold',
  },
  orderNumber: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 0,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Tajawal_700Bold',
  },
  itemsSummaryBox: {
    padding: 12,
    borderRadius: 12,
  },
  itemsSummaryText: {
    fontSize: 12,
    fontFamily: 'Tajawal_500Medium',
    lineHeight: 18,
    textAlign: 'right',
  },
  cardDivider: {
    height: 1,
  },
  cardFooterRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: 'Tajawal_500Medium',
  },
  priceValue: {
    fontSize: 16,
    fontFamily: 'Tajawal_700Bold',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  trackBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 0,
  },
  trackBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
  reorderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 0,
  },
  reorderBtnText: {
    fontSize: 12,
    fontFamily: 'Tajawal_700Bold',
  },
});
